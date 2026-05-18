# Sprint 6: Google Apps Script 一括チェック移植

## 概要

- **目的**: SPFチェックツール（`dist/index.html`）の SPF/DKIM/DMARC 診断エンジンを Google Apps Script (GAS) に移植し、社長の営業分析スプレッドシート上で一括チェックを実行できる業務ツール化する。
- **派生位置づけ**: Sprint 5 まで（Webツール）は完了済み。Sprint 6 は同一ロジックの GAS 拡張派生として位置づけ、Webツール側のコードベースは無改変方針で行う。
- **本質的な価値**: 営業リストの全ドメインを 1 クリックでチェックでき、結果をスプレッドシート上で一覧管理できる。社長の営業分析業務の手動チェックを完全自動化する。
- **前提**: Sprint 1〜5 完了済み（`src/parsers/`・`src/diagnosis/`・`src/api/dns-resolver.js` が pure JS で実装済み）、Phase 0（リサーチ・4エージェント議論・社長承認）完了済み。

GAS には fetchAll の並列実行と Script Properties による安全機構が用意されており、6 分実行制限を超えない範囲で 100 件の一括チェックを安全に実行できる。Sprint 6 はこの GAS の特性に最適化したアーキテクチャで、既存ロジックを忠実に移植する。

---

## 対象スプレッドシート

| 項目 | 値 |
|---|---|
| スプレッドシート ID | `1-NbppSJfIXbUWnYUWvYa72W1Yx_kVnffBtXhZ-EpbAM` |
| 対象シート（gid） | `1728384105` |
| 対象シートタイトル | 「特典３：あなたの営業の改善点を丸裸にする営業分析ツール_営業分析中（最新）」 |

シート取得は `getSheets()` をループして `sheet.getSheetId() === SHEET_GID` で照合する方式とする。シート名は社長の運用で変更される可能性があるため、シート名一致による取得は禁止する。

---

## 処理仕様

### 発火条件

- D 列が空でない行のみが処理対象
- ヘッダ行（1 行目）は処理対象外
- AC 列（ヘッダ「ドメイン」）が空の行はスキップ（エラーログのみ、書き込みなし）

### ドメインソース

- AC 列（ヘッダ「ドメイン」）から取得
- 入力例: `carbuncle.biz` / `https://carbuncle.biz/contact` / `Carbuncle.BIZ` / `日本語.jp`
- 正規化処理:
  1. `trim()`
  2. 小文字化
  3. URL 形式なら `new URL()` でホスト名抽出（プロトコル無しなら追加してパース）
  4. Punycode 変換（IDN 対応）

### 結果書き込み（BG〜BK 5 列）

| 列 | 内容 | 例 |
|---|---|---|
| BG | 総合判定 | `⚠️ 警告 2/3` / `✅ OK 3/3` / `❌ NG 0/3` / `🔁 再実行 / <理由>` |
| BH | SPF 判定 | `✅ OK \| v=spf1 include:_spf.google.com ~all` |
| BI | DKIM 判定 | `❌ NG \| (レコード未検出)` |
| BJ | DMARC 判定 | `✅ OK \| v=DMARC1; p=none` |
| BK | 実行日時 | `2026-05-18 11:30` |

- 既存の BG〜BK 値は常に上書き
- `getValues()` → 加工 → `setValues()` の 3 ステップを厳守（セル単位 setValue 禁止）

### 処理ルール

- DNS 解決は Google Public DNS API (`https://dns.google/resolve?...`)
- `UrlFetchApp.fetchAll()` で並列実行、チャンクサイズ 100 件以下
- 6 分実行制限を考慮し、`Utilities.getCurrentExecutionTime()` 相当のチェックで残時間 30 秒を切ったら中断
- 中断時は処理済み行までの結果を書き込み、残行を Script Properties に保存

### DKIM セレクタ最適化

Sprint 5 で定義された 28 セレクタを以下 2 段階に分割：

**プリスキャン（7 セレクタ・並列）**: `default, google, selector1, selector2, k1, s1, mail`
**フォールバック（残 21 セレクタ・並列）**: プリスキャンで全滅した場合のみ実行

