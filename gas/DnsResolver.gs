/**
 * DnsResolver.gs
 *
 * Google Public DNS API (https://dns.google/resolve) を UrlFetchApp.fetchAll で並列クエリ。
 *
 * - チャンクサイズ上限 100（NG 基準準拠）
 * - 429 検出時は Retry-After 尊重で指数バックオフ
 * - muteHttpExceptions: true でステータスコードをハンドリング
 *
 * すべて純関数として実装し、入力に対し決定的なレスポンスを返す。
 * （シート I/O や進捗表示は呼び出し元で行う）
 */

/**
 * DNS クエリリクエストを表現する内部型
 * @typedef {Object} DnsRequest
 * @property {string} name   - クエリ対象の FQDN（例: _dmarc.example.com）
 * @property {string} type   - レコードタイプ（'TXT' / 'A' 等）
 * @property {string} tag    - 呼び出し元が結果を識別するためのタグ
 */

/**
 * DNS クエリレスポンスを表現する内部型
 * @typedef {Object} DnsResponse
 * @property {string} tag        - リクエスト時に渡したタグ
 * @property {string|null} error - エラー種別（'NXDOMAIN' / 'TIMEOUT' / 'RATE_LIMIT' / 'NETWORK_ERROR' / null）
 * @property {Array<string>} records - TXT レコード文字列の配列
 */

/**
 * DnsRequest 配列を受け取り、UrlFetchApp.fetchAll で並列クエリして DnsResponse 配列を返す。
 * 内部で 100 件単位にチャンク分割する。
 * 429 はチャンク単位で検出し、Retry-After を尊重して指数バックオフでリトライする。
 *
 * @param {Array<DnsRequest>} requests
 * @returns {Array<DnsResponse>} requests と同じ長さ・順序
 */
function DnsResolver_resolveBatch(requests) {
  if (!requests || requests.length === 0) {
    return [];
  }

  var allResponses = new Array(requests.length);
  var chunkSize = CONFIG_FETCH_CHUNK_SIZE;

  for (var start = 0; start < requests.length; start += chunkSize) {
    var end = Math.min(start + chunkSize, requests.length);
    var chunk = requests.slice(start, end);
    var chunkResults = DnsResolver_fetchChunkWithRetry_(chunk);
    for (var i = 0; i < chunkResults.length; i++) {
      allResponses[start + i] = chunkResults[i];
    }
    if (end < requests.length) {
      Utilities.sleep(CONFIG_CHUNK_SLEEP_MS);
    }
  }

  return allResponses;
}

/**
 * 1 チャンク（最大 100 件）を fetchAll で実行し、429 等の一時的失敗をリトライ。
 * @private
 */
