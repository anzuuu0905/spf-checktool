/**
 * DmarcParser.gs
 *
 * src/parsers/dmarc-parser.js を export 除去で GAS 移植。
 * 判定ロジックは無改変（AC-9 準拠）。
 */

/**
 * DMARCレコードをパースして構造化オブジェクトに変換
 * @param {string|null} dmarcRecord
 * @returns {Object|null}
 */
function DmarcParser_parseDMARCRecord(dmarcRecord) {
  if (!dmarcRecord || dmarcRecord.trim() === '') {
    return null;
  }

  var trimmed = dmarcRecord.trim();
  var result = {
    version: null,
    policy: null,
    subdomainPolicy: null,
    rua: null,
    ruf: null,
    percentage: 100,
    aspf: 'r',
    adkim: 'r',
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

    if (!tag) continue;

    result.tags[tag] = value;

    switch (tag) {
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
        var pct = parseInt(value, 10);
        result.percentage = isNaN(pct) ? 100 : pct;
        break;
      case 'aspf':
        result.aspf = value;
        break;
      case 'adkim':
        result.adkim = value;
        break;
      case 'ri':
        var ri = parseInt(value, 10);
        result.reportInterval = isNaN(ri) ? 86400 : ri;
        break;
      case 'fo':
        result.failureOptions = value;
        break;
    }
  }

  if (result.version !== 'DMARC1') return null;
  if (!result.policy) return null;

  return result;
}

function DmarcParser_getPolicy(parsedDMARC) {
  return parsedDMARC ? parsedDMARC.policy : null;
}
function DmarcParser_getRUA(parsedDMARC) {
  return parsedDMARC ? parsedDMARC.rua : null;
}
function DmarcParser_getRUF(parsedDMARC) {
  return parsedDMARC ? parsedDMARC.ruf : null;
}
function DmarcParser_getPercentage(parsedDMARC) {
  if (!parsedDMARC) return 0;
  return parsedDMARC.percentage || 100;
}
