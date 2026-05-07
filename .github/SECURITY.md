# Security Policy

## Supported Versions

現在サポートされているバージョン:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

セキュリティ脆弱性を発見した場合は、以下の手順で報告してください。

### 報告方法

**公開 Issue では報告しないでください。**

以下の方法で非公開で報告してください:

1. **GitHub Security Advisory** (推奨)
   - リポジトリの "Security" タブから "Report a vulnerability" を選択
   - フォームに従って詳細を記入

2. **メール**
   - 送信先: security@example.com
   - 件名: `[Security] SPF Check Tool - [簡潔な脆弱性の説明]`

### 報告に含めるべき情報

- 脆弱性の詳細な説明
- 再現手順
- 影響範囲（どのバージョンが影響を受けるか）
- 可能であれば、修正案や回避策

### 報告後のプロセス

1. **48時間以内**: 報告の受領確認
2. **1週間以内**: 脆弱性の評価と初期対応方針の連絡
3. **修正完了後**:
   - パッチのリリース
   - CHANGELOG.md の `Security` セクションに記載
   - GitHub Security Advisory で公開

## セキュリティベストプラクティス

このプロジェクトでは以下のセキュリティ対策を実施しています:

- ✅ Dependabot による依存パッケージの脆弱性監視
- ✅ Secret scanning による認証情報の漏洩防止
- ✅ Branch protection による main ブランチの保護
- ✅ 定期的なセキュリティレビュー

## 責任ある開示

脆弱性の公開は、修正パッチがリリースされるまで控えていただくようお願いします。