function DnsResolver_fetchChunkWithRetry_(chunk) {
  var attempt = 0;
  var pendingIndexes = [];
  for (var i = 0; i < chunk.length; i++) pendingIndexes.push(i);
  var results = new Array(chunk.length);
  var retryWaitMs = CONFIG_BACKOFF_INITIAL_MS;

  while (pendingIndexes.length > 0 && attempt < CONFIG_MAX_RETRIES) {
    var pendingChunk = [];
    for (var p = 0; p < pendingIndexes.length; p++) {
      pendingChunk.push(chunk[pendingIndexes[p]]);
    }

    var requestsParam = DnsResolver_buildFetchAllRequests_(pendingChunk);

    var responses;
    try {
      responses = UrlFetchApp.fetchAll(requestsParam);
    } catch (e) {
      // fetchAll 全体例外時はチャンク全体を NETWORK_ERROR で返す（リトライしない）
      Logger.log('UrlFetchApp.fetchAll exception: ' + e.message);
      for (var k = 0; k < pendingIndexes.length; k++) {
        results[pendingIndexes[k]] = {
          tag: chunk[pendingIndexes[k]].tag,
          error: 'NETWORK_ERROR',
          records: [],
          message: e.message
        };
      }
      return results;
    }

    var nextPending = [];
    var anyRateLimited = false;
    var maxRetryAfterSec = 0;

    for (var idx = 0; idx < responses.length; idx++) {
      var realIdx = pendingIndexes[idx];
      var req = chunk[realIdx];
      var resp = responses[idx];
      var status = resp.getResponseCode();

      if (status === 429) {
        anyRateLimited = true;
        // Retry-After ヘッダを尊重
        var headers = resp.getAllHeaders();
        var ra = headers['Retry-After'] || headers['retry-after'];
        if (ra) {
          var raSec = parseInt(ra, 10);
          if (!isNaN(raSec) && raSec > maxRetryAfterSec) {
            maxRetryAfterSec = raSec;
          }
        }
        nextPending.push(realIdx);
        continue;
      }

      if (status >= 500) {
        // サーバエラーはリトライ対象
        nextPending.push(realIdx);
        continue;
      }

      if (status !== 200) {
        results[realIdx] = {
          tag: req.tag,
          error: 'NETWORK_ERROR',
          records: [],
          message: 'HTTP ' + status
        };
        continue;
      }

      var body = resp.getContentText();
      var parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e2) {
        results[realIdx] = {
          tag: req.tag,
          error: 'NETWORK_ERROR',
          records: [],
          message: 'JSON parse error'
        };
        continue;
      }

      // NXDOMAIN
      if (parsed.Status === 3) {
        results[realIdx] = {
          tag: req.tag,
          error: 'NXDOMAIN',
          records: []
        };
        continue;
      }

      // その他の DNS エラー (Status 2 = SERVFAIL など) も「応答なし」として正常終了させる
      // → DKIM のように全滅でも成立するケースがあるため、ここでは records=[] で返す
      if (!parsed.Answer || parsed.Answer.length === 0) {
        results[realIdx] = {
          tag: req.tag,
          error: null,
          records: []
        };
        continue;
      }

      var typeNum = (req.type === 'TXT') ? 16 : null;
      var records = [];
      for (var a = 0; a < parsed.Answer.length; a++) {
        var ans = parsed.Answer[a];
        if (typeNum !== null && ans.type !== typeNum) {
          continue;
        }
        var val = ans.data;
        if (req.type === 'TXT' && val) {
          // Google Public DNS は引用符付き ("...")、複数文字列の場合 "a" "b" の形式も
          // 引用符を統合して 1 つの文字列にする
          val = DnsResolver_unquoteTxt_(val);
        }
        records.push(val);
      }

      results[realIdx] = {
        tag: req.tag,
        error: null,
        records: records
      };
    }

    if (nextPending.length === 0) {
      // すべて完了
      break;
    }

    // バックオフ待機
    var waitMs;
    if (anyRateLimited && maxRetryAfterSec > 0) {
      waitMs = Math.min(maxRetryAfterSec * 1000, 30000); // 最大 30 秒
    } else {
      waitMs = retryWaitMs;
      retryWaitMs *= 2;
    }
    Logger.log('DNS retry attempt=' + (attempt + 1) + ' pending=' + nextPending.length + ' wait=' + waitMs + 'ms');
    Utilities.sleep(waitMs);
    pendingIndexes = nextPending;
    attempt++;
  }

  // 最終的にリトライ枯渇した分は RATE_LIMIT / NETWORK_ERROR で確定
  for (var f = 0; f < pendingIndexes.length; f++) {
    var fi = pendingIndexes[f];
    if (!results[fi]) {
      results[fi] = {
        tag: chunk[fi].tag,
        error: 'RATE_LIMIT',
        records: []
      };
    }
  }

  return results;
}

/**
 * fetchAll に渡す requests 配列を組み立てる
 * @private
 */
function DnsResolver_buildFetchAllRequests_(chunk) {
  var arr = [];
  for (var i = 0; i < chunk.length; i++) {
    var c = chunk[i];
    var url = CONFIG_DNS_API_BASE
      + '?name=' + encodeURIComponent(c.name)
      + '&type=' + encodeURIComponent(c.type);
    arr.push({
      url: url,
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'Accept': 'application/dns-json'
      }
    });
  }
  return arr;
}

/**
 * Google Public DNS の TXT レコード文字列を整形する。
 *   '"v=spf1 include:_spf.google.com ~all"' → 'v=spf1 include:_spf.google.com ~all'
 *   '"part1" "part2"' → 'part1part2'（RFC 6376/7208 準拠の連結）
 * @private
 */
