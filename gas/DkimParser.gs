/**
 * DkimParser.gs
 *
 * src/parsers/dkim-parser.js を export 除去で GAS 移植。
 * 判定ロジック・推定鍵長計算は無改変（AC-9 準拠）。
 */

/**
 * DKIMレコードをパースして構造化オブジェクトに変換
 * @param {string|null} dkimRecord
 * @returns {Object|null}
 */
function DkimParser_parseDKIMRecord(dkimRecord) {
  if (!dkimRecord || dkimRecord.trim() === '') {
    return null;
  }

  var trimmed = dkimRecord.trim();
  var result = {
    version: null,
    keyType: null,
    publicKey: null,
    keyLength: null,
    tags: {}
  };

  var parts = trimmed.split(/[;,]/);

  for (var i = 0; i < parts.length; i++) {
    var trimmedPart = parts[i].trim();
    if (!trimmedPart) continue;

    var eqIdx = trimmedPart.indexOf('=');
    if (eqIdx === -1) continue;
    var tag = trimmedPart.substring(0, eqIdx).trim();
    var value = trimmedPart.substring(eqIdx + 1).trim();

    if (!tag || !value) continue;

    result.tags[tag] = value;

    switch (tag) {
      case 'v':
        result.version = value;
        break;
      case 'k':
        result.keyType = value;
        break;
      case 'p':
        result.publicKey = value;
        if (value && value.length > 0) {
          var estimatedBits = Math.floor(value.length * 6 / 8) * 8;
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

  if (!result.publicKey) {
    return null;
  }

  return result;
}

/** DKIMの鍵長を取得 */
function DkimParser_getKeyLength(parsedDKIM) {
  if (!parsedDKIM) return null;
  return parsedDKIM.keyLength;
}

/** DKIMの鍵タイプを取得 */
function DkimParser_getKeyType(parsedDKIM) {
  if (!parsedDKIM) return null;
  return parsedDKIM.keyType || 'rsa';
}
