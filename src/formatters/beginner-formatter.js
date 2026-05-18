/**
 * 初心者向けフォーマッター
 * Sprint 5: モックv2 の文言（迷惑メールフォルダ観点・落ち着いたトーン）に統一
 *
 * @module formatters/beginner-formatter
 */

/**
 * SPFの説明文を取得
 * @returns {Object} SPFの説明文セット
 */
export function getSPFExplanation() {
  return {
    title: 'SPF（送信元サーバーの許可）',
    oneLineDescription: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。',
    withoutConfiguration: 'SPF の設定が見つかりませんでした。送信元サーバーを許可するための設定が必要です。',
    withConfiguration: '許可された送信サーバーがDNSに正しく登録されています。',
    analogy: '会社の受付に「うちの社員リスト」を渡しておき、名刺を出した人が本当に社員かチェックしてもらうようなものです。',
    whatIs: '送ってOKなサーバーを登録する「住所録」。許可外の送信元を見分けます。'
  };
}

/**
 * DKIMの説明文を取得
 * @returns {Object} DKIMの説明文セット
 */
export function getDKIMExplanation() {
  return {
    title: 'DKIM（電子サイン）',
    oneLineDescription: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。',
    withoutConfiguration: 'Google Workspace・Microsoft 365・エックスサーバー など主要なメールサービス28種類の設定で確認しましたが、見つかりませんでした。',
    withConfiguration: '公開鍵が発見でき、メールへの署名が検証可能な状態です。',
    analogy: '重要書類に割印を押すように、メール全体に「改ざん防止シール」を貼るイメージです。',
    whatIs: 'メールに付ける「電子サイン」。改ざんと送信元のなりすましを検出します。'
  };
}

/**
 * DMARCの説明文を取得
 * @returns {Object} DMARCの説明文セット
 */
export function getDMARCExplanation() {
  return {
    title: 'DMARC（運用ポリシー）',
    oneLineDescription: 'SPF/DKIMの結果を踏まえた「運用ポリシー」。不正メールの扱いを決めます。',
    withoutConfiguration: 'DMARC の設定が見つかりませんでした。なりすましメールがあった場合のルールがまだ定まっていません。',
    withConfiguration: 'なりすまし対策のポリシーが設定されています。レポートも受信中です。',
    analogy: 'SPF と DKIM の判定結果をまとめて、不正メールが届いた場合にどう扱うかをルール化したものです。',
    whatIs: 'SPF/DKIMの結果を踏まえた「運用ポリシー」。不正メールの扱いを決めます。'
  };
}

/**
 * 診断結果に応じた説明文を取得
 * @param {string} type - 'spf' | 'dkim' | 'dmarc'
 * @param {boolean} isConfigured - 設定済みかどうか
 * @returns {Object} 説明文オブジェクト
 */
export function getExplanationByStatus(type, isConfigured) {
  let explanation;

  switch (type.toLowerCase()) {
    case 'spf':
      explanation = getSPFExplanation();
      break;
    case 'dkim':
      explanation = getDKIMExplanation();
      break;
    case 'dmarc':
      explanation = getDMARCExplanation();
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }

  return {
    title: explanation.title,
    oneLineDescription: explanation.oneLineDescription,
    statusMessage: isConfigured ? explanation.withConfiguration : explanation.withoutConfiguration,
    analogy: explanation.analogy,
    whatIs: explanation.whatIs
  };
}

/**
 * 全体の診断結果サマリーメッセージを生成
 * @param {Object} results - 診断結果（spf, dkim, dmarc）
 * @returns {Object} サマリーメッセージ
 */
export function getSummaryMessage(results) {
  const notConfigured = [];

  if (!results.spf?.isConfigured) {
    notConfigured.push('SPF');
  }
  if (!results.dkim?.isConfigured) {
    notConfigured.push('DKIM');
  }
  if (!results.dmarc?.isConfigured) {
    notConfigured.push('DMARC');
  }

  if (notConfigured.length === 0) {
    return {
      status: 'success',
      message: '3項目すべて設定済みです。',
      detail: 'SPF・DKIM・DMARC のすべてが適切に設定されています。',
      needsConsultation: false,
      consultationMessage: '無料で相談する'
    };
  }

  return {
    status: 'warning',
    message: `${notConfigured.join('、')}の設定が確認できませんでした。`,
    detail: '取引先に送ったメールが迷惑メールフォルダに振り分けられる可能性があります。',
    needsConsultation: true,
    consultationMessage: '無料で相談する'
  };
}
