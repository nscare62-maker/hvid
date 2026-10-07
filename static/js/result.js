/* ============================================================
   HVID — Result Page JS
   result.html — reads URL ?q= param, runs match, renders state
   ============================================================ */

'use strict';

// CLEANUP M3: IDENTITY_RECORDS and matchRecord() REMOVED.
// Previously: 5 hardcoded fake identity records (alex.morgan, studio_kira, j.reeves,
// kirastudio, nova.brands) with fabricated HVIDs, verification levels, linked asset
// counts, identity ages, and enforcement levels. matchRecord() searched these locally.
// Any search query touching these keys would return fake "Verified" results.
//
// const IDENTITY_RECORDS = [ ... ];  // removed
// function matchRecord(raw) { ... }  // removed

// ── Result state configs — exact strings from spec ──────────
const STATE_CONFIG = {
  'confirmed': {
    icon:        '✓',
    label:       'Match Confirmed',
    desc:        'This account is linked to a verified identity. Signals are based on available data and may change over time.',
    cardClass:   'confirmed',
    badgeClass:  'badge-verified',
    badgeText:   '✓ Verified',
  },
  'partial': {
    icon:        '~',
    label:       'Partial Match',
    desc:        'Some signals match. Verification is not yet complete. Signals are based on available data and may change over time.',
    cardClass:   'partial',
    badgeClass:  'badge-pending',
    badgeText:   '⏳ Pending',
  },
  'under-review': {
    icon:        '⟳',
    label:       'Under Review',
    desc:        'Some activity requires attention. This does not indicate wrongdoing.',
    cardClass:   'under-review',
    badgeClass:  'badge-neutral',
    badgeText:   '⟳ Under Review',
  },
  'no-match': {
    icon:        '—',
    label:       'No Match Found',
    desc:        'No verified identity found for the provided information.',
    cardClass:   'no-match',
    badgeClass:  'badge-unverified',
    badgeText:   '✕ No Record',
  },
  // Enforcement override state — shown instead of confirmed/partial when enforcementLevel >= 3
  'enforcement-limited': {
    icon:        '○',
    label:       'Verification Temporarily Limited',
    desc:        'Access restricted. This is an advisory signal, not a verdict.',
    cardClass:   'under-review',
    badgeClass:  'badge-neutral',
    badgeText:   '○ Limited',
  },
};

// ── Signal explanation map (shown beneath trust card) ─────────
// Maps backend trust_signal → plain-language explanation shown to the searcher.
// SAFETY: neutral, non-accusatory, non-deterministic language only.
const SIGNAL_EXPLANATION = {
  STABLE:                'No risk signals observed.',
  UNDER_REVIEW:          'Some activity requires attention.',
  REQUIRES_REVALIDATION: 'Verification recommended.',
  LIMITED:               'Restricted due to risk signals.',
  SUSPENDED:             'Access restricted.',
};

// Context line appended beneath every signal explanation
const SIGNAL_CONTEXT = 'Signals are based on available data and may change over time.';

// ── Render functions ─────────────────────────────────────────

