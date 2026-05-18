/**
 * SPF診断ロジック
 * @module diagnosis/spf-diagnosis
 */

import { parseSPFRecord, countIncludes, getQualifier } from '../parsers/spf-parser.js';

/**
 * SPFレコードを診断
 * @param {string|null} spfRecord - SPFレコード文字列
 * @returns {Object} 診断結果
 *
 * @example
 * diagnoseSPF('v=spf1 include:_spf.google.com ~all')
 * // returns:
 * // {
 * //   status: 'configured',
 * //   level: 'success',
 * //   message: '設定済み',
 * //   details: { ... }
 * // }
 */
export function diagnoseSPF(spfRecord) {
  try {
    const parsed = parseSPFRecord(spfRecord);

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

    // 詳細な診断
    const includeCount = countIncludes(parsed);
    const qualifier = getQualifier(parsed);
    const warnings = [];
    const recommendations = [];

    // include数のチェック（10個以上は上限に近い）
    if (includeCount > 7) {
      warnings.push(`includeが${includeCount}個あります。SPFの制限（10個）に近づいています。`);
      recommendations.push('includeメカニズムの統合を検討してください。');
    }

    // qualifierのチェック
    if (qualifier === '+all') {
      warnings.push('「+all」は全てのIPアドレスを許可するため、SPFの効果がありません。');
      recommendations.push('「~all」または「-all」への変更を強く推奨します。');
    } else if (!qualifier || qualifier === '?all') {
      warnings.push('qualifierが適切に設定されていません。');
      recommendations.push('「~all」または「-all」の設定を推奨します。');
    } else if (qualifier === '~all') {
      recommendations.push('より厳格な「-all」への移行を検討してください。');
    }

    const level = warnings.length > 0 ? 'warning' : 'success';

    return {
      status: 'configured',
      level,
      message: '設定済み',
      explanation: '許可された送信サーバーがDNSに正しく登録されています。',
      whatIs: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。',
      details: {
        parsed,
        includeCount,
        qualifier,
        warnings,
        recommendations
      }
    };
  } catch (error) {
    return {
      status: 'error',
      level: 'error',
      message: 'エラー',
      explanation: `SPFレコードの解析中にエラーが発生しました: ${error.message}`,
      whatIs: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。',
      details: {
        error: error.message
      }
    };
  }
}

/**
 * SPF診断結果のサマリーを生成
 * @param {Object} diagnosis - 診断結果
 * @returns {Object} サマリー情報
 */
export function getSPFSummary(diagnosis) {
  return {
    isConfigured: diagnosis.status === 'configured',
    hasWarnings: diagnosis.level === 'warning',
    hasErrors: diagnosis.level === 'error',
    needsAction: diagnosis.status !== 'configured' || diagnosis.level !== 'success'
  };
}