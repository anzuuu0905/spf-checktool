# Contributing to SPF Check Tool

プロジェクトへの貢献ありがとうございます。

## 貢献方法

### 1. Issue の作成

バグ報告や機能要望は、まず Issue を作成してください。

- **バグ報告**: `.github/ISSUE_TEMPLATE/bug.md` のテンプレートを使用
- **機能要望**: `.github/ISSUE_TEMPLATE/feature.md` のテンプレートを使用

### 2. Pull Request の作成

#### 2.1 ブランチ戦略

- `main`: 本番リリース用（直接 push 禁止）
- `develop`: 開発用のメインブランチ
- `feature/*`: 新機能開発用
- `fix/*`: バグ修正用
- `hotfix/*`: 緊急の本番修正用

#### 2.2 PR の手順

1. リポジトリをフォーク
2. 新しいブランチを作成
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. 変更を加える
4. テストを実行して全てパス
   ```bash
   npm test
   npm run test:e2e
   ```
5. コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に従う
   ```bash
   git commit -m "feat(diagnosis): add DMARC validation logic"
   ```
6. PR を作成（`.github/PULL_REQUEST_TEMPLATE.md` に従う）

#### 2.3 PR のサイズ

- **400 行以下を推奨**（レビュアの認知負荷を最小化）
- 巨大な PR は複数に分割してください

#### 2.4 コミットメッセージの形式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: コードスタイル変更（動作に影響なし）
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルド・ツール変更

**scope**: 変更範囲（例: `diagnosis`, `ui`, `api`）

**subject**: 変更の簡潔な説明（50文字以内）

### 3. コードレビュー

- 最低 1 人のレビューが必要
- レビュー観点: 正確性 / 保守性 / セキュリティ / パフォーマンス

### 4. マージ戦略

- **Squash and merge** を既定とする
- feature → develop / develop → main のマージ時

## 開発環境のセットアップ

### 前提条件

- Node.js 18.x 以上
- npm 11.x 以上

### セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/spf-checktool.git
cd spf-checktool

# 依存パッケージのインストール
npm install

# 開発サーバーの起動
npm run dev
```

### テスト

```bash
# 単体テスト
npm test

# E2Eテスト
npm run test:e2e

# カバレッジレポート
npm run test:coverage
```

## セキュリティ

セキュリティ関連の問題を発見した場合は、[SECURITY.md](.github/SECURITY.md) に従って報告してください。

## ライセンス

このプロジェクトは MIT License の下で公開されています。貢献したコードも同じライセンスの下で提供されます。