これにより、メジャー設定が見つかる多数派ケースでクエリ数を 1/4 に削減（28 → 7）。

---

## カスタムメニュー UX

スプレッドシートを開いた時点で `onOpen()` がカスタムメニュー「メール認証チェック」を自動表示する。

```
メール認証チェック
├── ▶ 選択行をチェック
├── ▶ 全営業リストをチェック
├── ─（セパレーター）
├── 結果の見方
└── 履歴シートを開く
```

- **▶ 選択行をチェック**: `getActiveRange()` の行範囲を対象に実行
- **▶ 全営業リストをチェック**: D 列が空でない全行を対象に実行
- **結果の見方**: モーダルダイアログで判定凡例を表示
- **履歴シートを開く**: 実行履歴シート（後述）にジャンプ

### 進捗フィードバック

- 開始時: `SpreadsheetApp.getActiveSpreadsheet().toast('チェック開始: N件')` を表示
- 実行中: 各チャンク処理直前に BG 列へ `⏳ 確認中...` をライブ書き込み
- 完了時: `toast('完了：OK X / 警告 Y / NG Z', 'メール認証チェック', 10)` を表示

---

## 安全機構（Script Properties）

| プロパティ名 | 型 | 用途 | デフォルト |
|---|---|---|---|
| `DRY_RUN` | string `"true"` / `"false"` | `"true"` 時はセル書き込みをスキップし `Logger.log` に結果出力 | `"false"` |
| `START_ROW` | string（整数） | この行から処理開始 | `2`（ヘッダ除外） |
| `END_ROW` | string（整数） | この行で処理終了（含む） | 末尾行 |
| `SHEET_GID` | string（整数） | 対象シートの gid | `"1728384105"` |
| `RESUME_ROWS` | string（JSON） | 6 分タイムアウト時の未処理行リスト（自動セット） | 未設定 |

### 初回検証フロー

1. 社長が Script Properties で `DRY_RUN = true` をセット
2. `START_ROW = 2`, `END_ROW = 6` で 3〜5 行のみ試験実行
3. `Logger.log` でドメイン正規化結果・DNS 応答・判定結果を確認
4. 問題なければ `DRY_RUN = false`、`START_ROW` / `END_ROW` を削除して全量実行

---

## エラーハンドリング規約

| ケース | BG 列 | BH/BI/BJ | BK 列 |
|---|---|---|---|
| 正常終了 | 判定（`✅ OK 3/3` 等） | 各レコード判定 | 実行日時 |
| AC 列が空 | 書き込みなし（スキップ） | 書き込みなし | 書き込みなし |
| ドメイン正規化失敗 | `🔁 再実行 / ドメイン形式不正` | 空 | 実行日時 |
| NXDOMAIN（ドメイン消失） | `🔁 再実行 / ドメイン未登録` | 空 | 実行日時 |
| DNS API タイムアウト | `🔁 再実行 / DNSタイムアウト` | 空 | 実行日時 |
| UrlFetchApp 例外 | `🔁 再実行 / <例外メッセージ抜粋>` | 空 | 実行日時 |
| 429 Rate Limit | Retry-After 尊重 → 指数バックオフ → リトライ | - | - |
| DKIM 全 28 セレクタ無応答 | 正常判定として処理 | BI: `❌ NG \| (レコード未検出)` | 実行日時 |
| 6 分タイムアウト直前 | 処理済み行まで書き込み・残行を `RESUME_ROWS` に保存 | - | - |

---

## 受け入れ基準 (Acceptance Criteria)

### AC-1: 対象範囲とドメイン正規化

- [ ] `gid=1728384105` のシートを `sheet.getSheetId()` 照合で取得している（シート名一致での取得は禁止）
- [ ] D 列が空でない行のみが処理対象になる
- [ ] ヘッダ行（1 行目）は処理対象外
- [ ] AC 列の値に `trim()` / 小文字化 / Punycode / URL ホスト抽出の正規化が適用される
- [ ] `https://carbuncle.biz/contact` 形式の入力から `carbuncle.biz` が抽出される
- [ ] AC 列が空の行はスキップされ、エラーログのみ出力（書き込みなし）

