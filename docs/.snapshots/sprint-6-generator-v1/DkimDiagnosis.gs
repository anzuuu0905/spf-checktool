/**
 * DkimDiagnosis.gs
 *
 * src/diagnosis/dkim-diagnosis.js を export 除去で GAS 移植。
 * 判定ロジックは無改変（AC-9 準拠）。
 */

/**
 * DKIMレコードを診断
 * @param {string|null} dkimRecord
 * @param {string|null} selector
 * @returns {Object}
 */
function DkimDiagnosis_diagnoseDKIM(dkimRecord, selector) {
  if (selector === undefined) selector = null;
  try {
    var parsed = DkimParser_parseDKIMRecord(dkimRecord);

    if (!parsed || !parsed.publicKey) {
      return {
        status: 'not_configured',
        level: 'warning',
        message: '未検出',
        explanation: 'Google Workspace・Microsoft 365・エックスサーバー など主要なメールサービス28種類の設定で確認しましたが、見つかりませんでした。',
        explanationNote: '※ さくらインターネット・ロリポップ・Amazon SES 等の一部サービスは独自形式の設定を使うため、ドメインだけでは判定できないことがあります。',
        whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
        details: {
          selector: selector,
          found: false
        }
      };
    }

    var keyLength = DkimParser_getKeyLength(parsed);
    var keyType = DkimParser_getKeyType(parsed);
    var warnings = [];
    var recommendations = [];

    if (keyLength && keyLength < 1024) {
      warnings.push('鍵長が' + keyLength + 'ビットです。セキュリティが不十分です。');
      recommendations.push('2048ビット以上の鍵長への更新を強く推奨します。');
    } else if (keyLength && keyLength < 2048) {
      warnings.push('鍵長が' + keyLength + 'ビットです。現在の推奨基準を満たしていません。');
      recommendations.push('2048ビット以上の鍵長への更新を推奨します。');
    }

    if (keyType && keyType !== 'rsa') {
      warnings.push('鍵タイプが' + keyType + 'です。互換性の問題が発生する可能性があります。');
      recommendations.push('RSA鍵の使用を推奨します。');
    }

    var level = warnings.length > 0 ? 'warning' : 'success';

    return {
      status: 'configured',
      level: level,
      message: '設定済み',
      explanation: '公開鍵が発見でき、メールへの署名が検証可能な状態です。',
      whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
      details: {
        selector: selector,
        parsed: parsed,
        keyLength: keyLength,
        keyType: keyType,
        warnings: warnings,
        recommendations: recommendations
      }
    };
  } catch (error) {
    return {
      status: 'error',
      level: 'error',
      message: 'エラー',
      explanation: 'DKIMレコードの解析中にエラーが発生しました: ' + error.message,
      whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
      details: {
        selector: selector,
        error: error.message
      }
    };
  }
}

/**
 * 複数のDKIMセレクターを診断（最初に configured が見つかったものを採用）
 * @param {Array<{selector:string, record:string}>} dkimRecords
 * @returns {Object}
 */
function DkimDiagnosis_diagnoseDKIMMultiple(dkimRecords) {
  if (!dkimRecords || dkimRecords.length === 0) {
    return DkimDiagnosis_diagnoseDKIM(null, null);
  }

  for (var i = 0; i < dkimRecords.length; i++) {
    var d = DkimDiagnosis_diagnoseDKIM(dkimRecords[i].record, dkimRecords[i].selector);
    if (d.status === 'configured') {
      return d;
    }
  }

  return DkimDiagnosis_diagnoseDKIM(null, null);
}
