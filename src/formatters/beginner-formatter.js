/**
 * 初心者向けフォーマッター
 * @module formatters/beginner-formatter
 *
 * /docs/beginner-explanations.md の内容をそのまま使用する
 */

/**
 * SPFの説明文を取得
 * @returns {Object} SPFの説明文セット
 */
export function getSPFExplanation() {
  return {
    title: 'SPF（差出人チェック機能）',
    oneLineDescription: '会社の看板を勝手に使った偽メールをブロックする「差出人チェック機能」',
    withoutConfiguration: 'あなたの会社名で偽の請求書メールが取引先に届き、信用を失います。さらにGmailやOutlookがあなたのメールを「迷惑メール」と判定し、取引先に届かなくなり、大切な商談を逃す可能性があります。',
    withConfiguration: '「この会社からのメールは、必ずこの郵便局から送られる」という証明書を作ることで、偽物を自動的にブロックできます。取引先から「この会社はセキュリティがしっかりしている」と信頼され、安心してメールのやり取りができます。',
    analogy: '会社の受付に「うちの社員リスト」を渡しておき、名刺を出した人が本当に社員かチェックしてもらうようなものです。',
    whatIs: '会社の看板を勝手に使った偽メールをブロックする機能。郵便局で差出人をチェックするイメージ'
  };
}

/**
 * DKIMの説明文を取得
 * @returns {Object} DKIMの説明文セット
 */
export function getDKIMExplanation() {
  return {
    title: 'DKIM（会社の実印機能）',
    oneLineDescription: 'メールに「会社の実印」を押して、本物であることを証明する機能',
    withoutConfiguration: 'メールが途中で書き換えられても気づかれず、「振込先を変更しました」という偽の内容に改ざんされる危険があります。',
    withConfiguration: 'デジタルの「会社印」をメールに押すことで、内容が少しでも書き換えられたら「偽物」とすぐにバレる仕組みです。大手企業との取引でも「この会社は信頼できる」と認められます。',
    analogy: '重要書類に割印を押すように、メール全体に「改ざん防止シール」を貼るイメージです。',
    whatIs: 'メールに会社の実印を押す機能。割印のように改ざん防止する'
  };
}

/**
 * DMARCの説明文を取得
 * @returns {Object} DMARCの説明文セット
 */
export function getDMARCExplanation() {
  return {
    title: 'DMARC（最終防衛ライン）',
    oneLineDescription: 'SPFとDKIMの2つの機能を組み合わせて、偽メールを完全シャットアウトする「最終防衛ライン」',
    withoutConfiguration: 'SPFやDKIMでチェックしても、すり抜ける巧妙な偽メールがあり、社長なりすまし詐欺（CEO詐欺）で、中小企業でも数百万円〜数千万円の被害に遭うケースが急増しています。',
    withConfiguration: '「偽物と判定されたメールは必ず迷惑メールへ」「または完全に受信拒否」という厳格なルールを設定でき、なりすましを徹底的に防げます。取引先からの信頼も高まります。',
    analogy: '警備員が「社員証」と「入館証」の両方をチェックし、どちらか一つでも怪しければ絶対に中に入れない、という二重セキュリティゲートです。',
    whatIs: 'SPFとDKIMを組み合わせた最終防衛ライン。社員証と入館証の二重チェック'
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
      message: '問題ありません',
      detail: 'メール配信のセキュリティ設定は全て適切に構成されています。',
      needsConsultation: false,
      consultationMessage: 'さらに詳しく診断したい方はこちら'
    };
  }

  return {
    status: 'warning',
    message: `${notConfigured.join('、')}が未設定です`,
    detail: '設定には専門的な知識が必要です',
    needsConsultation: true,
    consultationMessage: '専門家に相談する'
  };
}