### AC-2: DNS 並列実行とチャンク制御

- [ ] DNS 解決に `UrlFetchApp.fetchAll()` を使用している（`UrlFetchApp.fetch()` の逐次呼び出しは禁止）
- [ ] fetchAll 安全チャンクが 100 件以下に制御されている
- [ ] DKIM が「プリスキャン 7 セレクタ → フォールバック 21 セレクタ」の 2 段階構造で実装されている
- [ ] プリスキャンで 1 件以上検出された場合、フォールバックはスキップされる

### AC-3: 結果書き込み（BG〜BK 5 列）

- [ ] `getValues()` → 加工 → `setValues()` の 3 ステップで一括書き込みされている
- [ ] セル単位 `setValue()` が使用されていない（grep で `.setValue(` がヒットしない、`setValues` を除く）
- [ ] BG 列に総合判定（`✅ OK 3/3` / `⚠️ 警告 2/3` / `❌ NG 0/3` / `🔁 再実行 / <理由>`）が書き込まれる
- [ ] BH/BI/BJ 列に各 SPF/DKIM/DMARC の `✅ OK \| <レコード>` または `❌ NG \| (レコード未検出)` 形式の結果が書き込まれる
- [ ] BK 列に `YYYY-MM-DD HH:mm` 形式の実行日時が書き込まれる
- [ ] 既存の BG〜BK 値は常に上書きされる（追記禁止）

### AC-4: カスタムメニューと UX

- [ ] `onOpen(e)` 関数が定義され、スプレッドシートを開いた時点でカスタムメニュー「メール認証チェック」が自動表示される
- [ ] メニュー項目が「▶ 選択行をチェック」「▶ 全営業リストをチェック」「─」「結果の見方」「履歴シートを開く」の順で表示される
- [ ] 開始時に `toast('チェック開始: N件')` が表示される
- [ ] 実行中、各チャンク処理直前に BG 列へ `⏳ 確認中...` がライブ書き込みされる
- [ ] 完了時に `toast('完了：OK X / 警告 Y / NG Z')` が表示される

### AC-5: 安全機構（Script Properties）

- [ ] `DRY_RUN = "true"` 時はセルへの書き込みが一切発生しない（`Logger.log` 出力のみ）
- [ ] `DRY_RUN = "true"` 時、進捗 `⏳ 確認中...` も書き込まれない
- [ ] `START_ROW` / `END_ROW` で行範囲を限定できる（範囲外の行は処理されない）
- [ ] `SHEET_GID` の値が対象シート ID として使用される（未設定時は `1728384105` がデフォルト）

### AC-6: エラーハンドリング

- [ ] NXDOMAIN 検出時、BG 列に `🔁 再実行 / ドメイン未登録` が書き込まれる
- [ ] ドメイン正規化失敗時、BG 列に `🔁 再実行 / ドメイン形式不正` が書き込まれる
- [ ] DNS API タイムアウト時、BG 列に `🔁 再実行 / DNSタイムアウト` が書き込まれる
- [ ] UrlFetchApp 例外時、BG 列に `🔁 再実行 / <例外メッセージ抜粋>` が書き込まれる
- [ ] HTTP 429 検出時、`Retry-After` ヘッダを尊重して指数バックオフでリトライする
- [ ] DKIM 全 28 セレクタで応答なしの場合、エラーではなく `❌ NG \| (レコード未検出)` が BI 列に書き込まれる（正常判定として扱う）
- [ ] エラー時も BK 列には実行日時が書き込まれる

### AC-7: 冪等性とパフォーマンス

- [ ] 同じ行を 2 回連続実行しても、結果（BG〜BJ）が同一になる（実行日時 BK のみ変化）
- [ ] 100 件の処理が 6 分以内に完走する（ローカル実測）
- [ ] 既知の正解 10 件（`google.com`, `gmail.com`, `microsoft.com`, `paypal.com`, `amazon.co.jp`, `github.com`, 自社ドメイン他）で SPF/DKIM/DMARC の判定が手動チェック結果と完全一致する

### AC-8: タイムアウト耐性

