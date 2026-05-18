/**
 * DomainNormalizer.gs
 *
 * AC 列の生入力をドメインに正規化する。
 * GAS には URL クラスも punycode ライブラリもないため、軽量な実装で代替する。
 *
 * 正規化方針（スプリント契約 AC-1 準拠）:
 *   1. trim()
 *   2. 小文字化
 *   3. URL 形式（http://, https://, またはスラッシュを含む）ならホスト名抽出
 *   4. ポート番号やパス、クエリは除去
 *   5. ASCII 以外（日本語ドメイン等）は Punycode 変換相当の処理を試みる
 *      - GAS は URL クラスを持たないため、IDNA 完全互換は提供不可。
 *        ホスト部に非 ASCII を含む場合は xn-- プレフィックスでの簡易変換を試み、
 *        変換できなければ INVALID_DOMAIN 扱いとする。
 */

/**
 * 入力文字列をドメインに正規化する。
 * 正規化に失敗した場合は例外を投げる。
 *
 * @param {string} input
 * @returns {string} 正規化済みドメイン（小文字 ASCII）
 * @throws {Error} INVALID_DOMAIN
 */
function DomainNormalizer_normalize(input) {
  if (input === null || input === undefined) {
    throw new Error('INVALID_DOMAIN');
  }

  var s = String(input).trim();
  if (s === '') {
    throw new Error('INVALID_DOMAIN');
  }

  s = s.toLowerCase();

  // URL 形式（プロトコル付き）
  if (/^https?:\/\//i.test(s)) {
    s = s.replace(/^https?:\/\//i, '');
  }

  // スラッシュ・クエリ・フラグメントを除去（パス以降を切り捨て）
  s = s.split('/')[0];
  s = s.split('?')[0];
  s = s.split('#')[0];

  // basic auth が含まれる場合（user:pass@host）は @ 以降のみ採用
  if (s.indexOf('@') !== -1) {
    s = s.substring(s.indexOf('@') + 1);
  }

  // ポート番号を除去
  s = s.split(':')[0];

  // 末尾のドットを除去（FQDN 表記）
  if (s.length > 0 && s.charAt(s.length - 1) === '.') {
    s = s.substring(0, s.length - 1);
  }

  // 全角スペース・通常スペース・制御文字を含めば不正
  if (/[\s　\x00-\x1f]/.test(s)) {
    throw new Error('INVALID_DOMAIN');
  }

  // 空チェック
  if (s === '') {
    throw new Error('INVALID_DOMAIN');
  }

  // 非 ASCII を含む場合（日本語ドメイン等）
  if (/[^\x00-\x7f]/.test(s)) {
    s = DomainNormalizer_toAscii_(s);
  }

  // 最終的なドメイン文字種チェック
  // 各ラベルは英数字・ハイフン・xn--、ドットで区切られている
  if (!/^[a-z0-9.\-]+$/.test(s)) {
    throw new Error('INVALID_DOMAIN');
  }

  // ドット 1 個以上必要（TLD のみは不正）
  if (s.indexOf('.') === -1) {
    throw new Error('INVALID_DOMAIN');
  }

  // ラベルの長さ・先頭末尾チェック
  var labels = s.split('.');
  for (var i = 0; i < labels.length; i++) {
    var lbl = labels[i];
    if (lbl === '' || lbl.length > 63) {
      throw new Error('INVALID_DOMAIN');
    }
    if (lbl.charAt(0) === '-' || lbl.charAt(lbl.length - 1) === '-') {
      throw new Error('INVALID_DOMAIN');
    }
  }

  return s;
}

/**
 * 非 ASCII を含むドメインを Punycode (RFC 3492 / IDNA2008) に変換する。
 * GAS では URL クラスが無いため、純 JavaScript 実装で対応する。
 *
 * @param {string} domain - 非 ASCII を含むドメイン
 * @returns {string} ASCII ドメイン（xn-- プレフィックス付き）
 * @throws {Error} INVALID_DOMAIN
 * @private
 */
function DomainNormalizer_toAscii_(domain) {
  var labels = domain.split('.');
  var asciiLabels = [];
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i];
    if (label === '') {
      throw new Error('INVALID_DOMAIN');
    }
    if (/^[\x00-\x7f]+$/.test(label)) {
      asciiLabels.push(label);
    } else {
      try {
        asciiLabels.push('xn--' + DomainNormalizer_punycodeEncode_(label));
      } catch (e) {
        throw new Error('INVALID_DOMAIN');
      }
    }
  }
  return asciiLabels.join('.');
}

