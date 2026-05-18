# SPF/DKIM/DMARC 一括チェック GAS

Sprint 6 で実装した Google Apps Script 版の SPF/DKIM/DMARC 一括診断ツール。
営業分析スプレッドシート上で「メール認証チェック」メニューからワンクリック実行できる。

## 構成

```
gas/
├── appsscript.json     manifest (timezone, scopes)
├── Code.gs             エントリポイント (onOpen / runCheckAll / runCheckSelected / testDryRun 等)
├── Config.gs           定数 / Script Properties 取得
├── DomainNormalizer.gs ドメイン正規化 (trim/lower/URL抽出/Punycode)
├── SheetIO.gs          シート I/O (gid照合・getValues/setValues バッチ)
├── DnsResolver.gs      UrlFetchApp.fetchAll DNS クエリ・チャンク制御・指数バックオフ
├── SpfParser.gs        SPF パーサ (src/parsers/spf-parser.js 移植)
├── DkimParser.gs       DKIM パーサ (src/parsers/dkim-parser.js 移植)
├── DmarcParser.gs      DMARC パーサ (src/parsers/dmarc-parser.js 移植)
├── SpfDiagnosis.gs     SPF 診断 (src/diagnosis/spf-diagnosis.js 移植)
├── DkimDiagnosis.gs    DKIM 診断 (src/diagnosis/dkim-diagnosis.js 移植)
├── DmarcDiagnosis.gs   DMARC 診断 (src/diagnosis/dmarc-diagnosis.js 移植)
├── BulkRunner.gs       一括実行・進捗 toast・タイムアウト復帰
└── README.md           本ファイル
```

## 設置手順

1. 対象スプレッドシートを開く
   `https://docs.google.com/spreadsheets/d/1-NbppSJfIXbUWnYUWvYa72W1Yx_kVnffBtXhZ-EpbAM/edit`
2. メニュー「拡張機能 → Apps Script」を開く
3. デフォルトの `Code.gs` を削除
4. このディレクトリ配下の各 `.gs` / `appsscript.json` を Apps Script エディタにコピペ
   - `appsscript.json` は「プロジェクトの設定」→「マニフェスト ファイル」を表示してから貼り付け
   - もしくは `clasp push` を利用（後述）
5. 保存（Ctrl+S / Cmd+S）
6. スプレッドシートを再読み込みすると「メール認証チェック」メニューが表示される
7. 初回実行時に OAuth 同意画面が表示されるので承認

### clasp を使う場合

```bash
cd gas
clasp create --type sheets --title 'SPF DKIM DMARC 一括チェック' \
  --parentId 1-NbppSJfIXbUWnYUWvYa72W1Yx_kVnffBtXhZ-EpbAM
clasp push
```

## 使い方

### 通常実行

1. 対象シート（gid=1728384105 / 「特典３：あなたの営業の改善点を丸裸にする営業分析ツール_営業分析中（最新）」）を開く
2. メニュー「メール認証チェック」を開く
3. 用途に応じて選ぶ
   - **▶ 選択行をチェック** — 任意の行を選択（Shift+クリックで複数選択 OK）してから実行
   - **▶ 全営業リストをチェック** — D 列に値の入った全行を一括処理

### 結果の見方

| 列 | 内容 | 例 |
|---|---|---|
| BG | 総合判定 | `✅ OK 3/3` / `⚠️ 警告 2/3` / `❌ NG 0/3` / `🔁 再実行 / <理由>` |
| BH | SPF | `✅ OK \| v=spf1 include:_spf.google.com ~all` |
| BI | DKIM | `✅ OK [google] \| v=DKIM1; k=rsa; p=...` / `❌ NG \| (レコード未検出)` |
| BJ | DMARC | `✅ OK \| v=DMARC1; p=quarantine; rua=mailto:...` |
| BK | 実行日時 | `2026-05-18 11:30` |

メニュー「結果の見方」でも凡例ダイアログを開ける。

## DRY_RUN 試験フロー（初回検証）

社長が初めて本ツールを動かす際の安全確認手順。

1. GAS エディタの「プロジェクトの設定」→「スクリプト プロパティ」を開く
2. 以下 3 件を追加
   - `DRY_RUN` = `true`
   - `START_ROW` = `2`
   - `END_ROW` = `6`
3. スプレッドシートに戻り、メニュー「メール認証チェック → ▶ 全営業リストをチェック」を実行
4. GAS エディタの「実行履歴」または `表示 → ログ` を開いて Logger 出力を確認
   - 5 行分のドメイン正規化結果・DNS 応答・判定結果が出力される
   - シート上の BG〜BK 列は **1 セルも変更されていない**ことを確認
5. 問題なければ Script Properties から `DRY_RUN` / `START_ROW` / `END_ROW` を削除
6. メニューから本番実行

### より細かい単体テスト

GAS エディタで関数を選択して実行できる単体テスト：

- `testDryRun` — 既知正解 10 件（google.com / gmail.com / microsoft.com 等）の判定結果を Logger 出力
- `testNormalizer` — ドメイン正規化の動作確認
- `testParseAndDiagnose` — DNS クエリなしでパーサ・診断ロジックの動作確認
- `testIdempotency` — 同一ドメインを 2 回処理して結果が変わらないことを確認（bg/bh/bi/bj 比較）

