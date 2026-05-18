/**
 * なりすまし対策診断ツール — メインアプリケーション
 * Sprint 5: モックv2 反映（信号機3色 + 達成率 + 4パターン判定）
 *
 * @module main
 */

import { getDomainRecords } from './api/dns-resolver.js';
import { getDomainRecordsWithMock } from './api/dns-resolver-mock.js';
import { diagnoseSPF } from './diagnosis/spf-diagnosis.js';
import { diagnoseDKIMMultiple } from './diagnosis/dkim-diagnosis.js';
import { diagnoseDMARC } from './diagnosis/dmarc-diagnosis.js';
import { inferProviderFromMX } from './parsers/mx-provider-mapping.js';

// ====================================================================
// DOM 要素
// ====================================================================
const domainInput = document.getElementById('domain-input');
const selectorInput = document.getElementById('selector-input');
const diagnoseButton = document.getElementById('diagnose-button');
const diagnosisForm = document.getElementById('diagnosis-form');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const resultSection = document.getElementById('result-section');
const verdictBanner = document.getElementById('verdict-banner');
const verdictLabelEl = document.getElementById('verdict-label');
const verdictLabelText = verdictLabelEl?.querySelector('.verdict-label-text');
const verdictSummary = document.getElementById('verdict-summary');
const checkMarksContainer = document.getElementById('check-marks');
const cpNumEl = document.getElementById('cp-num');
const eduAccordion = document.getElementById('edu-accordion');

// ====================================================================
// 状態管理
// ====================================================================
let errorTimeoutId = null;
let isPerformingDiagnosis = false;

// ====================================================================
// SVG 定数
// ====================================================================
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

// ====================================================================
// エラー表示
// ====================================================================

function showError(message) {
  if (errorTimeoutId !== null) {
    clearTimeout(errorTimeoutId);
    errorTimeoutId = null;
  }
  if (!errorMessage) return;

  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  errorTimeoutId = setTimeout(() => {
    errorMessage.classList.add('hidden');
    errorTimeoutId = null;
  }, 5000);
}

