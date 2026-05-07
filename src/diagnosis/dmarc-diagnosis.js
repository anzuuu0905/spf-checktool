/**
 * DMARC診断ロジック
 * @module diagnosis/dmarc-diagnosis
 */

import { parseDMARCRecord, getPolicy, getRUA, getPercentage } from '../parsers/dmarc-parser.js';

/**
 * DMARCレコードを診断
 * @param {string|null} dmarcRecord - DMARCレコード文字列
 * @returns {Object} 診断結果
 *
 * @example
 * diagnoseDMARC('v=DMARC1; p=reject; rua=mailto:dmarc@example.com')
 * // returns:
 * // {
 * //   status: 'configured',
 * //   level: 'success',
 * //   message: '設定済み',
 * //   details: { ... }
 * // }
 */
export function diagnoseDMARC(dmarcRecord) {
  try {
    const parsed = parseDMARCRecord(dmarcRecord);

    if (!parsed) {
      return {
        status: 'not_configured',
        level: 'info',
        message: '未設定',
        explanation: 'SPFやDKIMでチェックしても、すり抜ける巧妙な偽メールがあり、社長なりすまし詐欺（CEO詐欺）で、中小企業でも数百万円〜数千万円の被害に遭うケースが急増しています。',
        whatIs: 'SPFとDKIMを組み合わせた最終防衛ライン。社員証と入館証の二重チェック',
        details: null
      };
    }

    // 詳細な診断
    const policy = getPolicy(parsed);
    const rua = getRUA(parsed);
    const percentage = getPercentage(parsed);
    const warnings = [];
    const recommendations = [];

    // ポリシーのチェック
    if (policy === 'none') {
      warnings.push('ポリシーが「none」に設定されています。DMARCチェックは行われますが、失敗してもメールは通常通り配信されます。');
      recommendations.push('段階的に「quarantine」または「reject」への移行を検討してください。');
    } else if (policy === 'quarantine') {
      recommendations.push('最終的には「reject」への移行を検討してください。');
    }

    // レポート送信先のチェック
    if (!rua) {
      warnings.push('集計レポート（RUA）の送信先が設定されていません。');
      recommendations.push('RUAを設定して、なりすましメールの状況を把握することを推奨します。');
    }

    // 適用パーセンテージのチェック
    if (percentage < 100) {
      warnings.push(`DMARCポリシーの適用率が${percentage}%に制限されています。`);
      recommendations.push('段階的に100%への引き上げを検討してください。');
    }

    // サブドメインポリシーのチェック
    if (parsed.subdomainPolicy && parsed.subdomainPolicy !== policy) {
      warnings.push(`サブドメインのポリシー（${parsed.subdomainPolicy}）がメインドメインと異なります。`);
    }

    const level = warnings.length > 0 && policy === 'none' ? 'warning' :
                  warnings.length > 0 ? 'info' : 'success';

    return {
      status: 'configured',
      level,
      message: '設定済み',
      explanation: null,
      whatIs: 'SPFとDKIMを組み合わせた最終防衛ライン。社員証と入館証の二重チェック',
      details: {
        parsed,
        policy,
        rua,
        percentage,
        warnings,
        recommendations
      }
    };
  } catch (error) {
    return {
      status: 'error',
      level: 'error',
      message: 'エラー',
      explanation: `DMARCレコードの解析中にエラーが発生しました: ${error.message}`,
      whatIs: 'SPFとDKIMを組み合わせた最終防衛ライン。社員証と入館証の二重チェック',
      details: {
        error: error.message
      }
    };
  }
}

/**
 * DMARC診断結果のサマリーを生成
 * @param {Object} diagnosis - 診断結果
 * @returns {Object} サマリー情報
 */
export function getDMARCSummary(diagnosis) {
  return {
    isConfigured: diagnosis.status === 'configured',
    hasWarnings: diagnosis.level === 'warning',
    hasErrors: diagnosis.level === 'error',
    needsAction: diagnosis.status !== 'configured' || diagnosis.level !== 'success'
  };
}