## Script Properties リファレンス

| プロパティ名 | 型 | 用途 | デフォルト |
|---|---|---|---|
| `DRY_RUN` | string `"true"` / `"false"` | `"true"` 時はセル書き込みをスキップし `Logger.log` に結果出力 | `"false"` |
| `START_ROW` | string（整数） | この行から処理開始 | `2`（ヘッダ除外） |
| `END_ROW` | string（整数） | この行で処理終了（含む） | 末尾行 |
| `SHEET_GID` | string（整数） | 対象シートの gid | `1728384105` |
| `RESUME_ROWS` | string（JSON配列） | 6 分タイムアウト時の未処理行リスト（自動セット） | 未設定 |
| `MAX_EXECUTION_SECONDS` | string（整数） | デバッグ用に実行上限を短縮 | `360` |

## エラーハンドリング規約

| 状況 | BG | BH/BI/BJ | BK |
|---|---|---|---|
| 正常終了 | `✅ OK 3/3` / `⚠️ 警告 2/3` / `❌ NG 0/3` 等 | 各レコード判定 | 実行日時 |
| AC 列空 | 書き込みなし（スキップ） | - | - |
| ドメイン形式不正 | `🔁 再実行 / ドメイン形式不正` | 空 | 実行日時 |
| ドメイン未登録 (NXDOMAIN) | `🔁 再実行 / ドメイン未登録` | 空 | 実行日時 |
| DNS タイムアウト | `🔁 再実行 / DNSタイムアウト` | 空 | 実行日時 |
| DNS 応答なし / 通信エラー | `🔁 再実行 / DNS応答なし` | 空 | 実行日時 |
| レート制限（リトライ枯渇後） | `🔁 再実行 / レート制限` | 空 | 実行日時 |
| DKIM 全 28 セレクタ無応答 | 正常判定として処理 | BI: `❌ NG \| (レコード未検出)` | 実行日時 |

## トラブル時の対処

### Q. 「対象シート（gid=...）が見つかりません」

- スプレッドシート ID または gid が間違っている可能性
- 「拡張機能 → Apps Script → 設定 → スクリプト プロパティ」で `SHEET_GID` を確認
- 対象シートを開いた状態の URL から `gid=` のあとの数値を確認

### Q. レート制限が頻発する

- Google Public DNS は無料枠でレート制限が発動することがある
- `▶ 選択行をチェック` で 20〜30 行ずつに分けて実行する
- もしくは数分待ってから再実行

### Q. 「6 分タイムアウト」で中断された

- Script Properties に `RESUME_ROWS` が自動保存される
- メニュー「▶ 全営業リストをチェック」を再実行すると「続きから処理しますか？」と尋ねられるので「はい」を選択
- 全件処理し直したい場合は「いいえ」を選択（`RESUME_ROWS` がクリアされる）

### Q. 結果が「🔁 再実行」だらけになる

- ネットワーク障害または DNS API レート制限の可能性
- 数分置いて再実行
- 続く場合は GAS エディタの「実行履歴」でエラー詳細を確認

### Q. DKIM が誤って「未検出」になる

- DKIM は 28 セレクタ辞書方式のため、辞書外のサービス（さくらインターネット・ロリポップ・Amazon SES の独自セレクタ等）は検出不可
- DKIM のみ「❌ NG | (レコード未検出)」が出ても、誤検出ではなく辞書外の可能性が高い
- Web 版チェッカー（`dist/index.html`）でカスタムセレクタを指定して再確認可能

### Q. 既存の BG〜BK の値を保持したい

- 仕様上、毎回上書き
- 履歴を取りたい場合は別シートに過去結果をコピーしておく

## アーキテクチャ要点

### DKIM 2 段階最適化

28 セレクタを一気にクエリせず、メジャー設定（プリスキャン 7）を先行させる:

- プリスキャン: `default`, `google`, `selector1`, `selector2`, `k1`, `s1`, `mail`
- フォールバック: 残り 21 セレクタ（Google 年月セレクタ・Mailchimp/HubSpot/Zoho/ProtonMail 等）

プリスキャンで 1 件でも検出されればフォールバックはスキップされ、クエリ数を最大 28→7 まで削減。

### fetchAll チャンク制御

- 1 fetchAll = 最大 100 リクエスト
- 100 ドメイン処理時は SPF(2 リクエスト) + DMARC(1) + DKIM 平均(7〜15) ≈ 10〜18 / ドメイン
- → 100 ドメインで合計 1,000〜1,800 リクエスト = 10〜18 チャンク
- チャンク間に 500ms スリープを入れてレート制限を緩和

### タイムアウト復帰

- 各バッチ処理前に経過時間を計測
- 残時間 < 30 秒で中断
- 未処理行を `Script Properties.RESUME_ROWS` に JSON 保存
- 次回実行時に「続きから処理しますか？」ダイアログで再開可能

## 既存資産の取り扱い

- `src/parsers/*.js`, `src/diagnosis/*.js` のロジックは GAS 版に「コードを写経して移植」した
- 判定ルール（include 数のしきい値、qualifier の評価、DKIM 鍵長推定、DMARC ポリシー評価）は無改変
- Sprint 6 では `src/` 配下を 1 行も変更していない
