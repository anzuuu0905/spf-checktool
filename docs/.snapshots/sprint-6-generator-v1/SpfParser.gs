/**
 * SpfParser.gs
 *
 * src/parsers/spf-parser.js を export 除去で GAS 移植。
 * 判定ロジックは無改変（AC-9 準拠）。
 */

/**
 * SPFレコードをパースして構造化オブジェクトに変換
 * @param {string|null} spfRecord
 * @returns {Object|null}
 */
function SpfParser_parseSPFRecord(spfRecord) {
  if (!spfRecord || spfRecord.trim() === '') {
    return null;
  }

  var trimmed = spfRecord.trim();

  if (trimmed.indexOf('v=spf1') !== 0) {
    throw new Error('Invalid SPF record: version missing');
  }

  var parts = trimmed.split(/\s+/);
  var result = {
    version: 'spf1',
    mechanisms: [],
    qualifier: null
  };

  for (var i = 1; i < parts.length; i++) {
    var part = parts[i];

    if (part.length >= 3 && part.substring(part.length - 3) === 'all') {
      result.qualifier = part;
      continue;
    }

    if (part.indexOf('include:') === 0) {
      result.mechanisms.push({
        type: 'include',
        value: part.substring('include:'.length)
      });
      continue;
    }

    if (part.indexOf('ip4:') === 0) {
      result.mechanisms.push({
        type: 'ip4',
        value: part.substring('ip4:'.length)
      });
      continue;
    }

    if (part.indexOf('ip6:') === 0) {
      result.mechanisms.push({
        type: 'ip6',
        value: part.substring('ip6:'.length)
      });
      continue;
    }

    if (part === 'a' || part.indexOf('a:') === 0) {
      result.mechanisms.push({
        type: 'a',
        value: part.indexOf(':') !== -1 ? part.substring('a:'.length) : null
      });
      continue;
    }

    if (part === 'mx' || part.indexOf('mx:') === 0) {
      result.mechanisms.push({
        type: 'mx',
        value: part.indexOf(':') !== -1 ? part.substring('mx:'.length) : null
      });
      continue;
    }

    if (part.indexOf('exists:') === 0) {
      result.mechanisms.push({
        type: 'exists',
        value: part.substring('exists:'.length)
      });
      continue;
    }

    if (part.indexOf('redirect=') === 0) {
      result.mechanisms.push({
        type: 'redirect',
        value: part.substring('redirect='.length)
      });
      continue;
    }

    if (part.indexOf('exp=') === 0) {
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
 */
function SpfParser_countIncludes(parsedSPF) {
  if (!parsedSPF || !parsedSPF.mechanisms) {
    return 0;
  }
  var n = 0;
  for (var i = 0; i < parsedSPF.mechanisms.length; i++) {
    if (parsedSPF.mechanisms[i].type === 'include') n++;
  }
  return n;
}

/**
 * SPFレコードのqualifierを取得
 */
function SpfParser_getQualifier(parsedSPF) {
  if (!parsedSPF) {
    return null;
  }
  return parsedSPF.qualifier;
}
