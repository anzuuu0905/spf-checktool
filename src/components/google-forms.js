/**
 * Google Forms統合コンポーネント
 * @module components/google-forms
 */

// Google Forms のURL（別タブで開く用）
const GOOGLE_FORMS_URL = 'https://forms.gle/fBEiPFxku2cdnwtL8';

// フォームエリアのインスタンスを保持（重複防止）
let formsAreaInstance = null;

/**
 * 診断結果に問題があるかを判定
 * @param {Object} diagnosisResults - 診断結果
 * @param {number} score - 診断スコア
 * @returns {boolean} 問題ありの場合true
 */
export function hasIssues(diagnosisResults, score = 100) {
  // SPF/DKIM/DMARCのいずれかが未設定
  const hasConfigurationIssues =
    diagnosisResults.spf?.status !== 'configured' ||
    diagnosisResults.dkim?.status !== 'configured' ||
    diagnosisResults.dmarc?.status !== 'configured';

  // スコアが79点以下
  const hasScoreIssues = score <= 79;

  return hasConfigurationIssues || hasScoreIssues;
}

/**
 * 診断スコアを計算
 * @param {Object} diagnosisResults - 診断結果
 * @returns {number} 診断スコア（0-100）
 */
export function calculateScore(diagnosisResults) {
  let score = 100;

  // SPF未設定: -40点
  if (diagnosisResults.spf?.status !== 'configured') {
    score -= 40;
  }

  // DKIM未設定: -30点
  if (diagnosisResults.dkim?.status !== 'configured') {
    score -= 30;
  }

  // DMARC未設定: -20点
  if (diagnosisResults.dmarc?.status !== 'configured') {
    score -= 20;
  }

  return Math.max(0, score);
}

/**
 * Google Formsエリアを作成または更新
 * @param {boolean} hasProblems - 問題ありかどうか
 * @param {HTMLElement} targetContainer - 挿入先のコンテナ要素
 * @returns {HTMLElement} 作成されたフォームエリア
 */
export function createOrUpdateFormsArea(hasProblems, targetContainer) {
  // 既存のフォームエリアがあるか確認
  let formsArea = document.getElementById('google-forms-area');
  const isUpdate = !!formsArea;

  // 見出しと説明文の設定
  const heading = hasProblems
    ? '設定方法がわからない方<br>専門家に相談したい方'
    : 'メール認証結果は良好です。';

  const description = hasProblems
    ? 'SPF/DKIM/DMARCの設定は専門的な知識が必要です。設定方法がわからない、または専門家に任せたいという方は、お気軽にご相談ください。'
    : '定期的にメンテナンスを行わないと、気付かないうちにフォームの不具合や、セキュリティリスクが発生するケースがあります。\n安定したサイト運用を行うためにも定期的に保守することをお勧めします。';

  const ariaLabel = hasProblems
    ? '専門家への相談フォーム'
    : 'その他のご相談フォーム';

  const buttonText = hasProblems
    ? '診断結果について相談する'
    : 'サイト保守について相談する';

  if (!formsArea) {
    // 新規作成
    formsArea = document.createElement('section');
    formsArea.id = 'google-forms-area';
    formsArea.className = 'google-forms-section';
    formsArea.setAttribute('role', 'region');
    // Let CSS handle the animation completely

    // HTMLを構築（新規作成時）
    formsArea.innerHTML = `
      <div class="forms-container">
        <h2 class="forms-heading">${heading}</h2>
        <p class="forms-description">${description.replace(/\n/g, '<br>')}</p>
        <div class="forms-button-container">
          <div class="btn-animation-wrapper">
            <a
              href="${GOOGLE_FORMS_URL}"
              target="_blank"
              rel="noopener noreferrer"
              class="forms-button"
              aria-label="${ariaLabel}">
              ${buttonText}
            </a>
          </div>
        </div>
      </div>
    `;

    // 診断結果セクションの直後に挿入（親要素に追加）
    const parentContainer = targetContainer.parentElement;
    if (parentContainer) {
      // targetContainer（resultsセクション）の次の要素として挿入
      const nextSibling = targetContainer.nextElementSibling;
      if (nextSibling) {
        parentContainer.insertBefore(formsArea, nextSibling);
      } else {
        parentContainer.appendChild(formsArea);
      }
    } else {
      // フォールバック：targetContainer内に追加
      targetContainer.appendChild(formsArea);
    }

    // CSS animationがtriggerされるよう、小さな遅延を入れる
    // (DOMに追加後にanimationがスタートするため)
  } else {
    // 既存フォームの更新（見出しと説明文のみ）
    const headingElement = formsArea.querySelector('.forms-heading');
    const descriptionElement = formsArea.querySelector('.forms-description');
    const buttonElement = formsArea.querySelector('.forms-button');

    if (headingElement) {
      headingElement.innerHTML = heading;
    }
    if (descriptionElement) {
      descriptionElement.innerHTML = description.replace(/\n/g, '<br>');
    }
    if (buttonElement) {
      buttonElement.textContent = buttonText;
      buttonElement.setAttribute('aria-label', ariaLabel);
    }
  }

  // ARIAラベルを設定
  formsArea.setAttribute('aria-label', ariaLabel);

  // インスタンスを保持
  formsAreaInstance = formsArea;

  return formsArea;
}