- [ ] 6 分タイムアウト直前に try/catch で処理を打ち切り、未処理行を `Script Properties.RESUME_ROWS` に JSON 形式で保存する
- [ ] 次回実行時に `RESUME_ROWS` が存在すれば、その行リストから処理を再開できる
- [ ] 中断時点で処理済みの行は BG〜BK にすべて書き込み済みである（半端な状態を残さない）

### AC-9: 既存資産の無改変

- [ ] `src/parsers/spf-parser.js` / `src/parsers/dkim-parser.js` / `src/parsers/dmarc-parser.js` のパース仕様が GAS 側で踏襲されている（判定ルール同一）
- [ ] `src/diagnosis/spf-diagnosis.js` / `src/diagnosis/dkim-diagnosis.js` / `src/diagnosis/dmarc-diagnosis.js` の診断ルールが GAS 側で踏襲されている
- [ ] `src/` 配下のファイルが Sprint 6 で 1 行も変更されていない（git diff で確認）

---

## NG 基準（即不合格）

以下が 1 件でも該当した場合、Evaluator は無条件で不合格を出す：

- `SpreadsheetApp.openById()` のスプレッドシート ID が `1-NbppSJfIXbUWnYUWvYa72W1Yx_kVnffBtXhZ-EpbAM` 以外
- 対象シート取得がシート名一致で行われている（gid 照合になっていない）
- `getValues()` → 加工 → `setValues()` の 3 ステップが守られていない（セル単位 setValue が使用されている）
- DNS 並列実行に `UrlFetchApp.fetchAll()` が使われていない
- fetchAll のチャンクサイズが 100 件を超えている
- `DRY_RUN = "true"` 時にセルへの書き込みが発生する
- 100 件処理が 6 分以内に完走しない
- 既存の `src/` 配下に 1 行でも変更がある
- カスタムメニューが `onOpen` で自動表示されない
- 同じ行を 2 回実行して結果（BG〜BJ）が変わる（冪等性違反）
- DKIM 全 28 セレクタ無応答が「エラー」扱いになっている（`🔁 再実行` 系の BG に書かれている）

---

## 想定ファイル構成

```
gas/
├── Code.gs                  # エントリポイント・onOpen・メニューハンドラ
├── Config.gs                # SHEET_ID / SHEET_GID / DNS_API_URL / DKIM セレクタ定数
├── DnsResolver.gs           # UrlFetchApp.fetchAll ラッパー・並列 DNS クエリ
├── SpfChecker.gs            # SPF パース・診断（src/parsers/spf-parser.js 移植）
├── DkimChecker.gs           # DKIM パース・診断・プリスキャン/フォールバック制御
├── DmarcChecker.gs          # DMARC パース・診断
├── DomainNormalizer.gs      # trim/lower/punycode/URL ホスト抽出
├── SheetIo.gs               # シート取得（gid 照合）・getValues/setValues
├── BulkRunner.gs            # 全行・選択行ループ・チャンク制御・進捗 toast
├── ResumeManager.gs         # 6 分タイムアウト時の中断・再開ロジック
└── appsscript.json          # マニフェスト（タイムゾーン・スコープ）
```

※ GAS は `.gs` 拡張子だが内容は JavaScript。クラスやモジュール構文の代わりにグローバル関数を名前空間プレフィックスで分ける（例: `DkimChecker_preScan()`）。

---

## 受入テストシナリオ

### シナリオ 1: DRY_RUN 試験実行

1. Script Properties で `DRY_RUN = "true"`, `START_ROW = "2"`, `END_ROW = "6"` をセット
2. メニュー「▶ 全営業リストをチェック」を実行
3. Logger に 5 行分のドメイン正規化結果・DNS 応答・判定結果が出力される
4. シート上の BG〜BK 列は **1 セルも変更されていない**

### シナリオ 2: 選択行チェック

1. Script Properties で `DRY_RUN = "false"`、`START_ROW` / `END_ROW` を削除
2. シート上で 10〜15 行目（5 行）を選択
3. メニュー「▶ 選択行をチェック」を実行
4. toast「チェック開始: 5 件」が表示される
5. 各行の BG に `⏳ 確認中...` が順次表示され、処理完了後に判定結果に置換される
6. toast「完了：OK X / 警告 Y / NG Z」が表示される
7. 11〜14 行目（範囲外）の BG〜BK は変更されていない

