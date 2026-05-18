/**
 * DKIM診断ロジック
 * @module diagnosis/dkim-diagnosis
 */

import { parseDKIMRecord, getKeyLength, getKeyType } from '../parsers/dkim-parser.js';

/**
 * DKIMレコードを診断
 * @param {string|null} dkimRecord - DKIMレコード文字列
 * @param {string} selector - DKIMセレクター名
 * @returns {Object} 診断結果
 *
 * @example
 * diagnoseDKIM('v=DKIM1; k=rsa; p=MIGfMA0GCS...', 'google')
 * // returns:
 * // {
 * //   status: 'configured',
 * //   level: 'success',
 * //   message: '設定済み',
 * //   details: { ... }
 * // }
 */
export function diagnoseDKIM(dkimRecord, selector = null) {
  try {
    const parsed = parseDKIMRecord(dkimRecord);

    if (!parsed || !parsed.publicKey) {
      return {
        status: 'not_configured',
        level: 'warning',
        message: '未検出',
        explanation: 'Google Workspace・Microsoft 365・エックスサーバー など主要なメールサービス28種類の設定で確認しましたが、見つかりませんでした。',
        explanationNote: '※ さくらインターネット・ロリポップ・Amazon SES 等の一部サービスは独自形式の設定を使うため、ドメインだけでは判定できないことがあります。',
        whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
        details: {
          selector,
          found: false
        }
      };
    }

    // 詳細な診断
    const keyLength = getKeyLength(parsed);
    const keyType = getKeyType(parsed);
    const warnings = [];
    const recommendations = [];

    // 鍵長のチェック
    if (keyLength && keyLength < 1024) {
      warnings.push(`鍵長が${keyLength}ビットです。セキュリティが不十分です。`);
      recommendations.push('2048ビット以上の鍵長への更新を強く推奨します。');
    } else if (keyLength && keyLength < 2048) {
      warnings.push(`鍵長が${keyLength}ビットです。現在の推奨基準を満たしていません。`);
      recommendations.push('2048ビット以上の鍵長への更新を推奨します。');
    }

    // 鍵タイプのチェック
    if (keyType && keyType !== 'rsa') {
      warnings.push(`鍵タイプが${keyType}です。互換性の問題が発生する可能性があります。`);
      recommendations.push('RSA鍵の使用を推奨します。');
    }

    const level = warnings.length > 0 ? 'warning' : 'success';

    return {
      status: 'configured',
      level,
      message: '設定済み',
      explanation: '公開鍵が発見でき、メールへの署名が検証可能な状態です。',
      whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
      details: {
        selector,
        parsed,
        keyLength,
        keyType,
        warnings,
        recommendations
      }
    };
  } catch (error) {
    return {
      status: 'error',
      level: 'error',
      message: 'エラー',
      explanation: `DKIMレコードの解析中にエラーが発生しました: ${error.message}`,
      whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
      details: {
        selector,
        error: error.message
      }
    };
  }
}

/**
 * 複数のDKIMセレクターを診断
 * @param {Array<Object>} dkimRecords - DKIMレコードとセレクターの配列
 * @returns {Object} 統合診断結果
 */
export function diagnoseDKIMMultiple(dkimRecords) {
  if (!dkimRecords || dkimRecords.length === 0) {
    return diagnoseDKIM(null, null);
  }

  // 設定されているDKIMレコードを探す
  const configured = dkimRecords.find(record => {
    const diagnosis = diagnoseDKIM(record.record, record.selector);
    return diagnosis.status === 'configured';
  });

  if (configured) {
    return diagnoseDKIM(configured.record, configured.selector);
  }

  // どれも設定されていない場合
  return diagnoseDKIM(null, null);
}

/**
 * DKIM診断結果のサマリーを生成
 * @param {Object} diagnosis - 診断結果
 * @returns {Object} サマリー情報
 */
export function getDKIMSummary(diagnosis) {
  return {
    isConfigured: diagnosis.status === 'configured',
    hasWarnings: diagnosis.level === 'warning',
    hasErrors: diagnosis.level === 'error',
    needsAction: diagnosis.status !== 'configured' || diagnosis.level !== 'success'
  };
}