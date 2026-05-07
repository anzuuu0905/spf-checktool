# テスト実行ガイド — Sprint 1

## TDD Red フェーズ（現在の状態）

このプロジェクトは **TDD Red フェーズ** です。実装コードがまだ存在しないため、**全テストがFAIL状態**になります。

これは正常な状態です。テストコードは「実装すべき仕様」を明確に示すドキュメントの役割を果たしています。

---

## セットアップ

```bash
# 依存パッケージをインストール
npm install

# Playwrightブラウザをインストール
npx playwright install
```

---

## テスト実行コマンド

### ユニットテスト（Vitest）

```bash
# 全ユニットテストを実行（現時点では全FAIL）
npm test

# ウォッチモードで実行
npm test -- --watch

# UIモードで実行
npm run test:ui

# カバレッジ計測（現時点では0%）
npm run test:coverage
```

### E2Eテスト（Playwright）

```bash
# 全E2Eテストを実行（現時点では全FAIL）
npm run test:e2e

# UIモードで実行
npm run test:e2e:ui

# 特定のブラウザのみ実行
npm run test:e2e -- --project="Desktop Chrome"
```

---

## テスト構成

### ユニットテスト（95% カバレッジ目標）

- **パーサー**:
  - `/tests/unit/parsers/spf-parser.test.js`
  - `/tests/unit/parsers/dkim-parser.test.js`
  - `/tests/unit/parsers/dmarc-parser.test.js`

- **診断ロジック**:
  - `/tests/unit/diagnosis/spf-diagnosis.test.js`
  - `/tests/unit/diagnosis/dkim-diagnosis.test.js`
  - `/tests/unit/diagnosis/dmarc-diagnosis.test.js`

- **フォーマッター**:
  - `/tests/unit/formatters/beginner-formatter.test.js`

- **API**:
  - `/tests/unit/api/dns-resolver.test.js`

### E2Eテスト（Sprint 1 受け入れ基準 100% カバー）

- `/tests/e2e/user-flow.spec.js`
  - 画面表示（5項目）
  - レスポンシブレイアウト（3項目）
  - ドメイン入力と診断開始（6項目）
  - SPF診断結果（4項目）
  - DKIM診断結果（4項目）
  - DMARC診断結果（4項目）
  - CTAと誘導（5項目）
  - エラーハンドリング（3項目）
  - パフォーマンス要件（5項目）

---

## 次のステップ（Phase 3: 実装フェーズ）

1. **@jisso による実装**:
   - `src/` ディレクトリに実装コードを作成
   - テストをグリーンにする最小実装を行う

2. **テスト実行**:
   - `npm test` でユニットテストが全PASS
   - `npm run test:coverage` でカバレッジ95%以上達成
   - `npm run test:e2e` でE2Eテストが全PASS

3. **Phase 4: デザインフェーズ**:
   - @designer がデザイントークンを適用
   - 機能を壊さずにUIを仕上げる

4. **Phase 5: 評価フェーズ**:
   - @evaluator がPlaywright MCPで実機テスト
   - Sprint 1 の全受け入れ基準を検証

---

## トラブルシューティング

### テストが全FAIL する

**正常です**。TDD Red フェーズのため、実装コードが存在せず、全テストがFAILします。

### E2Eテストでサーバーが起動しない

`npm run dev` で開発サーバーが起動することを確認してください。Playwright は自動的にサーバーを起動しますが、`package.json` の設定が正しいか確認してください。

### カバレッジが0%

**正常です**。実装コードが存在しないため、カバレッジは0%です。

---

## 参照

- テスト仕様書: `/docs/test-spec.md`
- Sprint 1 仕様: `/docs/sprints/sprint-1.md`
- 初心者向け説明文: `/docs/beginner-explanations.md`
