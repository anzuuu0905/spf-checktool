# SPF Check Tool

中小企業経営者向けのメール配信設定診断ツール

## 概要

ドメイン名を入力するだけでSPF/DKIM/DMARCの設定状況を診断し、問題がある場合は専門家への相談を促すリードジェネレーションツールです。

## ターゲットユーザー

- 税理士のクライアント企業（従業員50名以下の中小企業経営者）
- 「メールが届かない」「迷惑メールに入る」問題を抱えている
- IT専門知識がない、SPF/DKIM/DMARCという言葉を初めて聞くレベル

## 主な機能

- ドメイン入力による簡単診断
- SPF/DKIM/DMARC設定の自動チェック
- 初心者向けの分かりやすい診断結果表示
- 問題発見時の専門家相談への誘導（CTA）
- レスポンシブ対応（スマホ/タブレット/PC）

## 技術スタック

- **フロントエンド**: 静的HTML + Vanilla JavaScript + CSS
- **DNS検証**: Google Public DNS API (`dns.google.com`)
- **テスト**: Vitest（単体テスト）+ Playwright（E2Eテスト）
- **ビルドツール**: Vite
- **デプロイ**: Netlify または Vercel（静的ホスティング）

## セットアップ

### 前提条件

- Node.js 18.x 以上
- npm 11.x 以上

### インストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスします。

### ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに生成されます。

### テスト

```bash
# 単体テスト
npm test

# 単体テスト（UIモード）
npm run test:ui

# E2Eテスト
npm run test:e2e

# E2Eテスト（UIモード）
npm run test:e2e:ui

# カバレッジレポート
npm run test:coverage
```

## プロジェクト構成

```
.
├── docs/                   # 仕様書・スプリント計画
│   ├── spec.md            # 製品仕様書
│   └── sprints/           # スプリント計画
├── src/                    # ソースコード
├── tests/                  # テストコード
├── dist/                   # ビルド成果物（gitignore）
└── index.html             # エントリーポイント
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

## 貢献

プロジェクトへの貢献方法については [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## セキュリティ

脆弱性を発見した場合は [SECURITY.md](.github/SECURITY.md) に従って報告してください。