function renderConfirmedOrPartial(rec, cfg, query) {
  const assetsHtml = rec.assets
    .map(a => `<div class="asset-chip"><span class="chip-dot"></span>${escHtml(a)}</div>`)
    .join('');

  return `
    <div class="result-card ${cfg.cardClass}">
      <div class="result-status-band">
        <div class="result-status-icon">${cfg.icon}</div>
        <div style="flex:1">
          <div class="result-status-label">${cfg.label}</div>
          <div class="result-status-desc">${cfg.desc}</div>
        </div>
        <span class="badge ${cfg.badgeClass}" style="flex-shrink:0">${cfg.badgeText}</span>
      </div>

      <div class="result-signals">
        <div class="result-signal-item">
          <div class="result-signal-label">HVID Identifier</div>
          <div class="result-signal-value" style="font-family:monospace;font-size:13px">${escHtml(rec.hvid)}</div>
        </div>
        <div class="result-signal-item">
          <div class="result-signal-label">Verification Level</div>
          <div class="result-signal-value">${escHtml(rec.level)}</div>
        </div>
        <div class="result-signal-item">
          <div class="result-signal-label">Identity Age</div>
          <div class="result-signal-value">${escHtml(rec.age)}</div>
        </div>
      </div>

      <div class="result-assets">
        <span class="result-assets-label">Linked assets (${rec.linked}):</span>
        ${assetsHtml}
      </div>

      <div style="padding:12px 20px 16px;border-top:1px solid rgba(255,255,255,.05);display:flex;justify-content:flex-end">
        <a href="p.html?id=${encodeURIComponent(rec.hvid)}"
           style="font-size:12px;font-weight:600;color:var(--color-primary);text-decoration:none;opacity:.8"
           title="View shareable identity profile">
          View identity profile →
        </a>
      </div>
    </div>
  `;
}

function renderUnderReview(rec, cfg, query) {
  return `
    <div class="result-card ${cfg.cardClass}">
      <div class="result-status-band">
        <div class="result-status-icon">${cfg.icon}</div>
        <div style="flex:1">
          <div class="result-status-label">${cfg.label}</div>
          <div class="result-status-desc">${cfg.desc}</div>
        </div>
        <span class="badge ${cfg.badgeClass}" style="flex-shrink:0">${cfg.badgeText}</span>
      </div>
      <div class="result-signals">
        <div class="result-signal-item">
          <div class="result-signal-label">HVID Identifier</div>
          <div class="result-signal-value" style="font-family:monospace;font-size:13px">${escHtml(rec.hvid)}</div>
        </div>
        <div class="result-signal-item">
          <div class="result-signal-label">Verification Level</div>
          <div class="result-signal-value class="muted"">${escHtml(rec.level)}</div>
        </div>
        <div class="result-signal-item">
          <div class="result-signal-label">Claims Status</div>
          <div class="result-signal-value" style="color:var(--color-secondary)">Under Review</div>
        </div>
      </div>
    </div>
  `;
}

function renderNoMatch(query) {
  return `
    <div class="result-card no-match">
      <div class="result-no-match-body">
        <div class="result-no-match-icon">—</div>
        <div class="result-no-match-title">No HVID record found</div>
        <div class="result-no-match-desc">
          No verified identity is linked to
          <strong style="color:var(--color-text-primary)">${escHtml(query)}</strong>.<br/>
          This account has not been registered or verified on HVID.
        </div>
        <div class="flex justify-center gap-4">
          <a href="/auth/signup" class="btn btn-primary btn-sm" id="no-match-signup-btn">Verify Your Identity</a>
          <a href="/" class="btn btn-ghost btn-sm" id="no-match-search-btn">Search Again</a>
        </div>
      </div>
    </div>
  `;
}