### シナリオ 3: 全営業リスト一括チェック（100 件）

1. D 列に値が入った 100 行のテストデータでメニュー「▶ 全営業リストをチェック」を実行
2. 6 分以内に完走する
3. すべての対象行の BG〜BK が埋まる
4. AC 列が空の行はスキップされ、書き込みが発生していない

### シナリオ 4: NXDOMAIN ハンドリング

1. AC 列に `nonexistent-domain-xyz-12345.example` を入力した行を準備
2. 該当行を選択して「▶ 選択行をチェック」を実行
3. BG 列に `🔁 再実行 / ドメイン未登録` と書き込まれる
4. BH/BI/BJ は空、BK には実行日時が書き込まれる

### シナリオ 5: 冪等性確認

1. 同一行を「▶ 選択行をチェック」で連続 2 回実行
2. 1 回目と 2 回目の BG/BH/BI/BJ がすべて同一文字列
3. BK のみ実行日時が更新されている

### シナリオ 6: DKIM プリスキャン最適化

1. Google Workspace を使用しているドメイン（プリスキャンの `google` セレクタで検出可能）を入力
2. 実行後、Logger に「プリスキャンで検出: google」のログが出力される
3. フォールバック 21 セレクタへのクエリが発火していない（fetchAll が 1 回しか呼ばれない）

### シナリオ 7: 6 分タイムアウト復帰

1. テスト用に `MAX_EXECUTION_SECONDS` を 30 秒に一時的に短縮
2. 50 行のデータで全量チェックを実行
3. 30 秒経過時点で処理が中断され、未処理行が Script Properties `RESUME_ROWS` に JSON 保存される
4. 処理済み行までは BG〜BK が正常に埋まっている
5. メニューを再実行すると、`RESUME_ROWS` の行から処理が再開される

### シナリオ 8: 既知正解 10 件の判定精度

1. 以下 10 ドメインを AC 列に入力した行を準備:
   - `google.com` / `gmail.com` / `microsoft.com` / `github.com` / `paypal.com`
   - `amazon.co.jp` / 自社ドメイン / `yahoo.co.jp` / `apple.com` / `cloudflare.com`
2. 全行をチェック実行
3. すべての行で SPF/DKIM/DMARC の判定が事前準備した手動チェック結果と完全一致する

---

## 工数見積もり

| フェーズ | 想定工数 | 内訳 |
|---|---|---|
| Generator（実装） | **2〜3 時間** | GAS プロジェクト初期化 / 既存 JS ロジック移植 / fetchAll 並列化 / シート IO / メニュー / Script Properties / エラーハンドリング |
| Designer | **0.5 時間** | toast 文言・メニュー文言・結果文字列フォーマットの最終調整（UI 自体は GAS なので軽量） |
| Evaluator | **1〜1.5 時間** | DRY_RUN 試験 → 既知正解 10 件検証 → 100 件パフォーマンス測定 → NXDOMAIN / 冪等性 / タイムアウト復帰確認 |
| **合計** | **3.5〜5 時間** | |

ボトルネック想定: DKIM プリスキャン/フォールバック 2 段階制御のロジック、6 分タイムアウト復帰機構。両方とも実装難度より「正しく動くまで検証する」コストが大きい。

---

## デプロイ手順（参考）

1. Generator が `gas/` 配下にスクリプトを実装し、`clasp push` で GAS プロジェクトへアップロード（または手動コピペ）
2. 対象スプレッドシート（`1-NbppSJfIXbUWnYUWvYa72W1Yx_kVnffBtXhZ-EpbAM`）の「拡張機能 > Apps Script」を開く
3. スクリプトを貼り付けて保存
4. マニフェスト `appsscript.json` のスコープ確認（`script.external_request`, `spreadsheets`, `script.scriptapp`）
5. 初回実行時に OAuth 同意画面で社長アカウントが承認
6. Script Properties で `DRY_RUN = "true"` をセットして試験実行（シナリオ 1）
7. 問題なければ `DRY_RUN = "false"` で全量実行
