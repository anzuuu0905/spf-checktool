/**
 * DmarcDiagnosis.gs
 *
 * src/diagnosis/dmarc-diagnosis.js を export 除去で GAS 移植。
 * 判定ロジックは無改変（AC-9 準拠）。
 */

/**
 * DMARCレコードを診断
 * @param {string|null} dmarcRecord
 * @returns {Object}
 */
function DmarcDiagnosis_diagnoseDMARC(dmarcRecord) {
  try {
    var parsed = DmarcParser_parseDMARCRecord(dmarcRecord);

    if (!parsed) {
      return {
        status: 'not_configured',
        level: 'info',
        message: '未設定',
        explanation: 'DMARC の設定が見つかりませんでした。なりすましメールがあった場合のルールがまだ定まっていません。',
        whatIs: 'SPF/DKIMの結果を踏まえた「運用ポリシー」。不正メールの扱いを決めます。',
        details: null
      };
    }

    var policy = DmarcParser_getPolicy(parsed);
    var rua = DmarcParser_getRUA(parsed);
    var percentage = DmarcParser_getPercentage(parsed);
    var warnings = [];
    var recommendations = [];

    if (policy === 'none') {
      warnings.push('ポリシーが「監視モード」に設定されています。DMARCチェックは行われますが、失敗してもメールは通常通り配信されます。');
      recommendations.push('段階的に「quarantine」または「reject」への移行を検討してください。');
    } else if (policy === 'quarantine') {
      recommendations.push('最終的には「reject」への移行を検討してください。');
    }

    if (!rua) {
      warnings.push('集計レポート（RUA）の送信先が設定されていません。');
      recommendations.push('RUAを設定して、なりすましメールの状況を把握することを推奨します。');
    }

    if (percentage < 100) {
      warnings.push('DMARCポリシーの適用率が' + percentage + '%に制限されています。');
      recommendations.push('段階的に100%への引き上げを検討してください。');
    }

    if (parsed.subdomainPolicy && parsed.subdomainPolicy !== policy) {
      warnings.push('サブドメインのポリシー（' + parsed.subdomainPolicy + '）がメインドメインと異なります。');
    }

    var level = warnings.length > 0 && policy === 'none' ? 'warning' :
                (warnings.length > 0 ? 'info' : 'success');

    return {
      status: 'configured',
      level: level,
      message: '設定済み',
      explanation: 'なりすまし対策のポリシーが設定されています。レポートも受信中です。',
      whatIs: 'SPF/DKIMの結果を踏まえた「運用ポリシー」。不正メールの扱いを決めます。',
      details: {
        parsed: parsed,
        policy: policy,
        rua: rua,
        percentage: percentage,
        warnings: warnings,
        recommendations: recommendations
      }
    };
  } catch (error) {
    return {
      status: 'error',
      level: 'error',
      message: 'エラー',
      explanation: 'DMARCレコードの解析中にエラーが発生しました: ' + error.message,
      whatIs: 'SPF/DKIMの結果を踏まえた「運用ポリシー」。不正メールの扱いを決めます。',
      details: {
        error: error.message
      }
    };
  }
}
