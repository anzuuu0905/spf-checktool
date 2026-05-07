# Agent Quartet - Company Video Platform

4つの専門エージェントによる協調的な開発ワークフロー

## エージェント構成

### 1. 🟢 Planner（プランナー）
- **役割**: 製品仕様書とスプリント計画の作成
- **モデル**: Opus 4.7
- **入力**: 短いプロンプト（1〜4行）
- **出力**:
  - `/docs/spec.md` - 製品仕様書
  - `/docs/sprints/sprint-N.md` - スプリント計画と契約

**使用例:**
```
「動画をアップロードして共有できる企業向けプラットフォームを作りたい」
```

### 2. 🟠 Generator（実装エージェント）
- **役割**: スプリント契約に基づいた機能実装
- **モデル**: Opus 4.7
- **入力**: Plannerが作成したスプリント契約
- **出力**: 動作する実装（UIは最低限）

**重要ルール:**
- スタブやTODOを残さない
- エラーハンドリングを省略しない
- スプリント契約の全条件を満たす

### 3. 🟣 Designer（デザインエージェント）
- **役割**: UIの視覚的な仕上げ
- **モデル**: Opus 4.7
- **MCP**: Playwright（スクリーンショット確認用）
- **入力**:
  - Generatorが実装した機能コード
  - `/docs/design-tokens.md` - デザイントークン
  - `/docs/design-references/` - 参考画像
- **出力**: 洗練されたUI（機能は維持）

**重要ルール:**
- 機能を壊さない
- デザイントークンに従う
- AIスロップを避ける（紫グラデーション、無意味なカードグリッド等）

### 4. 🔴 Evaluator（評価エージェント）
- **役割**: 厳格な品質評価
- **モデル**: Opus 4.7
- **MCP**: Playwright（実際のテスト実行用）
- **入力**: Designerが仕上げたアプリケーション
- **出力**:
  - 合格/不合格判定
  - フィードバック（Generator/Designerへルーティング）

**評価基準:**
- 機能テスト: スプリント契約条件の全確認
- デザイン評価: 4基準×7/10以上必須
  - Design Quality（デザイン品質）
  - Originality（独創性）
  - Craft（仕上げの丁寧さ）
  - Functionality（機能性）
- エッジケーステスト

## ワークフロー

```
1. Planner
   ↓ (仕様書 + スプリント契約)
2. Generator
   ↓ (動く実装)
3. Designer
   ↓ (洗練されたUI)
4. Evaluator
   → 合格 → 次のスプリントへ
   → 不合格 → Generator/Designerへフィードバック
```

## プロジェクト構造

```
company_video_platform/
├── .claude/
│   └── agents/
│       ├── planner.md      # 🟢 プランナー
│       ├── generator.md    # 🟠 実装エージェント
│       ├── designer.md     # 🟣 デザインエージェント
│       ├── evaluator.md    # 🔴 評価エージェント
│       └── README.md       # このファイル
│
├── docs/
│   ├── spec.md                      # 製品仕様書（Plannerが生成）
│   ├── design-tokens.md             # デザイントークン（Designerが参照）
│   ├── design-references/           # 参考画像（Designerが参照）
│   └── sprints/
│       ├── sprint-1.md              # Sprint 1 計画と契約
│       ├── sprint-2.md              # Sprint 2 計画と契約
│       └── ...
│
├── src/                             # ソースコード（Generatorが実装）
└── tests/                           # テスト（Generatorが作成）
```

## 使い方

### Step 1: プロジェクト企画
Plannerエージェントに短いプロンプトを送る:
```
「社内向け動画共有プラットフォーム。
アップロード、再生、コメント、いいね機能が必要」
```

Plannerが以下を生成:
- `/docs/spec.md` - 製品仕様書
- `/docs/sprints/sprint-1.md` - Sprint 1の計画
- `/docs/sprints/sprint-2.md` - Sprint 2の計画
- ...

### Step 2: 実装
Generatorエージェントに「Sprint 1を実装して」と指示:
```
「Sprint 1を実装してください」
```

Generatorが:
- スプリント契約の全条件を満たす実装を作成
- テストを作成
- 完了報告を出力

### Step 3: デザイン仕上げ
Designerエージェントに「UIを仕上げて」と指示:
```
「UIを仕上げてください」
```

Designerが:
- デザイントークンを適用
- レスポンシブ対応
- 視覚的な一貫性を確保
- 完了報告を出力

### Step 4: 品質評価
Evaluatorエージェントに「評価して」と指示:
```
「Sprint 1を評価してください」
```

Evaluatorが:
- スプリント契約条件を全チェック
- デザイン4基準を評価
- エッジケースをテスト
- 合格/不合格を判定

### Step 5: 次のスプリントへ
合格したら次のスプリントへ。不合格ならフィードバックに基づいて修正。

## 重要な原則

### Planner
- 「何を作るか」に集中（「どう作るか」は書かない）
- テスト可能な具体的条件を書く
- 実装詳細（DB設計、API設計等）は避ける

### Generator
- 動くものを作る（スタブ・TODOは禁止）
- エラーハンドリングを省略しない
- スプリント契約の全条件を満たす
- UIは最低限でOK（Designerが磨く）

### Designer
- 機能を壊さない（最優先）
- デザイントークンに従う
- AIスロップを避ける
- レスポンシブ対応必須

### Evaluator
- 懐疑的であれ（甘い評価は禁止）
- 1つでも条件未達 → 不合格
- デザイン7/10未満 → 不合格
- フィードバックは具体的に

## Tips

1. **スプリントは小さく**: 2〜4機能/スプリントが理想
2. **契約条件は明確に**: 「UIが直感的」ではなく「ドラッグ＆ドロップで並べ替えができる」
3. **デザイントークンを最初に決める**: 後から変更すると大変
4. **Evaluatorの評価は厳しく**: 品質基準を下げない

## トラブルシューティング

### スプリント契約が曖昧
→ Plannerに「もっと具体的に」と指示

### Generatorが機能を省略
→ スプリント契約の条件を増やす

### Designerの変更で機能が壊れた
→ Evaluatorが検出 → フィードバック

### Evaluatorが厳しすぎる
→ それが正常。品質基準を下げない

## 参考

元ネタ: [agent-quartet-harness](https://github.com/Shin-sibainu/agent-quartet-harness)

## ライセンス

このプロジェクト専用のエージェント設定です。