/**
 * Punycode エンコード（RFC 3492）
 * 参考実装: https://datatracker.ietf.org/doc/html/rfc3492
 *
 * @param {string} input - Unicode 文字列（ラベル単位）
 * @returns {string} Punycode エンコード結果（xn-- は含まない）
 * @private
 */
function DomainNormalizer_punycodeEncode_(input) {
  var BASE = 36;
  var TMIN = 1;
  var TMAX = 26;
  var SKEW = 38;
  var DAMP = 700;
  var INITIAL_BIAS = 72;
  var INITIAL_N = 128;

  // input を Code Point 配列に変換（サロゲートペア対応）
  var codePoints = [];
  for (var i = 0; i < input.length; i++) {
    var cp = input.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < input.length) {
      var low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = ((cp - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        i++;
      }
    }
    codePoints.push(cp);
  }

  var output = [];
  // 基本コードポイント（ASCII）を最初に出力
  var basicCount = 0;
  for (var j = 0; j < codePoints.length; j++) {
    if (codePoints[j] < 0x80) {
      output.push(String.fromCharCode(codePoints[j]));
      basicCount++;
    }
  }
  if (basicCount > 0) {
    output.push('-');
  }

  var n = INITIAL_N;
  var delta = 0;
  var bias = INITIAL_BIAS;
  var h = basicCount;
  var b = basicCount;
  var totalLen = codePoints.length;

  while (h < totalLen) {
    // 次の最小コードポイントを探す
    var m = 0x7fffffff;
    for (var k = 0; k < totalLen; k++) {
      if (codePoints[k] >= n && codePoints[k] < m) {
        m = codePoints[k];
      }
    }
    if (m - n > Math.floor((0x7fffffff - delta) / (h + 1))) {
      throw new Error('PUNYCODE_OVERFLOW');
    }
    delta += (m - n) * (h + 1);
    n = m;

    for (var p = 0; p < totalLen; p++) {
      if (codePoints[p] < n) {
        delta++;
        if (delta > 0x7fffffff) {
          throw new Error('PUNYCODE_OVERFLOW');
        }
      } else if (codePoints[p] === n) {
        var q = delta;
        for (var kk = BASE; ; kk += BASE) {
          var t = (kk <= bias) ? TMIN : ((kk >= bias + TMAX) ? TMAX : (kk - bias));
          if (q < t) break;
          var digit = t + ((q - t) % (BASE - t));
          output.push(DomainNormalizer_punycodeDigitToBasic_(digit));
          q = Math.floor((q - t) / (BASE - t));
        }
        output.push(DomainNormalizer_punycodeDigitToBasic_(q));
        bias = DomainNormalizer_punycodeAdapt_(delta, h + 1, h === b);
        delta = 0;
        h++;
      }
    }
    delta++;
    n++;
  }

  return output.join('');
}

/** @private */
function DomainNormalizer_punycodeDigitToBasic_(digit) {
  // 0-25 → a-z, 26-35 → 0-9
  if (digit < 26) {
    return String.fromCharCode(digit + 97); // a
  }
  return String.fromCharCode(digit - 26 + 48); // 0
}

/** @private */
function DomainNormalizer_punycodeAdapt_(delta, numPoints, firstTime) {
  var BASE = 36;
  var TMIN = 1;
  var TMAX = 26;
  var SKEW = 38;
  var DAMP = 700;
  delta = firstTime ? Math.floor(delta / DAMP) : (delta >> 1);
  delta += Math.floor(delta / numPoints);
  var k = 0;
  while (delta > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}
