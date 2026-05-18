/**
 * MXレコードからメールサービスプロバイダーを推定するマッピング
 * @module parsers/mx-provider-mapping
 */

/**
 * MXホスト名のパターン → プロバイダー情報
 * - pattern: ホスト名にマッチする正規表現
 * - name: 表示名
 * - selectorsHint: DKIM 検索時に優先するセレクター（任意）
 * - adminGuide: DKIM 未検出時の管理画面確認案内
 * - thirdPartySigning: 第三者署名が使われる可能性がある場合の警告文（任意）
 */
export const MX_PROVIDER_PATTERNS = [
  {
    pattern: /\.google(?:mail)?\.com\.?$/i,
    name: 'Google Workspace',
    selectorsHint: ['google', '20230601', '20210112'],
    adminGuide: 'Google Admin コンソール → アプリ → Gmail → 認証 から DKIM の有効化状況を確認してください。'
  },
  {
    pattern: /\.(?:mail\.)?protection\.outlook\.com\.?$/i,
    name: 'Microsoft 365',
    selectorsHint: ['selector1', 'selector2'],
    adminGuide: 'Microsoft Defender ポータル → メールとコラボレーション → ポリシーとルール → DKIM から有効化状況を確認してください。'
  },
  {
    pattern: /\.lolipop\.jp\.?$/i,
    name: 'ロリポップ',
    adminGuide: 'ロリポップのユーザー専用ページ → メール設定 → DKIM・SPF設定 から DKIM 設定状況を確認してください。',
    thirdPartySigning: 'ロリポップでは、デフォルトでロリポップ側のドメイン（例: dkim.lolipop.jp）で DKIM 署名される場合があります。DKIM 自体は認証されますが、DMARC の DKIM アライメント（From ドメインとの整合性）が失敗するため、なりすまし対策には独自ドメインでの署名を推奨します。'
  },
  {
    pattern: /\.sakura\.ne\.jp\.?$/i,
    name: 'さくらインターネット',
    adminGuide: 'さくらのコントロールパネル → ドメイン/SSL → ドメイン → DKIM 設定 から有効化状況を確認してください。',
    thirdPartySigning: 'さくらインターネットの共有サーバープランでは、独自ドメインでの DKIM 署名に追加設定が必要です。未設定の場合、DMARC のアライメントが失敗する可能性があります。'
  },
  {
    pattern: /\.xserver\.jp\.?$/i,
    name: 'エックスサーバー',
    adminGuide: 'エックスサーバーのサーバーパネル → メール → DKIM設定 から有効化状況を確認してください。'
  },
  {
    pattern: /\.(?:onamae|gmoserver)\.com\.?$/i,
    name: 'お名前.com',
    adminGuide: 'お名前.com のレンタルサーバーコントロールパネル → メール設定 → DKIM から有効化状況を確認してください。'
  },
  {
    pattern: /\.conoha\.io\.?$|\.conoha\.jp\.?$/i,
    name: 'ConoHa',
    adminGuide: 'ConoHa のコントロールパネル → メール → DKIM 設定から有効化状況を確認してください。'
  },
  {
    pattern: /\.kagoya\.(?:net|com)\.?$/i,
    name: 'KAGOYA',
    adminGuide: 'KAGOYA のコントロールパネル → メール設定 → DKIM 設定から有効化状況を確認してください。'
  },
  {
    pattern: /\.sendgrid\.net\.?$/i,
    name: 'SendGrid',
    selectorsHint: ['s1', 's2'],
    adminGuide: 'SendGrid 管理画面 → Settings → Sender Authentication から DKIM 設定状況を確認してください。'
  },
  {
    pattern: /\.mailgun\.(?:org|net)\.?$/i,
    name: 'Mailgun',
    adminGuide: 'Mailgun ダッシュボード → Sending → Domains から DKIM 設定状況を確認してください。'
  },
  {
    pattern: /\.mcsv\.net\.?$/i,
    name: 'Mailchimp',
    selectorsHint: ['k1', 'k2', 'k3'],
    adminGuide: 'Mailchimp → Website → Domains → Authentication から DKIM 設定状況を確認してください。'
  },
  {
    pattern: /\.amazonses\.com\.?$/i,
    name: 'Amazon SES',
    adminGuide: 'AWS マネジメントコンソール → SES → Verified identities → DKIM から設定状況を確認してください。',
    thirdPartySigning: 'Amazon SES は動的に生成されたランダムなセレクター名を使うため、本ツールの辞書方式では検出できません。SES 管理画面で表示されている CNAME レコードのセレクター名を「DKIM セレクター名（任意）」欄に入力すると診断できます。'
  }
];

/**
 * MXレコードからプロバイダー情報を推定
 * @param {Array<string>} mxRecords - MXホスト名の配列（priority順）
 * @returns {Object|null} プロバイダー情報、該当なしなら null
 */
export function inferProviderFromMX(mxRecords) {
  if (!mxRecords || mxRecords.length === 0) {
    return null;
  }
  for (const mx of mxRecords) {
    const hostname = (typeof mx === 'string' ? mx : (mx.exchange || '')).toLowerCase().replace(/\.$/, '');
    if (!hostname) continue;
    for (const entry of MX_PROVIDER_PATTERNS) {
      if (entry.pattern.test(hostname)) {
        return {
          name: entry.name,
          selectorsHint: entry.selectorsHint || null,
          adminGuide: entry.adminGuide,
          thirdPartySigning: entry.thirdPartySigning || null,
          matchedMx: hostname
        };
      }
    }
  }
  return null;
}
