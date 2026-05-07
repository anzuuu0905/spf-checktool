# QA テスト設計完了 — SPRINT-1

## テスト設計フェーズ（TDD Red）完了

Sprint 1 の 45 項目の受け入れ基準を 100% カバーするテストコードを作成しました。

---

## テストファイル一覧

### テスト仕様書
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/docs/test-spec.md`

### E2Eテスト（Playwright）
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/e2e/user-flow.spec.js`
  - 画面表示: 5項目
  - レスポンシブ: 3項目
  - ドメイン入力: 6項目
  - SPF診断: 4項目
  - DKIM診断: 4項目
  - DMARC診断: 4項目
  - CTA誘導: 5項目
  - エラー処理: 3項目
  - パフォーマンス: 5項目
  - **合計: 39テストケース**

### ユニットテスト（Vitest）

#### パーサー
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/parsers/spf-parser.test.js` (9テスト)
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/parsers/dkim-parser.test.js` (9テスト)
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/parsers/dmarc-parser.test.js` (12テスト)

#### 診断ロジック
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/diagnosis/spf-diagnosis.test.js` (8テスト)
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/diagnosis/dkim-diagnosis.test.js` (7テスト)
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/diagnosis/dmarc-diagnosis.test.js` (8テスト)

#### フォーマッター
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/formatters/beginner-formatter.test.js` (9テスト)

#### API
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/tests/unit/api/dns-resolver.test.js` (9テスト)

**ユニットテスト合計: 71テストケース**

---

## 設定ファイル

- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/vitest.config.js` — Vitest設定（カバレッジ95%目標）
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/playwright.config.js` — Playwright設定（3ブレークポイント）
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/package.json` — 依存関係とスクリプト
- `/Volumes/SSD/company/projects/products/20260506_spf-checktool/.gitignore` — Git除外設定

---

## テスト実行方法

```bash
# 依存パッケージをインストール
npm install

# Playwrightブラウザをインストール
npx playwright install

# ユニットテストを実行
npm test

# E2Eテストを実行
npm run test:e2e

# カバレッジ計測
npm run test:coverage
```

---

## FAIL 確認

### 現在の状態（TDD Red フェーズ）

- **実装コードが存在しない**: `src/` ディレクトリは空
- **全テストがFAIL状態**: 想定通り
- **カバレッジ: 0%**: 実装前のため正常

### FAIL 確認コマンド

```bash
# 簡易確認スクリプト
cd /Volumes/SSD/company/projects/products/20260506_spf-checktool
./tests/verify-red-phase.sh
```

---

## テストカバレッジ

### Sprint 1 受け入れ基準とのマッピング

| カテゴリ | 受け入れ基準数 | テストケース数 | カバー率 |
|---|---|---|---|
| 画面表示 | 5 | 5 | 100% |
| レスポンシブ | 3 | 3 | 100% |
| ドメイン入力 | 6 | 6 | 100% |
| SPF診断 | 4 | 4 | 100% |
| DKIM診断 | 4 | 4 | 100% |
| DMARC診断 | 4 | 4 | 100% |
| CTA誘導 | 5 | 5 | 100% |
| エラー処理 | 3 | 3 | 100% |
| パフォーマンス | 5 | 5 | 100% |
| **合計** | **39** | **39** | **100%** |

### ユニットテスト範囲

- **SPFパーサー**: 9テストケース（メカニズム抽出、バリデーション）
- **DKIMパーサー**: 9テストケース（鍵長検証、バリデーション）
- **DMARCパーサー**: 12テストケース（ポリシー抽出、バリデーション）
- **SPF診断**: 8テストケース（設定判定、説明文生成）
- **DKIM診断**: 7テストケース（設定判定、鍵長警告）
- **DMARC診断**: 8テストケース（設定判定、ポリシー評価）
- **初心者向けフォーマッター**: 9テストケース（説明文一致確認）
- **DNS Resolver**: 9テストケース（API呼び出し、エラー処理）

---

## Generator への引き継ぎ

### Phase 3 (@jisso) への依頼内容

以下のテストを全てグリーンにする最小実装を行ってください:

1. **パーサー実装**:
   - `src/parsers/spf-parser.js`
   - `src/parsers/dkim-parser.js`
   - `src/parsers/dmarc-parser.js`

2. **診断ロジック実装**:
   - `src/diagnosis/spf-diagnosis.js`
   - `src/diagnosis/dkim-diagnosis.js`
   - `src/diagnosis/dmarc-diagnosis.js`

3. **フォーマッター実装**:
   - `src/formatters/beginner-formatter.js`

4. **API実装**:
   - `src/api/dns-resolver.js`

5. **UIコンポーネント実装**:
   - `src/index.html` — HTML構造
   - `src/main.js` — メインロジック
   - `src/style.css` — 最低限のスタイル（Designer が磨く）

### 成功条件

```bash
# 全ユニットテストが PASS
npm test
# ✅ 71 passed

# カバレッジ 95% 以上
npm run test:coverage
# ✅ Lines: 95%+ | Functions: 95%+ | Branches: 95%+ | Statements: 95%+

# 全E2Eテストが PASS
npm run test:e2e
# ✅ 39 passed
```

---

## 品質基準

- **QS-2.1 カバレッジ**: 95% 以上（必達）
- **QS-4.1 WCAG 2.2 AA**: Playwrightで自動チェック
- **QS-4.2 レスポンシブ**: 3ブレークポイント対応
- **QS-4.5 Core Web Vitals**: Lighthouse CI で測定

---

## 参照

- **テスト仕様書**: `/docs/test-spec.md`
- **Sprint 1 仕様**: `/docs/sprints/sprint-1.md`
- **初心者向け説明文**: `/docs/beginner-explanations.md`
- **テスト実行ガイド**: `/tests/README.md`

---

## 次フェーズ

✅ **Phase 2 (Evaluator テスト設計)**: 完了
⏳ **Phase 3 (@jisso 実装)**: 開始可能
⏳ **Phase 4 (@designer UI仕上げ)**: Phase 3 完了後
⏳ **Phase 5 (@evaluator 評価)**: Phase 4 完了後
