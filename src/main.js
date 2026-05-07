/**
 * メール配信診断ツール メインアプリケーション
 * @module main
 */

import { getDomainRecords } from './api/dns-resolver.js';
import { diagnoseSPF } from './diagnosis/spf-diagnosis.js';
import { diagnoseDKIMMultiple } from './diagnosis/dkim-diagnosis.js';
import { diagnoseDMARC } from './diagnosis/dmarc-diagnosis.js';
import { getSummaryMessage } from './formatters/beginner-formatter.js';

// DOM要素の取得
const domainInput = document.getElementById('domain-input');
const diagnoseButton = document.getElementById('diagnose-button');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const ctaSection = document.getElementById('cta-section');

/**
 * エラーメッセージ自動非表示のタイマーID
 */
let errorTimeoutId = null;

/**
 * 診断実行中フラグ（重複実行防止）
 */
let isPerformingDiagnosis = false;

/**
 * エラーメッセージを表示
 * @param {string} message - エラーメッセージ
 */
function showError(message) {
  // 既存のタイマーをクリア
  if (errorTimeoutId !== null) {
    clearTimeout(errorTimeoutId);
    errorTimeoutId = null;
  }

  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  // 5秒後に自動非表示
  errorTimeoutId = setTimeout(() => {
    errorMessage.classList.add('hidden');
    errorTimeoutId = null;
  }, 5000);
}

/**
 * エラーメッセージをクリア
 */
function clearError() {
  // タイマーをクリア
  if (errorTimeoutId !== null) {
    clearTimeout(errorTimeoutId);
    errorTimeoutId = null;
  }

  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

/**
 * ローディング表示の制御
 * @param {boolean} show - 表示/非表示
 */
function setLoading(show) {
  if (show) {
    loading.classList.remove('hidden');
    diagnoseButton.disabled = true;
    results.classList.add('hidden');
  } else {
    loading.classList.add('hidden');
    diagnoseButton.disabled = false;
  }
}

/**
 * 診断結果カードを更新
 * @param {string} type - 'spf' | 'dkim' | 'dmarc'
 * @param {Object} diagnosis - 診断結果
 */
function updateResultCard(type, diagnosis) {
  const card = document.querySelector(`[data-testid="${type}-result"]`);
  if (!card) return;

  // ステータスアイコンとテキスト
  const statusIcon = card.querySelector('.status-icon');
  const statusText = card.querySelector('.status-text');

  // ステータスに応じてアイコンを設定
  statusIcon.className = 'status-icon';
  statusIcon.innerHTML = '';

  if (diagnosis.status === 'configured') {
    statusIcon.classList.add('status-success');
    statusIcon.innerHTML = '✓';
    statusIcon.setAttribute('data-testid', 'check-icon');
    statusText.textContent = '設定済み';
  } else {
    if (type === 'spf') {
      statusIcon.classList.add('status-error');
      statusIcon.innerHTML = '⚠';
      statusIcon.setAttribute('data-testid', 'warning-icon');
    } else if (type === 'dkim') {
      statusIcon.classList.add('status-warning');
      statusIcon.innerHTML = '⚠';
      statusIcon.setAttribute('data-testid', 'warning-icon');
    } else if (type === 'dmarc') {
      statusIcon.classList.add('status-info');
      statusIcon.innerHTML = 'ℹ';
      statusIcon.setAttribute('data-testid', 'info-icon');
    }
    statusText.textContent = '未設定';
  }

  // 説明文
  const explanation = card.querySelector('.explanation');
  if (diagnosis.explanation) {
    explanation.textContent = diagnosis.explanation;
    explanation.style.display = 'block';
  } else {
    explanation.style.display = 'none';
  }

  // 「〜とは何ですか？」の詳細説明
  const whatIsContent = card.querySelector('.what-is-content');
  if (diagnosis.whatIs) {
    whatIsContent.textContent = diagnosis.whatIs;
  }
}

/**
 * CTAセクションを更新
 * @param {Object} summary - サマリー情報
 */
function updateCTA(summary) {
  const ctaMessage = ctaSection.querySelector('.cta-message');
  const ctaButton = document.getElementById('cta-button');
  const ctaLink = document.getElementById('cta-link');

  if (summary.status === 'success') {
    // 全て設定済みの場合
    ctaMessage.textContent = '問題ありません';
    ctaMessage.classList.add('success-message');
    ctaButton.style.display = 'none';
    ctaLink.style.display = 'inline-block';
    ctaLink.textContent = 'さらに詳しく診断したい方はこちら';
    ctaLink.href = 'https://forms.example.com/email-support';
  } else {
    // 未設定項目がある場合
    ctaMessage.textContent = '設定には専門的な知識が必要です';
    ctaMessage.classList.remove('success-message');
    ctaButton.style.display = 'block';
    ctaButton.textContent = '専門家に相談する';
    ctaButton.onclick = () => {
      window.open('https://forms.example.com/email-support', '_blank');
    };
    ctaLink.style.display = 'none';
  }

  ctaSection.style.display = 'block';
}

/**
 * ドメインのバリデーション
 * @param {string} domain - ドメイン名
 * @returns {string|null} エラーメッセージ（正常な場合はnull）
 */
function validateDomain(domain) {
  if (!domain || domain.trim() === '') {
    return 'ドメインを入力してください';
  }

  const trimmed = domain.trim();

  // 全角スペースのチェック
  if (trimmed.match(/[\u3000]/)) {
    return 'ドメインを入力してください';
  }

  // 日本語以外の全角文字のチェック
  if (trimmed.match(/[^\x00-\x7F]/) && !trimmed.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/)) {
    return '正しいドメインを入力してください';
  }

  return null;
}