// ── Main render ─────────────────────────────────────────────
function renderResult(query) {
  const container   = document.getElementById('result-container');
  const queryLabel  = document.getElementById('query-value-label');
  if (!container) return;

  // TASK 3: match-ui.js is the PRIMARY renderer for result.html.
  // If #match-output-container already has content (match-ui.js rendered),
  // result.js yields completely — no duplicate render, no conflicting state.
  const muiContainer = document.getElementById('match-output-container');
  if (muiContainer && muiContainer.innerHTML.trim().length > 0) {
    // match-ui.js has already rendered — hide our container and exit.
    container.style.display = 'none';
    return;
  }

  if (queryLabel) queryLabel.textContent = query || '—';

  if (!query) {
    container.innerHTML = renderNoMatch('(empty query)');
    return;
  }

  // Show loading while match-ui.js processes the query
  container.innerHTML = `
    <div class="result-card no-match">
      <div class="result-loading">
        <div class="spinner"></div>
        <div class="result-loading-text">Searching identity records…</div>
      </div>
    </div>
  `;

  // ── Defer to match-ui.js — it is the SOLE API caller ──────────────────
  // match-ui.js calls POST /api/match/check on DOMContentLoaded and renders
  // into #match-output-container. result.js no longer makes its own API call
  // to prevent duplicate backend load, history entries, and graph edges.
  //
  // Poll until match-ui.js renders, then hide this container.
  // If match-ui.js fails to render within 6s, show a clean error state.
  (function waitForMatchUI() {
    let checks = 0;
    const MAX_CHECKS = 24;       // 24 × 250ms = 6 seconds
    const INTERVAL_MS = 250;

    const timer = setInterval(function () {
      checks++;

      const muiEl = document.getElementById('match-output-container');
      if (muiEl && muiEl.innerHTML.trim().length > 0) {
        // match-ui.js has rendered — yield completely
        clearInterval(timer);
        container.style.display = 'none';
        return;
      }

      if (checks >= MAX_CHECKS) {
        // match-ui.js did not render in time — show error
        clearInterval(timer);
        container.innerHTML = `
          <div class="result-card no-match">
            <div class="result-no-match-body">
              <div class="result-no-match-icon" style="opacity:.3">⚠</div>
              <div class="result-no-match-title">Unable to reach server</div>
              <div class="result-no-match-desc">Check your connection and try again.</div>
              <a href="javascript:location.reload()" class="btn btn-ghost btn-sm">Try again</a>
            </div>
          </div>`;
      }
    }, INTERVAL_MS);
  })();
}

// ── Init on page load ────────────────────────────────────────
(function initResultPage() {
  // Only run on result.html
  if (!document.getElementById('result-container')) return;

  // Read query param
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q') || '';
  const accountType = params.get('account_type') === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL';
  window.HVID_SEARCH_ACCOUNT_TYPE = accountType;

  // Pre-fill search bar
  const searchInput = document.getElementById('result-search-input');
  if (searchInput && query) searchInput.value = query;

  // Render
  renderResult(query);

  // Re-search on form submit
  const form = document.getElementById('result-search-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const newQuery = searchInput ? searchInput.value.trim() : '';
      if (!newQuery) return;
      const url = new URL(window.location.href);
      url.searchParams.set('q', newQuery);
      url.searchParams.set('account_type', window.HVID_SEARCH_ACCOUNT_TYPE || 'INDIVIDUAL');
      window.history.pushState({}, '', url);
      renderResult(newQuery);
    });
  }

  document.querySelectorAll('[data-account-type]').forEach(button => {
    const selected = button.dataset.accountType === accountType;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', () => {
      window.HVID_SEARCH_ACCOUNT_TYPE = button.dataset.accountType;
      document.querySelectorAll('[data-account-type]').forEach(other => {
        const isSelected = other.dataset.accountType === window.HVID_SEARCH_ACCOUNT_TYPE;
        other.classList.toggle('active', isSelected);
        other.setAttribute('aria-pressed', String(isSelected));
      });

      if (form && searchInput?.value.trim()) {
        const url = new URL(window.location.href);
        url.searchParams.set('q', searchInput.value.trim());
        url.searchParams.set('account_type', window.HVID_SEARCH_ACCOUNT_TYPE);
        window.location.href = url.toString();
      } else {
        const homeInput = document.getElementById('search-input');
        if (homeInput?.value.trim()) {
          homeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });
  });
})();

// ── Homepage: navigate to result page on submit ──────────────
(function initHomepageSubmit() {
  const form = document.getElementById('search-form');
  if (!form) return;

  // Override submit to navigate to /result
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const input = document.getElementById('search-input');
    const query = input ? input.value.trim() : '';
    if (!query) return;
    window.location.href = '/result?q=' + encodeURIComponent(query);
  });
})();

// ── Utility ──────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