/**
 * フォームエリアまで自動スクロール
 * @param {number} delay - スクロール開始までの遅延（ミリ秒）
 */
export function scrollToFormsArea(delay = 500) {
  setTimeout(() => {
    const formsArea = document.getElementById('google-forms-area');
    if (formsArea) {
      // SPF結果が見える位置にスクロール（診断結果の下部）
      const resultsSection = document.getElementById('result-section');
      if (resultsSection) {
        const rect = resultsSection.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = scrollTop + rect.top;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    }
  }, delay);
}

/**
 * GA4イベントをトラッキング
 * @param {boolean} hasProblems - 問題ありかどうか
 */
export function trackFormsDisplay(hasProblems) {
  // gtag が利用可能か確認
  if (typeof gtag === 'function') {
    // フォーム表示イベント
    gtag('event', 'form_displayed', {
      diagnosis_result: hasProblems ? 'has_issues' : 'no_issues',
      form_type: hasProblems ? 'support_request' : 'other_consultation'
    });

    // スクロール到達の監視
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // フォーム表示イベント
          gtag('event', 'form_viewed', {
            diagnosis_result: hasProblems ? 'has_issues' : 'no_issues',
            form_type: hasProblems ? 'support_request' : 'other_consultation'
          });
          // 一度だけトラッキングする
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    const formsArea = document.getElementById('google-forms-area');
    if (formsArea) {
      observer.observe(formsArea);
    }
  }
}

/**
 * Google Forms統合を実行
 * @param {Object} diagnosisResults - 診断結果
 * @param {HTMLElement} resultsSection - 結果セクション
 */
export function integrateGoogleForms(diagnosisResults, resultsSection) {
  // スコアを計算
  const score = calculateScore(diagnosisResults);

  // 問題判定
  const hasProblems = hasIssues(diagnosisResults, score);

  // 診断結果セクションにクラスを追加
  if (hasProblems) {
    resultsSection.classList.add('has-issues');
    resultsSection.classList.remove('no-issues');
  } else {
    resultsSection.classList.add('no-issues');
    resultsSection.classList.remove('has-issues');
  }

  // フォームエリアを作成または更新
  createOrUpdateFormsArea(hasProblems, resultsSection);

  // GA4トラッキング
  trackFormsDisplay(hasProblems);

  // 自動スクロール
  scrollToFormsArea();

  return {
    score,
    hasProblems,
    formsAreaElement: formsAreaInstance
  };
}