function DnsResolver_unquoteTxt_(raw) {
  if (!raw) return raw;
  // 連続した引用符の組を全て抽出し連結
  var parts = [];
  var re = /"((?:[^"\\]|\\.)*)"/g;
  var match;
  var hadQuoted = false;
  while ((match = re.exec(raw)) !== null) {
    hadQuoted = true;
    parts.push(match[1].replace(/\\"/g, '"'));
  }
  if (hadQuoted) {
    return parts.join('');
  }
  // 引用符が無い場合はそのまま返す
  return raw;
}

/**
 * 単一ドメインに対する SPF レコード取得
 * 直接ドメイン → 未検出時は _spf.domain も確認（既存ロジック踏襲）
 *
 * @param {string} domain
 * @returns {{spf: string|null, error: string|null}}
 */
function DnsResolver_getSPFRecord(domain) {
  var reqs = [
    { name: domain, type: 'TXT', tag: 'spf-main' },
    { name: '_spf.' + domain, type: 'TXT', tag: 'spf-sub' }
  ];
  var responses = DnsResolver_resolveBatch(reqs);

  // メインドメインが NXDOMAIN ならドメイン未登録（エラー伝播）
  if (responses[0].error === 'NXDOMAIN') {
    return { spf: null, error: 'NXDOMAIN' };
  }

  // メインの TXT を確認
  if (responses[0].records) {
    for (var i = 0; i < responses[0].records.length; i++) {
      if (responses[0].records[i].indexOf('v=spf1') === 0) {
        return { spf: responses[0].records[i], error: null };
      }
    }
  }

  // _spf サブドメインを確認
  if (responses[1].error === null && responses[1].records) {
    for (var j = 0; j < responses[1].records.length; j++) {
      if (responses[1].records[j].indexOf('v=spf1') === 0) {
        return { spf: responses[1].records[j], error: null };
      }
    }
  }

  // 一時エラー
  if (responses[0].error === 'RATE_LIMIT' || responses[0].error === 'NETWORK_ERROR' || responses[0].error === 'TIMEOUT') {
    return { spf: null, error: responses[0].error };
  }

  return { spf: null, error: null };
}

/**
 * 単一ドメインに対する DMARC レコード取得
 * @param {string} domain
 * @returns {{dmarc: string|null, error: string|null}}
 */
function DnsResolver_getDMARCRecord(domain) {
  var reqs = [
    { name: '_dmarc.' + domain, type: 'TXT', tag: 'dmarc' }
  ];
  var responses = DnsResolver_resolveBatch(reqs);
  var r = responses[0];

  if (r.error === 'NXDOMAIN') {
    // DMARC レコードが存在しないだけのケースとして扱う（既存ロジック踏襲）
    return { dmarc: null, error: null };
  }

  if (r.error) {
    return { dmarc: null, error: r.error };
  }

  if (r.records) {
    for (var i = 0; i < r.records.length; i++) {
      if (r.records[i].indexOf('v=DMARC1') === 0) {
        return { dmarc: r.records[i], error: null };
      }
    }
  }

  return { dmarc: null, error: null };
}

/**
 * 単一ドメインに対する SPF + DMARC をまとめて並列取得（fetchAll で並列）
 * （DKIM はセレクター数が多いため別関数）
 *
 * @param {string} domain
 * @returns {{
 *   spf: string|null, spfError: string|null,
 *   dmarc: string|null, dmarcError: string|null,
 *   mainExists: boolean
 * }}
 */
function DnsResolver_getSPFAndDMARC(domain) {
  var reqs = [
    { name: domain, type: 'TXT', tag: 'spf-main' },
    { name: '_spf.' + domain, type: 'TXT', tag: 'spf-sub' },
    { name: '_dmarc.' + domain, type: 'TXT', tag: 'dmarc' }
  ];
  var resp = DnsResolver_resolveBatch(reqs);

  var spfMain = resp[0];
  var spfSub = resp[1];
  var dmarc = resp[2];

  var out = {
    spf: null,
    spfError: null,
    dmarc: null,
    dmarcError: null,
    mainExists: true
  };

  if (spfMain.error === 'NXDOMAIN') {
    out.mainExists = false;
    out.spfError = 'NXDOMAIN';
    out.dmarcError = 'NXDOMAIN';
    return out;
  }

  if (spfMain.error === 'RATE_LIMIT' || spfMain.error === 'NETWORK_ERROR' || spfMain.error === 'TIMEOUT') {
    out.spfError = spfMain.error;
  }

  // SPF 検出
  if (spfMain.records) {
    for (var i = 0; i < spfMain.records.length; i++) {
      if (spfMain.records[i].indexOf('v=spf1') === 0) {
        out.spf = spfMain.records[i];
        break;
      }
    }
  }
  if (!out.spf && spfSub.records) {
    for (var j = 0; j < spfSub.records.length; j++) {
      if (spfSub.records[j].indexOf('v=spf1') === 0) {
        out.spf = spfSub.records[j];
        break;
      }
    }
  }

  // DMARC 検出
  if (dmarc.error && dmarc.error !== 'NXDOMAIN') {
    out.dmarcError = dmarc.error;
  } else if (dmarc.records) {
    for (var k = 0; k < dmarc.records.length; k++) {
      if (dmarc.records[k].indexOf('v=DMARC1') === 0) {
        out.dmarc = dmarc.records[k];
        break;
      }
    }
  }

  return out;
}

/**
 * 指定セレクター群を 1 ドメインに対して並列クエリし、検出された DKIM レコードを返す。
 * v=DKIM1 を含むレコードのみ採用（RFC 6376）。
 *
 * @param {string} domain
 * @param {Array<string>} selectors
 * @returns {{found: Array<{selector:string, record:string}>, error: string|null}}
 */
function DnsResolver_getDKIMForSelectors(domain, selectors) {
  if (!selectors || selectors.length === 0) {
    return { found: [], error: null };
  }

  var reqs = [];
  for (var i = 0; i < selectors.length; i++) {
    reqs.push({
      name: selectors[i] + '._domainkey.' + domain,
      type: 'TXT',
      tag: 'dkim-' + selectors[i]
    });
  }

  var responses = DnsResolver_resolveBatch(reqs);

  var found = [];
  var firstError = null;

  for (var j = 0; j < responses.length; j++) {
    var r = responses[j];
    var selector = selectors[j];

    if (r.error === 'NXDOMAIN') {
      // セレクター単位の NXDOMAIN は単に「そのセレクターに鍵が無い」なのでスキップ
      continue;
    }
    if (r.error) {
      // 一時エラーは記録（最初の 1 件のみ）
      if (!firstError) firstError = r.error;
      continue;
    }
    if (r.records) {
      for (var k = 0; k < r.records.length; k++) {
        var rec = r.records[k];
        // v=DKIM1 を含むレコードのみ採用
        if (/v\s*=\s*DKIM1/i.test(rec)) {
          found.push({ selector: selector, record: rec });
          break;
        }
      }
    }
  }

  return { found: found, error: firstError };
}

/**
 * DKIM 2 段階クエリ（プリスキャン 7 → フォールバック 21）
 * プリスキャンで 1 件以上検出された場合、フォールバックはスキップ。
 *
 * @param {string} domain
 * @returns {{found: Array<{selector:string, record:string}>, error: string|null, prescanHit: boolean}}
 */
function DnsResolver_getDKIM2Stage(domain) {
  // プリスキャン
  var pre = DnsResolver_getDKIMForSelectors(domain, CONFIG_DKIM_SELECTORS_PRESCAN);
  if (pre.found.length > 0) {
    Logger.log('[DKIM] プリスキャンで検出: ' + pre.found.map(function (f) { return f.selector; }).join(', ') + ' / domain=' + domain);
    return { found: pre.found, error: pre.error, prescanHit: true };
  }

  // フォールバック
  var fb = DnsResolver_getDKIMForSelectors(domain, CONFIG_DKIM_SELECTORS_FALLBACK);
  return {
    found: fb.found,
    error: pre.error || fb.error,
    prescanHit: false
  };
}
