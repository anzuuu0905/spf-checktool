/**
 * SPFレコードパーサー
 * @module parsers/spf-parser
 */

/**
 * SPFレコードをパースして構造化オブジェクトに変換
 * @param {string|null} spfRecord - SPFレコード文字列
 * @returns {Object|null} パースされたSPFオブジェクト
 * @throws {Error} 不正なSPFレコードの場合
 *
 * @example
 * parseSPFRecord('v=spf1 include:_spf.google.com ~all')
 * // returns:
 * // {
 * //   version: 'spf1',
 * //   mechanisms: [{ type: 'include', value: '_spf.google.com' }],
 * //   qualifier: '~all'
 * // }
 */
export function parseSPFRecord(spfRecord) {
  if (!spfRecord || spfRecord.trim() === '') {
    return null;
  }

  const trimmed = spfRecord.trim();

  // SPFレコードはv=spf1で始まる必要がある
  if (!trimmed.startsWith('v=spf1')) {
    throw new Error('Invalid SPF record: version missing');
  }

  const parts = trimmed.split(/\s+/);
  const result = {
    version: 'spf1',
    mechanisms: [],
    qualifier: null
  };

  // 最初の要素はv=spf1なのでスキップ
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // allディレクティブの処理
    if (part.endsWith('all')) {
      result.qualifier = part;
      continue;
    }

    // includeメカニズム
    if (part.startsWith('include:')) {
      result.mechanisms.push({
        type: 'include',
        value: part.substring('include:'.length)
      });
      continue;
    }

    // ip4メカニズム
    if (part.startsWith('ip4:')) {
      result.mechanisms.push({
        type: 'ip4',
        value: part.substring('ip4:'.length)
      });
      continue;
    }

    // ip6メカニズム
    if (part.startsWith('ip6:')) {
      result.mechanisms.push({
        type: 'ip6',
        value: part.substring('ip6:'.length)
      });
      continue;
    }

    // aメカニズム
    if (part === 'a' || part.startsWith('a:')) {
      result.mechanisms.push({
        type: 'a',
        value: part.includes(':') ? part.substring('a:'.length) : null
      });
      continue;
    }

    // mxメカニズム
    if (part === 'mx' || part.startsWith('mx:')) {
      result.mechanisms.push({
        type: 'mx',
        value: part.includes(':') ? part.substring('mx:'.length) : null
      });
      continue;
    }

    // existsメカニズム
    if (part.startsWith('exists:')) {
      result.mechanisms.push({
        type: 'exists',
        value: part.substring('exists:'.length)
      });
      continue;
    }

    // redirectモディファイア
    if (part.startsWith('redirect=')) {
      result.mechanisms.push({
        type: 'redirect',
        value: part.substring('redirect='.length)
      });
      continue;
    }

    // expモディファイア（説明）
    if (part.startsWith('exp=')) {
      result.mechanisms.push({
        type: 'exp',
        value: part.substring('exp='.length)
      });
      continue;
    }
  }

  return result;
}

/**
 * SPFレコード内のinclude数をカウント
 * @param {Object|null} parsedSPF - パース済みSPFオブジェクト
 * @returns {number} include数
 */
export function countIncludes(parsedSPF) {
  if (!parsedSPF || !parsedSPF.mechanisms) {
    return 0;
  }

  return parsedSPF.mechanisms.filter(m => m.type === 'include').length;
}

/**
 * SPFレコードのqualifierを取得
 * @param {Object|null} parsedSPF - パース済みSPFオブジェクト
 * @returns {string|null} qualifier（~all, -all, +all など）
 */
export function getQualifier(parsedSPF) {
  if (!parsedSPF) {
    return null;
  }

  return parsedSPF.qualifier;
}