/**
 * DKIMレコードパーサー
 * @module parsers/dkim-parser
 */

/**
 * DKIMレコードをパースして構造化オブジェクトに変換
 * @param {string|null} dkimRecord - DKIMレコード文字列
 * @returns {Object|null} パースされたDKIMオブジェクト
 * @throws {Error} 不正なDKIMレコードの場合
 *
 * @example
 * parseDKIMRecord('v=DKIM1; k=rsa; p=MIGfMA0GCS...')
 * // returns:
 * // {
 * //   version: 'DKIM1',
 * //   keyType: 'rsa',
 * //   publicKey: 'MIGfMA0GCS...',
 * //   keyLength: 2048
 * // }
 */
export function parseDKIMRecord(dkimRecord) {
  if (!dkimRecord || dkimRecord.trim() === '') {
    return null;
  }

  const trimmed = dkimRecord.trim();
  const result = {
    version: null,
    keyType: null,
    publicKey: null,
    keyLength: null,
    tags: {}
  };

  // DKIMレコードはタグ=値の形式で、セミコロンで区切られる
  const parts = trimmed.split(/[;,]/);

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    const [tag, ...valueParts] = trimmedPart.split('=');
    const value = valueParts.join('=').trim();

    if (!tag || !value) continue;

    const trimmedTag = tag.trim();
    result.tags[trimmedTag] = value;

    switch (trimmedTag) {
      case 'v':
        result.version = value;
        break;
      case 'k':
        result.keyType = value;
        break;
      case 'p':
        result.publicKey = value;
        // 公開鍵の長さを推定（Base64でエンコードされた公開鍵から）
        if (value && value.length > 0) {
          // 簡略化された推定: Base64文字数から概算
          // 実際の実装では公開鍵をデコードして正確な長さを取得すべき
          const estimatedBits = Math.floor(value.length * 6 / 8) * 8;
          if (estimatedBits >= 1800) {
            result.keyLength = 2048;
          } else if (estimatedBits >= 900) {
            result.keyLength = 1024;
          } else if (estimatedBits >= 450) {
            result.keyLength = 512;
          } else {
            result.keyLength = estimatedBits;
          }
        }
        break;
      case 't':
        result.flags = value;
        break;
      case 's':
        result.serviceType = value;
        break;
      case 'n':
        result.notes = value;
        break;
    }
  }

  // DKIMレコードの基本検証
  if (!result.publicKey) {
    return null; // 公開鍵がない場合は無効
  }

  return result;
}

/**
 * DKIMの鍵長を取得
 * @param {Object|null} parsedDKIM - パース済みDKIMオブジェクト
 * @returns {number|null} 鍵長（ビット）
 */
export function getKeyLength(parsedDKIM) {
  if (!parsedDKIM) {
    return null;
  }

  return parsedDKIM.keyLength;
}

/**
 * DKIMの鍵タイプを取得
 * @param {Object|null} parsedDKIM - パース済みDKIMオブジェクト
 * @returns {string|null} 鍵タイプ（通常は'rsa'）
 */
export function getKeyType(parsedDKIM) {
  if (!parsedDKIM) {
    return null;
  }

  return parsedDKIM.keyType || 'rsa'; // デフォルトはrsa
}

/**
 * 複数のDKIMセレクターをチェック
 *
 * Sprint 5: 主要メールサービス28種類をカバーするセレクターリスト
 * (Google Workspace / Microsoft 365 / エックスサーバー / MailChimp / SendGrid /
 *  HubSpot / Zoho / Fastmail / ProtonMail / Zendesk / Klaviyo 等)
 *
 * @returns {Array<string>} 確認対象のセレクター配列（28個）
 */
export function checkCommonSelectors() {
  return [
    // Google / Microsoft
    'default', 'google', 'selector1', 'selector2',
    // SendGrid / Twilio
    's1', 's2',
    // Mailchimp / Mandrill
    'k1', 'k2', 'k3', 'mte1', 'mte2',
    // Yahoo / 汎用
    's1024', 's2048',
    // HubSpot
    'hs1', 'hs2',
    // Brevo / Postfix
    'mail', 'mail2',
    // Zoho
    'zmail',
    // Fastmail
    'fm1', 'fm2', 'fm3',
    // ProtonMail
    'protonmail', 'protonmail2', 'protonmail3',
    // Zendesk
    'zendesk1', 'zendesk2',
    // Klaviyo
    'kl',
    // 汎用
    'dkim'
  ];
}