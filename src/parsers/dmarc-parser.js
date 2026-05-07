/**
 * DMARCレコードパーサー
 * @module parsers/dmarc-parser
 */

/**
 * DMARCレコードをパースして構造化オブジェクトに変換
 * @param {string|null} dmarcRecord - DMARCレコード文字列
 * @returns {Object|null} パースされたDMARCオブジェクト
 * @throws {Error} 不正なDMARCレコードの場合
 *
 * @example
 * parseDMARCRecord('v=DMARC1; p=reject; rua=mailto:dmarc@example.com')
 * // returns:
 * // {
 * //   version: 'DMARC1',
 * //   policy: 'reject',
 * //   rua: 'mailto:dmarc@example.com',
 * //   ruf: null,
 * //   percentage: 100
 * // }
 */
export function parseDMARCRecord(dmarcRecord) {
  if (!dmarcRecord || dmarcRecord.trim() === '') {
    return null;
  }

  const trimmed = dmarcRecord.trim();
  const result = {
    version: null,
    policy: null,
    subdomainPolicy: null,
    rua: null,
    ruf: null,
    percentage: 100, // デフォルトは100%
    aspf: 'r', // SPFアライメント（relaxed/strict）
    adkim: 'r', // DKIMアライメント（relaxed/strict）
    tags: {}
  };

  // DMARCレコードはタグ=値の形式で、セミコロンで区切られる
  const parts = trimmed.split(/[;,]/);

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    const [tag, ...valueParts] = trimmedPart.split('=');
    const value = valueParts.join('=').trim();

    if (!tag) continue;

    const trimmedTag = tag.trim();
    result.tags[trimmedTag] = value;

    switch (trimmedTag) {
      case 'v':
        result.version = value;
        break;
      case 'p':
        result.policy = value;
        break;
      case 'sp':
        result.subdomainPolicy = value;
        break;
      case 'rua':
        result.rua = value;
        break;
      case 'ruf':
        result.ruf = value;
        break;
      case 'pct':
        result.percentage = parseInt(value, 10) || 100;
        break;
      case 'aspf':
        result.aspf = value;
        break;
      case 'adkim':
        result.adkim = value;
        break;
      case 'ri':
        result.reportInterval = parseInt(value, 10) || 86400;
        break;
      case 'fo':
        result.failureOptions = value;
        break;
    }
  }

  // DMARCレコードの基本検証
  if (result.version !== 'DMARC1') {
    return null; // 正しいバージョンでない場合は無効
  }

  if (!result.policy) {
    return null; // ポリシーが指定されていない場合は無効
  }

  return result;
}

/**
 * DMARCポリシーを取得
 * @param {Object|null} parsedDMARC - パース済みDMARCオブジェクト
 * @returns {string|null} ポリシー（none/quarantine/reject）
 */
export function getPolicy(parsedDMARC) {
  if (!parsedDMARC) {
    return null;
  }

  return parsedDMARC.policy;
}

/**
 * DMARCレポート送信先（RUA）を取得
 * @param {Object|null} parsedDMARC - パース済みDMARCオブジェクト
 * @returns {string|null} RUAアドレス
 */
export function getRUA(parsedDMARC) {
  if (!parsedDMARC) {
    return null;
  }

  return parsedDMARC.rua;
}

/**
 * DMARCレポート送信先（RUF）を取得
 * @param {Object|null} parsedDMARC - パース済みDMARCオブジェクト
 * @returns {string|null} RUFアドレス
 */
export function getRUF(parsedDMARC) {
  if (!parsedDMARC) {
    return null;
  }

  return parsedDMARC.ruf;
}

/**
 * DMARC適用パーセンテージを取得
 * @param {Object|null} parsedDMARC - パース済みDMARCオブジェクト
 * @returns {number} 適用パーセンテージ（0-100）
 */
export function getPercentage(parsedDMARC) {
  if (!parsedDMARC) {
    return 0;
  }

  return parsedDMARC.percentage || 100;
}