function clearError() {
  if (errorTimeoutId !== null) {
    clearTimeout(errorTimeoutId);
    errorTimeoutId = null;
  }
  if (!errorMessage) return;
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

// ====================================================================
// ローディング表示
// ====================================================================

function setLoading(show) {
  if (show) {
    loading?.classList.remove('hidden');
    if (diagnoseButton) diagnoseButton.disabled = true;
    resultSection?.classList.add('hidden');
  } else {
    loading?.classList.add('hidden');
    if (diagnoseButton) diagnoseButton.disabled = false;
  }
}

// ====================================================================
// バリデーション
// ====================================================================

function validateDomain(domain) {
  if (!domain || domain.trim() === '') {
    return 'ドメイン名を入力してください（例: example.com）';
  }
  const trimmed = domain.trim();

  // 半角・全角スペースを含む
  if (/[\s　]/.test(trimmed)) {
    return '空白を含まないドメイン名を入力してください（例: example.com）';
  }

  // メールアドレス形式（@を含む）
  if (trimmed.includes('@')) {
    return 'メールアドレスではなく、ドメイン名（@より後ろの部分）を入力してください（例: example.com）';
  }

  // URL 形式（http:// https:// で始まる、または /:?# を含む）
  if (/^https?:\/\//i.test(trimmed)) {
    return 'URL ではなくドメイン名のみを入力してください（例: example.com）';
  }
  if (/[\/:?#]/.test(trimmed)) {
    return 'ドメイン名のみを入力してください。パスや「:」「?」「#」は不要です（例: example.com）';
  }

  // 全角文字（日本語IDNは除く）
  const hasFullWidthAscii = /[！-～]/.test(trimmed); // 全角英数記号
  if (hasFullWidthAscii) {
    return '半角英数字のドメイン名を入力してください（例: example.com）';
  }

  // ドットを含まない（TLD なし）
  if (!trimmed.includes('.')) {
    return 'ドットを含む正しいドメイン名を入力してください（例: example.com）';
  }

  // 先頭/末尾がドット・ハイフン
  if (/^[.-]|[.-]$/.test(trimmed)) {
    return '正しいドメイン名を入力してください（例: example.com）';
  }

  // 連続ドット
  if (/\.\./.test(trimmed)) {
    return '正しいドメイン名を入力してください（例: example.com）';
  }

  return null;
}

function validateSelector(selector) {
  if (!selector || selector.trim() === '') {
    return null; // 任意項目なので空でもOK
  }
  const trimmed = selector.trim();

  if (/[\s　]/.test(trimmed)) {
    return 'セレクター名に空白を含めることはできません';
  }
  // セレクターは英数字・ハイフン・アンダースコア・ドットのみ許容
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'セレクター名は半角英数字・ハイフン・アンダースコア・ドットのみ使用できます（例: google, selector1, 20230601）';
  }
  // _domainkey が含まれていたらユーザーが間違えて入れた可能性あり
  if (trimmed.includes('_domainkey')) {
    return 'セレクター名のみを入力してください。「_domainkey」部分は自動で付与されます（例: google）';
  }
  return null;
}

// ====================================================================
// 4パターン判定ロジック
//
// パターン1 (緑/安全/3): SPF=設定済み & DKIM=設定済み & DMARC ポリシー quarantine 以上
// パターン2 (黄/要改善/2): SPF=設定済み & DKIM=設定済み & (DMARC 未設定 または 監視モード)
// パターン3 (赤/要対応/1): SPF のみ設定済み
// パターン4 (赤/要対応/0): 全て未設定
// ====================================================================

function determineVerdict(spf, dkim, dmarc) {
  const spfOk = spf.status === 'configured';
  const dkimOk = dkim.status === 'configured';
  const dmarcConfigured = dmarc.status === 'configured';

  // DMARC の policy が quarantine 以上か判定
  const dmarcPolicy = dmarc.details?.policy || null;
  const dmarcStrong = dmarcConfigured && (dmarcPolicy === 'quarantine' || dmarcPolicy === 'reject');

  // パターン1: すべて合格 + DMARC 強い
  if (spfOk && dkimOk && dmarcStrong) {
    return {
      pattern: 1,
      color: 'green',
      label: '安全',
      progressNum: 3,
      progressText: '3項目中3項目クリア',
      summary: '3項目すべて設定済みです。',
      spfDone: true,
      dkimDone: true,
      dmarcDone: true,
      dmarcConfigured: true,
      dmarcPolicy: dmarcPolicy
    };
  }

  // パターン2: SPF + DKIM 合格、DMARC は監視モード（p=none）または未設定
  if (spfOk && dkimOk) {
    const summary = dmarcConfigured
      ? 'SPF と DKIM は設定済みです。DMARC は監視モード（p=none）です。p=quarantine 以上に強化すると、なりすまし対策がより確実になります。'
      : 'SPF と DKIM は設定済みです。DMARC を追加設定すると、なりすまし対策がより確実になります。';
    return {
      pattern: 2,
      color: 'amber',
      label: '要改善',
      progressNum: dmarcConfigured ? 2.5 : 2,
      progressText: dmarcConfigured ? '3項目中2.5項目クリア（DMARC強化推奨）' : '3項目中2項目クリア',
      summary,
      spfDone: true,
      dkimDone: true,
      dmarcDone: false,
      dmarcConfigured,
      dmarcPolicy
    };
  }

  // パターン3: SPF のみ
  if (spfOk && !dkimOk) {
    return {
      pattern: 3,
      color: 'red',
      label: '要対応',
      progressNum: 1,
      progressText: '3項目中1項目クリア',
      summary: 'SPF は設定済みですが、DKIM と DMARC の設定が確認できませんでした。この状態では、取引先に送ったメールが迷惑メールフォルダに振り分けられる可能性があります。',
      spfDone: true,
      dkimDone: false,
      dmarcDone: false,
      dmarcConfigured,
      dmarcPolicy
    };
  }

  // パターン4: 全て不合格
  return {
    pattern: 4,
    color: 'red',
    label: '要対応',
    progressNum: 0,
    progressText: '3項目中0項目クリア',
    summary: 'メール認証の設定がまだ整っていない状態です。取引先に送ったメールが迷惑メールフォルダに振り分けられる可能性があります。',
    spfDone: spfOk,
    dkimDone: dkimOk,
    dmarcDone: dmarcConfigured,
    dmarcConfigured,
    dmarcPolicy
  };
}

// ====================================================================
// Verdict バナーの更新
// ====================================================================

function applyVerdict(verdict) {
  if (!verdictBanner) return;

  // クラスを一旦リセット
  verdictBanner.classList.remove('is-green', 'is-amber', 'is-red');
  verdictBanner.classList.add(`is-${verdict.color}`);

  // ラベルテキスト
  if (verdictLabelText) {
    verdictLabelText.textContent = verdict.label;
  }

  // verdict-label の aria-label 用にも反映
  verdictLabelEl?.setAttribute('aria-label', verdict.label);

  // 達成率テキスト
  if (cpNumEl) {
    cpNumEl.textContent = verdict.progressText;
  }

  // check-progress の aria-label を更新
  const checkProgress = document.getElementById('check-progress');
  checkProgress?.setAttribute('aria-label', `達成率: ${verdict.progressText}`);

  // チェックマーク（緑チェック）
  if (checkMarksContainer) {
    const marks = checkMarksContainer.querySelectorAll('.cm');
    marks.forEach((mark) => {
      const protocol = mark.dataset.protocol;
      const done =
        (protocol === 'spf' && verdict.spfDone) ||
        (protocol === 'dkim' && verdict.dkimDone) ||
        (protocol === 'dmarc' && verdict.dmarcDone);
      mark.classList.toggle('is-done', done);
      mark.innerHTML = done ? CHECK_SVG : '';
    });
  }

  // サマリー
  if (verdictSummary) {
    verdictSummary.textContent = verdict.summary;
  }
}

// ====================================================================
// シグナル更新（SPF/DKIM/DMARC 信号機）
// ====================================================================

function applySignal(protocol, state /* 'green' | 'amber' | 'red' | 'off' */, stateText) {
  const signal = document.getElementById(`signal-${protocol}`);
  if (!signal) return;

  signal.classList.remove('on-green', 'on-amber', 'on-red', 'is-off');
  if (state === 'off') {
    signal.classList.add('is-off');
  } else {
    signal.classList.add(`on-${state}`);
  }

  const stateEl = signal.querySelector('.state');
  if (stateEl) {
    stateEl.textContent = stateText;
  }
  // aria-label
  signal.setAttribute('aria-label', `${protocol.toUpperCase()}: ${stateText}`);
}

// ====================================================================
// 結果カードの更新
// ====================================================================

function updateResultCard(type, diagnosis, options = {}) {
  const card = document.querySelector(`[data-testid="${type}-result"]`);
  if (!card) return;

  // ステータスピル
  const pill = card.querySelector('.status-pill');
  const pillText = pill?.querySelector('.status-text');

  if (pill) {
    pill.classList.remove('is-green', 'is-amber', 'is-red');
    pill.classList.add(`is-${options.pillColor || 'red'}`);
  }
  if (pillText) {
    pillText.textContent = diagnosis.message || '';
  }

  // legacy data-testid のためのアイコン要素（既存テスト互換）
  // → 古い構造には存在しないが、テストが status-icon を探す場合に備えて何もしない

  // 説明文
  const explain = card.querySelector('.explain');
  if (explain) {
    if (diagnosis.explanation) {
      explain.textContent = diagnosis.explanation;
      explain.style.display = 'block';
    } else {
      explain.textContent = '';
      explain.style.display = 'none';
    }
  }

  // 注記（DKIM 未検出時のみ）
  const explainNote = card.querySelector('.explain-note');
  if (explainNote) {
    if (diagnosis.explanationNote) {
      explainNote.textContent = diagnosis.explanationNote;
      explainNote.hidden = false;
    } else {
      explainNote.textContent = '';
      explainNote.hidden = true;
    }
  }

  // レコード表示
  const recordBlock = card.querySelector('.record-block');
  if (recordBlock) {
    if (options.recordText) {
      recordBlock.innerHTML = options.recordText;
      recordBlock.hidden = false;
    } else {
      recordBlock.innerHTML = '';
      recordBlock.hidden = true;
    }
  }

  // why-block（未設定 or 未検出時のみ表示）
  const whyBlock = card.querySelector('.why-block');
  if (whyBlock) {
    if (options.whyBodyText) {
      whyBlock.hidden = false;
      whyBlock.classList.toggle('is-red', options.pillColor === 'red');
      const whyBody = whyBlock.querySelector('.why-body');
      if (whyBody) whyBody.textContent = options.whyBodyText;
    } else {
      whyBlock.hidden = true;
    }
  }
}

// ====================================================================
// レコード表示の生成（モックv2 のフォーマットに合わせる）
// ====================================================================

function formatSPFRecord(record) {
  if (!record) return '';
  // v=spf1 を <span class="key"> でハイライト
  const escaped = escapeHtml(record);
  return escaped.replace(/^(v=spf1)/, '<span class="key">$1</span>');
}

function formatDKIMRecord(record) {
  if (!record) return '';
  const escaped = escapeHtml(record);
  return escaped.replace(/(v=DKIM1)/, '<span class="key">$1</span>');
}

function formatDMARCRecord(record) {
  if (!record) return '';
  const escaped = escapeHtml(record);
  return escaped.replace(/(v=DMARC1)/, '<span class="key">$1</span>');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ====================================================================
// Gmail / Yahoo ガイドライン準拠チェック（2024年2月施行）
// ====================================================================

function evaluateGmailCompliance(spf, dkim, dmarc) {
  const spfOk = spf.status === 'configured';
  const dkimOk = dkim.status === 'configured';
  const dmarcConfigured = dmarc.status === 'configured';
  const dmarcPolicy = dmarc.details?.policy || null;

  const checks = [
    {
      label: 'SPF または DKIM が設定されている',
      passed: spfOk || dkimOk
    },
    {
      label: 'From ドメインに DMARC が設定されている',
      passed: dmarcConfigured
    },
    {
      label: 'DMARC ポリシーが宣言されている（p=タグ）',
      passed: dmarcConfigured && !!dmarcPolicy
    },
    {
      label: 'SPF と DKIM の両方が設定されている（5000通/日以上推奨）',
      passed: spfOk && dkimOk
    },
    {
      label: 'DMARC ポリシーが quarantine 以上（5000通/日以上推奨）',
      passed: dmarcConfigured && (dmarcPolicy === 'quarantine' || dmarcPolicy === 'reject')
    }
  ];

  const passedCount = checks.filter(c => c.passed).length;
  const requiredCount = 3; // 最初の3つが大量送信者でなくても必須
  const requiredPassed = checks.slice(0, requiredCount).every(c => c.passed);

  let status, statusLabel;
  if (passedCount === checks.length) {
    status = 'pass';
    statusLabel = '✅ 準拠';
  } else if (requiredPassed) {
    status = 'partial';
    statusLabel = '🟡 一部準拠';
  } else {
    status = 'fail';
    statusLabel = '❌ 非準拠';
  }
  return { status, statusLabel, checks };
}

function renderGmailCompliance(compliance) {
  const statusEl = document.getElementById('gc-status');
  const listEl = document.getElementById('gc-list');
  const section = document.getElementById('gmail-compliance');
  if (!statusEl || !listEl || !section) return;

  section.classList.remove('is-pass', 'is-partial', 'is-fail');
  section.classList.add(`is-${compliance.status}`);
  statusEl.textContent = compliance.statusLabel;

  listEl.innerHTML = '';
  for (const c of compliance.checks) {
    const li = document.createElement('li');
    li.className = c.passed ? 'gc-item is-pass' : 'gc-item is-fail';
    li.innerHTML = `<span class="gc-mark">${c.passed ? '✅' : '⚠️'}</span><span class="gc-label">${c.label}</span>`;
    listEl.appendChild(li);
  }
}

// ====================================================================
// 改善ポイント集約（問題のあるカードからメッセージを集める）
// ====================================================================

function buildTips(spf, dkim, dmarc, verdict, provider) {
  const tips = [];
  if (!verdict.spfDone) {
    tips.push('SPF レコードを DNS に追加してください。Google Workspace 利用時は <code>v=spf1 include:_spf.google.com ~all</code> が基本です。');
  }
  if (!verdict.dkimDone) {
    if (provider) {
      tips.push(`${provider.name} の管理画面で DKIM を有効化してください。${provider.adminGuide}`);
    } else {
      tips.push('ご利用のメールサービスの管理画面で DKIM を有効化し、案内された TXT レコードを DNS に登録してください。');
    }
  }
  if (verdict.dmarcConfigured && !verdict.dmarcDone) {
    tips.push('DMARC ポリシーを <code>p=none</code> から <code>p=quarantine</code> → <code>p=reject</code> へ段階的に強化してください。');
  }
  if (!verdict.dmarcConfigured) {
    tips.push('DMARC レコードを <code>_dmarc.ドメイン</code> に追加してください。最初は <code>v=DMARC1; p=none; rua=mailto:あなたのアドレス</code> から監視モードで始めれば配信に影響はありません。');
  }
  // 鍵長警告
  const keyLen = dkim.details?.keyLength;
  if (verdict.dkimDone && keyLen && keyLen < 2048) {
    tips.push(`DKIM 公開鍵が ${keyLen}bit です。2048bit 以上への更新を推奨します。`);
  }
  return tips;
}

function renderTips(tips) {
  const block = document.getElementById('tips-block');
  const list = document.getElementById('tips-list');
  if (!block || !list) return;
  if (tips.length === 0) {
    block.hidden = true;
    return;
  }
  list.innerHTML = '';
  for (const tip of tips) {
    const li = document.createElement('li');
    li.className = 'tips-item';
    li.innerHTML = `<span class="tips-mark">💡</span><span class="tips-text">${tip}</span>`;
    list.appendChild(li);
  }
  block.hidden = false;
}

// ====================================================================
// DKIM: 検索したセレクター一覧表示
// ====================================================================

function renderSearchedSelectors(dkimRecords) {
  const block = document.getElementById('dkim-searched-block');
  const list = document.getElementById('dkim-searched-list');
  if (!block || !list) return;
  const searched = dkimRecords?.searchedSelectors;
  if (!searched || searched.length === 0) {
    block.hidden = true;
    return;
  }
  list.innerHTML = '';
  for (const item of searched) {
    const li = document.createElement('li');
    li.className = item.found ? 'ss-item is-found' : 'ss-item';
    li.innerHTML = `<span class="ss-mark">${item.found ? '✅' : '○'}</span><code class="ss-name">${item.selector}</code>`;
    list.appendChild(li);
  }
  block.hidden = false;
}

// ====================================================================
// DKIM: 公開鍵の鍵長 UI 表示
// ====================================================================

function renderDkimKeyLength(dkim) {
  const row = document.getElementById('dkim-keylen-row');
  const value = document.getElementById('dkim-keylen-value');
  if (!row || !value) return;
  const keyLen = dkim.details?.keyLength;
  if (!keyLen) {
    row.hidden = true;
    return;
  }
  let icon = '✅';
  let level = 'is-ok';
  if (keyLen < 1024) {
    icon = '❌';
    level = 'is-error';
  } else if (keyLen < 2048) {
    icon = '⚠️';
    level = 'is-warn';
  }
  row.classList.remove('is-ok', 'is-warn', 'is-error');
  row.classList.add(level);
  value.innerHTML = `${icon} <strong>${keyLen}bit</strong>${keyLen < 2048 ? '（2048bit 以上を推奨）' : '（推奨基準を満たしています）'}`;
  row.hidden = false;
}

// ====================================================================
// DMARC: ポリシー強度メーター
// ====================================================================

function renderDmarcPolicyMeter(dmarc) {
  const meter = document.getElementById('dmarc-policy-meter');
  const valueEl = document.getElementById('pm-value');
  const noteEl = document.getElementById('pm-note');
  if (!meter || !valueEl || !noteEl) return;

  if (dmarc.status !== 'configured') {
    meter.hidden = true;
    return;
  }
  const policy = dmarc.details?.policy || 'none';
  let level = 1;
  let label = 'none（監視のみ）';
  let note = '監視モードのみで、なりすましメールの隔離・拒否は行われません。次のステップは p=quarantine です。';
  if (policy === 'quarantine') {
    level = 2;
    label = 'quarantine（隔離）';
    note = '受信側でなりすましメールが迷惑メールフォルダに隔離されます。最終的には p=reject への強化を推奨します。';
  } else if (policy === 'reject') {
    level = 3;
    label = 'reject（拒否・最強）';
    note = '最も強い設定です。なりすましメールは受信側で拒否されます。';
  }
  meter.classList.remove('level-1', 'level-2', 'level-3');
  meter.classList.add(`level-${level}`);
  valueEl.textContent = label;
  noteEl.textContent = note;
  meter.hidden = false;
}

// ====================================================================
// CTA 上部 — consult-lead の出し分け（パターン別）
// ====================================================================

function updateConsultTopLead(pattern) {
  const lead = document.getElementById('consult-top-lead');
  if (!lead) return;
  switch (pattern) {
    case 1:
      lead.textContent = '追加で気になることや、関連会社・取引先のチェックも一緒に対応します。お気軽にどうぞ。';
      break;
    case 2:
      lead.textContent = 'DMARC を追加で設定するには、最初は監視モードから始めれば配信に影響はありません。具体的な手順はメールでご案内します。';
      break;
    case 3:
      lead.textContent = 'DKIM・DMARC の追加設定方法、貴社の利用サービス（Google Workspace / Microsoft 365 など）に応じた手順をメールでご案内します。';
      break;
    case 4:
      lead.textContent = '3項目すべて新規設定が必要です。貴社の利用サービスに応じた具体的な手順をメールでご案内します。';
      break;
    default:
      lead.textContent = '気になる点や設定方法など、お気軽にご相談ください。';
  }
}

// ====================================================================
// 教育アコーディオンの初期展開制御
//   パターン1 (緑): 全閉
//   パターン2/3/4 (黄/赤): 「なぜ必要」(data-section="why") のみ初期展開
// ====================================================================

function applyAccordionState(pattern) {
  if (!eduAccordion) return;
  const items = eduAccordion.querySelectorAll('details');
  items.forEach((d) => {
    const section = d.dataset.section;
    const isWhy = section === 'why';
    const shouldOpen = pattern !== 1 && isWhy;
    d.open = shouldOpen;
    const summary = d.querySelector('summary');
    if (summary) {
      summary.setAttribute('aria-expanded', String(shouldOpen));
    }
  });
}

// ====================================================================
// メイン処理 — 診断実行
// ====================================================================

async function performDiagnosis() {
  if (isPerformingDiagnosis) {
    return;
  }
  isPerformingDiagnosis = true;

  const domain = domainInput.value.trim();
  const validationError = validateDomain(domain);
  if (validationError) {
    showError(validationError);
    isPerformingDiagnosis = false;
    return;
  }

  const customSelector = selectorInput ? selectorInput.value.trim() : '';
  const selectorError = validateSelector(customSelector);
  if (selectorError) {
    showError(selectorError);
    isPerformingDiagnosis = false;
    return;
  }

  clearError();
  setLoading(true);

  try {
    const isTestDomain = domain === 'perfect.example.com' || domain === 'allgood.test.com';
    const records = isTestDomain
      ? await getDomainRecordsWithMock(domain)
      : await getDomainRecords(domain, customSelector || null);

    const spfDiagnosis = diagnoseSPF(records.spf);
    const dkimDiagnosis = diagnoseDKIMMultiple(records.dkim);
    const dmarcDiagnosis = diagnoseDMARC(records.dmarc);

    // 4パターン判定
    const verdict = determineVerdict(spfDiagnosis, dkimDiagnosis, dmarcDiagnosis);
    applyVerdict(verdict);

    // 信号機シグナル
    applySignal(
      'spf',
      verdict.spfDone ? 'green' : 'off',
      verdict.spfDone ? '設定済み' : '未設定'
    );
    applySignal(
      'dkim',
      verdict.dkimDone ? 'green' : 'off',
      verdict.dkimDone ? '設定済み' : '未検出'
    );
    // DMARC: 完全設定（quarantine/reject）= green、監視モード（p=none）= amber、未設定 = off
    let dmarcLamp = 'off';
    let dmarcLabel = '未設定';
    if (verdict.dmarcDone) {
      dmarcLamp = 'green';
      dmarcLabel = '設定済み';
    } else if (verdict.dmarcConfigured) {
      dmarcLamp = 'amber';
      dmarcLabel = '監視のみ';
    }
    applySignal('dmarc', dmarcLamp, dmarcLabel);

    // SPF カード
    updateResultCard('spf', spfDiagnosis, {
      pillColor: verdict.spfDone ? 'green' : 'red',
      recordText: verdict.spfDone ? formatSPFRecord(records.spf) : null,
      whyBodyText: !verdict.spfDone
        ? 'SPF が無いと、貴社の正規のメールサーバーかどうか判別できず、第三者が貴社の名前でメールを送ることができてしまいます。'
        : null
    });

    // MX レコードからプロバイダー推測
    const provider = inferProviderFromMX(records.mx || []);

    // DKIM カード
    // 検出済み DKIM レコードがあれば最初のものを表示
    const dkimRecordText = records.dkim?.[0]?.record || null;
    updateResultCard('dkim', dkimDiagnosis, {
      pillColor: verdict.dkimDone ? 'green' : 'red',
      recordText: verdict.dkimDone && dkimRecordText ? formatDKIMRecord(dkimRecordText) : null,
      whyBodyText: !verdict.dkimDone
        ? 'DKIM が見つからないと、取引先のGmail/Outlookなどで迷惑メールフォルダに振り分けられたり、メールが途中で書き換えられても気づけない状態になる可能性があります。'
        : null
    });

    // DKIM 未検出時に MX 推測プロバイダーの案内を explain-note に上書き
    if (!verdict.dkimDone && provider) {
      const dkimCard = document.querySelector('[data-testid="dkim-result"]');
      const noteEl = dkimCard?.querySelector('.explain-note');
      if (noteEl) {
        let html = `MX レコードから <strong>${provider.name}</strong> をご利用と推測されますが、独自ドメインの DKIM セレクターが見つかりませんでした。${provider.adminGuide} メールヘッダーの <code>DKIM-Signature</code> 内 <code>s=</code> タグの値を「DKIM セレクター名（任意）」に入力すると、ピンポイントで判定できます。`;
        if (provider.thirdPartySigning) {
          html += `<br><br><strong>※ 第三者署名の可能性:</strong> ${provider.thirdPartySigning}`;
        }
        noteEl.innerHTML = html;
        noteEl.hidden = false;
      }
    }

    // DKIM: 公開鍵の鍵長表示
    renderDkimKeyLength(dkimDiagnosis);

    // DKIM: 検索したセレクター一覧
    renderSearchedSelectors(records.dkim);

    // DMARC カード
    // 判定: 完全設定(quarantine/reject) = green、監視モード(p=none) = amber、未設定 = red
    let dmarcPillColor = 'red';
    if (verdict.dmarcDone) {
      dmarcPillColor = 'green';
    } else if (verdict.dmarcConfigured) {
      // p=none で設定済み → amber（設定はされているが強化推奨）
      dmarcPillColor = 'amber';
    } else if (verdict.pattern === 2) {
      dmarcPillColor = 'amber';
    }
    // DMARC レコードが存在すれば（policy 問わず）レコード表示する
    const dmarcRecordVisible = verdict.dmarcDone || verdict.dmarcConfigured;
    updateResultCard('dmarc', dmarcDiagnosis, {
      pillColor: dmarcPillColor,
      recordText: dmarcRecordVisible ? formatDMARCRecord(records.dmarc) : null,
      whyBodyText: !verdict.dmarcDone
        ? (verdict.dmarcConfigured
            ? 'DMARC は監視モード（p=none）で設定されています。なりすましメールが届いた場合の対処（隔離・拒否）は行われません。p=quarantine 以上に強化すると、なりすましメールが受信側で自動的に隔離・拒否されるようになります。'
            : (verdict.pattern === 2
                ? 'SPF と DKIM の結果を踏まえた運用ポリシーがまだ無く、なりすましメールが届いた場合の対処が決まっていません。'
                : '現在の設定では、なりすましメールが取引先に届いてしまう可能性があります。あとから問題があったか確認するレポートも受け取れません。'))
        : null
    });

    // DMARC: ポリシー強度メーター
    renderDmarcPolicyMeter(dmarcDiagnosis);

    // Gmail / Yahoo ガイドライン準拠チェック
    const compliance = evaluateGmailCompliance(spfDiagnosis, dkimDiagnosis, dmarcDiagnosis);
    renderGmailCompliance(compliance);

    // 改善ポイント集約
    const tips = buildTips(spfDiagnosis, dkimDiagnosis, dmarcDiagnosis, verdict, provider);
    renderTips(tips);

    // CTA 上部のリード文をパターン別に変更
    updateConsultTopLead(verdict.pattern);

    // 教育アコーディオンの初期展開
    applyAccordionState(verdict.pattern);

    // 結果セクションを表示
    resultSection.classList.remove('hidden');

    // GA4 イベント発火（既存トラッキング維持）
    if (typeof gtag === 'function') {
      gtag('event', 'diagnosis_complete', {
        pattern: verdict.pattern,
        color: verdict.color,
        spf_ok: verdict.spfDone,
        dkim_ok: verdict.dkimDone,
        dmarc_ok: verdict.dmarcDone
      });
    }

    // 結果セクションの先頭にスクロール（モバイル配慮）
    setTimeout(() => {
      const top = resultSection.getBoundingClientRect().top + window.pageYOffset - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 100);
  } catch (error) {
    console.error('診断エラー:', error);
    showError(error.message || '診断中にエラーが発生しました');
  } finally {
    setLoading(false);
    isPerformingDiagnosis = false;
  }
}

// ====================================================================
// イベントリスナー
// ====================================================================

function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    performDiagnosis();
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  performDiagnosis();
}

function setupEventListeners() {
  if (diagnosisForm) {
    diagnosisForm.removeEventListener('submit', handleFormSubmit);
    diagnosisForm.addEventListener('submit', handleFormSubmit);
  }
  if (diagnoseButton) {
    diagnoseButton.removeEventListener('click', performDiagnosis);
    diagnoseButton.addEventListener('click', (e) => {
      e.preventDefault();
      performDiagnosis();
    });
  }
  if (domainInput) {
    domainInput.removeEventListener('keypress', handleEnterKey);
    domainInput.addEventListener('keypress', handleEnterKey);
  }
}

function init() {
  setupEventListeners();
  if (domainInput) domainInput.focus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
