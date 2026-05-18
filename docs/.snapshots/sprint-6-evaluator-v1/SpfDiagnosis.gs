/**
 * SpfDiagnosis.gs
 *
 * src/diagnosis/spf-diagnosis.js を export 除去で GAS 移植。
 * 判定ロジックは無改変（AC-9 準拠）。
 */

/**
 * SPFレコードを診断
 * @param {string|null} spfRecord
 * @returns {Object} { status, level, message, ... }
 */
function SpfDiagnosis_diagnoseSPF(spfRecord) {
  try {
    var parsed = SpfParser_parseSPFRecord(spfRecord);

    if (!parsed) {
      return {
        status: 'not_configured',
        level: 'error',
        message: '未設定',
        explanation: 'SPF の設定が見つかりませんでした。送信元サーバーを許可するための設定が必要です。',
        whatIs: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。',
        details: null
      };
    }

    var includeCount = SpfParser_countIncludes(parsed);
    var qualifier = SpfParser_getQualifier(parsed);
    var warnings = [];
    var recommendations = [];

    if (includeCount > 7) {
      warnings.push('includeが' + includeCount + '個あります。SPFの制限（10個）に近づいています。');
      recommendations.push('includeメカニズムの統合を検討してください。');
    }

    if (qualifier === '+all') {
      warnings.push('「+all」は全てのIPアドレスを許可するため、SPFの効果がありません。');
      recommendations.push('「~all」または「-all」への変更を強く推奨します。');
    } else if (!qualifier || qualifier === '?all') {
      warnings.push('qualifierが適切に設定されていません。');
      recommendations.push('「~all」または「-all」の設定を推奨します。');
    } else if (qualifier === '~all') {
      recommendations.push('より厳格な「-all」への移行を検討してください。');
    }

    var level = warnings.length > 0 ? 'warning' : 'success';

    return {
      status: 'configured',
      level: level,
      message: '設定済み',
      explanation: '許可された送信サーバーがDNSに正しく登録されています。',
      whatIs: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。',
      details: {
        parsed: parsed,
        includeCount: includeCount,
        qualifier: qualifier,
        warnings: warnings,
        recommendations: recommendations
      }
    };
  } catch (error) {
    return {
      status: 'error',
      level: 'error',
      message: 'エラー',
      explanation: 'SPFレコードの解析中にエラーが発生しました: ' + error.message,
      whatIs: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。',
      details: {
        error: error.message
      }
    };
  }
}