/**
 * 診断を実行
 */
async function performDiagnosis() {
  // 重複実行を防止
  if (isPerformingDiagnosis) {
    console.log('診断実行中のため、スキップしました');
    return;
  }

  isPerformingDiagnosis = true;

  const domain = domainInput.value.trim();

  // バリデーション
  const validationError = validateDomain(domain);
  if (validationError) {
    showError(validationError);
    isPerformingDiagnosis = false;
    return;
  }

  clearError();
  setLoading(true);

  try {
    // DNSレコードを取得
    const records = await getDomainRecords(domain);

    // 診断を実行
    const spfDiagnosis = diagnoseSPF(records.spf);
    const dkimDiagnosis = diagnoseDKIMMultiple(records.dkim);
    const dmarcDiagnosis = diagnoseDMARC(records.dmarc);

    // 結果を表示
    updateResultCard('spf', spfDiagnosis);
    updateResultCard('dkim', dkimDiagnosis);
    updateResultCard('dmarc', dmarcDiagnosis);

    // サマリーとCTAを表示
    const summary = getSummaryMessage({
      spf: { isConfigured: spfDiagnosis.status === 'configured' },
      dkim: { isConfigured: dkimDiagnosis.status === 'configured' },
      dmarc: { isConfigured: dmarcDiagnosis.status === 'configured' }
    });
    updateCTA(summary);

    // 結果を表示
    results.classList.remove('hidden');
  } catch (error) {
    console.error('診断エラー:', error);
    showError(error.message || '診断中にエラーが発生しました');
  } finally {
    setLoading(false);
    isPerformingDiagnosis = false;
  }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // 既存のリスナーを削除してから追加（HMR対策）
  // ※ isPerformingDiagnosis フラグで重複実行は防止される
  diagnoseButton.removeEventListener('click', performDiagnosis);
  diagnoseButton.addEventListener('click', performDiagnosis);

  // Enterキーで診断実行
  domainInput.removeEventListener('keypress', handleEnterKey);
  domainInput.addEventListener('keypress', handleEnterKey);
}

/**
 * Enterキーハンドラー
 */
function handleEnterKey(event) {
  if (event.key === 'Enter') {
    performDiagnosis();
  }
}

/**
 * アプリケーション初期化
 */
function init() {
  setupEventListeners();

  // 初期フォーカス
  domainInput.focus();
}

// DOMContentLoaded イベントで初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}