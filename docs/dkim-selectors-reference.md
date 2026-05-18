# 主要 DKIM セレクター一覧（リファレンス）

最終更新: 2026-05-18

## このドキュメントの位置づけ

DKIM のセレクター名は **DNS で外部から列挙できない仕様**（RFC 6376）であり、本ツールは「主要メールサービスごとに既知のセレクター名」を辞書として持って判定している。

この辞書のメンテナンスを継続的に行うため、メールサービスごとの確定セレクター名を本ファイルに集約する。

## 関連ソース

- 実装本体: `src/parsers/dkim-parser.js` の `checkCommonSelectors()`
- DNS 問い合わせ: `src/api/dns-resolver.js` の `getDKIMRecords()`

## 主要セレクター一覧

| メールサービス | セレクター名 | 備考 |
|---|---|---|
| Google Workspace | `google` | デフォルトセレクター |
| Google Workspace | `20230601`, `20210112`, `20161025` | Google は年月ベースの歴代セレクターを使う |
| Microsoft 365 | `selector1`, `selector2` | Microsoft Defender のドキュメントで明示（公式） |
| SendGrid / Twilio | `s1`, `s2` | 業界標準 |
| Mailchimp / Mandrill | `k1`, `k2`, `k3`, `mte1`, `mte2` | 業界標準 |
| HubSpot | `hs1`, `hs2` | 業界標準 |
| Postmark | `pm` | 公式ドキュメント（※現状辞書未収録） |
| Mailgun | `mg`, `mailo`, `mailgun` | 公式ドキュメント（※現状辞書未収録） |
| Salesforce / Marketing Cloud | `mc`, `sfdc` | 業界標準（※現状辞書未収録） |
| Brevo (旧 Sendinblue) | `mail`, `mail2` | |
| Zoho | `zmail` | |
| Fastmail | `fm1`, `fm2`, `fm3` | |
| ProtonMail | `protonmail`, `protonmail2`, `protonmail3` | |
| Zendesk | `zendesk1`, `zendesk2` | |
| Klaviyo | `kl` | |
| Yahoo / 汎用（鍵長ベース） | `s1024`, `s2048` | 鍵の長さを示す名前 |
| 汎用 | `default`, `dkim` | 慣習的命名 |
| Amazon SES | （動的・ランダム32文字） | 辞書方式では検出不可 |

## 検出限界

DKIM セレクター名は外部から DNS で列挙できないため、本ツールでは以下のケースで「未検出」と表示される（実際には設定されていても）。

- 上記辞書にないカスタムセレクターを使用しているケース
- Amazon SES のようにセレクター名を動的生成しているケース
- さくらインターネット・ロリポップなど独自形式の設定を採用しているケース

これらに該当する可能性がある場合、ユーザーは UI 上の「セレクター名を指定する（任意）」欄に手元のセレクター名を入力することで、ピンポイントで判定できる。

## 参考一次情報

- RFC 6376 (DKIM Signatures): https://www.rfc-editor.org/rfc/rfc6376.html
- Microsoft 365 公式 DKIM 設定: https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure
- Google Workspace 公式 DKIM 設定: https://support.google.com/a/answer/174124
- dmarcian DKIM Selectors: https://dmarcian.com/dkim-selectors/
- CaptainDNS DKIM Discovery: https://www.captaindns.com/en/tools/email-authentication/dkim-selector-discovery

## メンテナンス指針

- 新サービス追加時は本ファイルに**出典 URL 込み**で追記
- 半年に1回（年2回）見直しを行い、新規セレクターを `checkCommonSelectors()` に反映
- 辞書サイズは現在 30 件前後。業界中堅水準を目指して 50 件超への拡充を検討中
