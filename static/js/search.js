/* ============================================================
   HVID — Search / Match Engine UI
   Cycling placeholder, input type detection, inline preview
   ============================================================ */

'use strict';

// ── Cycling placeholder strings (from spec) ─────────────────
const PLACEHOLDER_CYCLE = [
  'Enter a username or handle',
  'Enter a phone number',
  'Enter an email address',
  'Enter a website or link',
];

// CLEANUP M3: DEMO_IDENTITIES and matchIdentity() REMOVED.
// Previously: 3 hardcoded fake identities (alex.morgan, studio_kira, shopify.kira.co)
// with fabricated HVIDs, verification levels, linked asset counts, and member-since dates.
// matchIdentity() performed local string matching against these fake records.
// These would display as real search results to any user.
//
// const DEMO_IDENTITIES = [ ... ];  // removed
// function matchIdentity(query) { ... }  // removed

// ── Render result card ──────────────────────────────────────
function renderInlineResult(identity, showLink, query) {
  const panel = document.getElementById('search-result-panel');
  if (!panel) return;

  const statusClass = { verified: 'badge-verified', pending: 'badge-pending', unverified: 'badge-unverified' };
  const statusLabel = { verified: '✓ Verified', pending: '⏳ Pending', unverified: '✕ Unverified' };

  const linkAccountType = identity.accountType
    ? `&account_type=${encodeURIComponent(identity.accountType)}`
    : '';
  const linkHtml = showLink
    ? `<div style="padding:12px 0 0;text-align:right">
         <a href="/result?q=${encodeURIComponent(query || identity.handle)}${linkAccountType}"
            style="font-size:13px;color:var(--color-primary);font-weight:500">
           See full result →
         </a>
       </div>`
    : '';

  panel.innerHTML = `
    <div class="search-result-card">
      <div class="result-header">
        <div class="result-identity">
          <div class="result-avatar">${identity.initials}</div>
          <div>
            <div class="result-name">${escapeHtml(identity.handle)}</div>
            <div class="result-handle">${escapeHtml(identity.accountTypeLabel || '')} · ${escapeHtml(identity.hvid)}</div>
            ${identity.otherAccountTypes?.length
              ? `<div style="font-size:11px;color:var(--color-text-secondary);margin-top:3px">Also found: ${identity.otherAccountTypes.map(escapeHtml).join(' and ')} profile</div>`
              : ''}
          </div>
        </div>
        <span class="badge ${statusClass[identity.status] || 'badge-neutral'}">
          ${statusLabel[identity.status] || identity.level}
        </span>
      </div>
      <div class="result-body">
        <div class="result-stat">
          <div class="result-stat-label">Identity Level</div>
          <div class="result-stat-value">${identity.level}</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Linked Assets</div>
          <div class="result-stat-value">${identity.linked}</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Member Since</div>
          <div class="result-stat-value">${formatDate(identity.since)}</div>
        </div>
      </div>
      ${linkHtml}
    </div>
  `;
  panel.classList.add('active');
}

function renderEmpty(query) {
  const panel = document.getElementById('search-result-panel');
  if (!panel) return;
  const isPhone = detectInputType(query) === 'phone';
  const title = isPhone ? 'No account found for this number' : 'No identity found';
  const description = isPhone
    ? 'There is no Individual or Business HVID account for this phone number.'
    : `No verified identity is linked to ${escapeHtml(query)}.`;
  panel.innerHTML = `
    <div class="search-result-card">
      <div class="result-empty">
        <div style="font-size:26px;margin-bottom:10px;opacity:0.4">—</div>
        <div style="font-weight:600;color:var(--color-text-primary);margin-bottom:6px">${title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:14px">${description}</div>
        <a href="/auth/login" style="font-size:12px;font-weight:600;color:var(--color-primary);text-decoration:none;border:1px solid var(--color-border);padding:6px 14px;border-radius:7px;background:var(--color-surface)">
          Create an identity
        </a>
      </div>
    </div>
  `;
  panel.classList.add('active');
}

function renderSearchError(message, query) {
  const panel = document.getElementById('search-result-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="search-result-card">
      <div class="result-empty">
        <div style="font-size:26px;margin-bottom:10px;color:#fbbf24">!</div>
        <div style="font-weight:600;color:var(--color-text-primary);margin-bottom:6px">${escapeHtml(message)}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">Search: <strong>${escapeHtml(query)}</strong></div>
      </div>
    </div>
  `;
  panel.classList.add('active');
}

function renderSearching() {
  const panel = document.getElementById('search-result-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="search-result-card">
      <div class="result-searching">
        <div class="spinner"></div>
        Analyzing identity…
      </div>
    </div>
  `;
  panel.classList.add('active');
}

// ── Initialise search form ──────────────────────────────────
// NOTE: Submit navigation is handled by result.js (navigates to result.html?q=…)
// This IIFE only handles the debounced input preview panel for while-you-type feedback.
(function initSearch() {
  const input = document.getElementById('search-input');
  const panel = document.getElementById('search-result-panel');
  if (!input) return;

  let debounceTimer = null;
  let currentQuery  = '';
  let activeRequest = null;

  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    const query = this.value.trim();
    currentQuery = query;

    if (!query) {
      if (panel) panel.classList.remove('active');
      return;
    }
    if (query.length < 2) return;

    if (detectInputType(query) === 'phone') {
      const digitCount = query.replace(/\D/g, '').length;
      if (digitCount < 10) {
        if (digitCount >= 8) {
          renderSearchError('Enter all 10 digits to search this phone number.', query);
        } else if (panel) {
          panel.classList.remove('active');
        }
        return;
      }
      if (digitCount > 15) {
        renderSearchError('Phone numbers must contain no more than 15 digits.', query);
        return;
      }
    }

    debounceTimer = setTimeout(() => {
      if (query !== currentQuery) return;
      renderSearching();
      doInlinePreview(query);
    }, 300);
  });

  // ── Inline preview: calls real API, falls back to DEMO_IDENTITIES ──
  async function doInlinePreview(query) {
    if (!query || query !== currentQuery) return;

    if (activeRequest) activeRequest.abort();
    const controller = new AbortController();
    activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const r = await fetch('/api/match/check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          query,
        }),
        signal:  controller.signal,
      });

      // If query has changed while we were fetching, discard
      if (query !== currentQuery) return;

      if (r.status === 403) { renderEmpty(query); return; }
      if (!r.ok) {
        let error = 'Unable to check this identity.';
        try { error = (await r.json()).error || error; } catch (_) {}
        renderSearchError(error, query);
        return;
      }

      const data = await r.json();
      // data: { result_type, signal, verification_level }
      // result_type: 'MATCH_CONFIRMED' | 'PARTIAL_MATCH' | 'UNDER_REVIEW' | 'NO_MATCH'

      if (data.result_type === 'NO_MATCH') {
        renderEmpty(query);
        return;
      }

      // Map API result to preview card shape
      const accountType = data.account_type === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL';
      const accountTypeName = accountType === 'BUSINESS' ? 'Business' : 'Individual';
      const availableAccountTypes = Array.isArray(data.account_types) ? data.account_types : [accountType];
      const otherAccountTypes = availableAccountTypes
        .filter(type => type !== accountType)
        .map(type => type === 'BUSINESS' ? 'Business' : 'Individual');
      const verificationLevel = Number(data.verification_level) || 0;
      const displayName = data.username || `${accountTypeName} account`;
      const preview = {
        handle:   displayName,
        initials: data.username?.replace(/^@/, '').slice(0, 2).toUpperCase() || 'HV',
        hvid:     data.identity_id ? `HVID-${data.identity_id.slice(0, 8).toUpperCase()}` : '—',
        accountType,
        accountTypeLabel: accountTypeName,
        otherAccountTypes,
        level:    verificationLevel >= 3 ? 'High Trust' :
                  verificationLevel >= 2 ? 'Verified' :
                  verificationLevel >= 1 ? 'Basic' : 'Unverified',
        linked:   '—',
        since:    data.created_at || null,
        assets:   [],
        status:   verificationLevel >= 2 ? 'verified' :
                  data.result_type === 'UNDER_REVIEW' ? 'pending' : 'unverified',
      };
      renderInlineResult(preview, true, query);

    } catch (_) {
      // CLEANUP M3: Removed DEMO_IDENTITIES fallback on API failure.
      // Previously served fake results when backend was unreachable.
      // Now shows honest empty state instead.
      if (query !== currentQuery) return;
      renderSearchError(
        controller.signal.aborted
          ? 'Search took too long. Please try again.'
          : 'Could not reach the search service. Check your connection and try again.',
        query,
      );
    } finally {
      clearTimeout(timeout);
      if (activeRequest === controller) activeRequest = null;
    }
  }
})();

// ── Helpers ─────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Input type detection ─────────────────────────────────────
// Returns: 'instagram' | 'phone' | 'email' | 'website' | 'handle'
function detectInputType(raw) {
  if (!raw || raw.trim().length === 0) return null;
  const v = raw.trim();

  // Phone: starts with +, or is digits/spaces/dashes/parens, or partial like +91*****
  if (/^[+]/.test(v) || /^[\d\s\-().+*]+$/.test(v)) return 'phone';

  // Email: contains @ not at position 0, and has a dot after @
  if (/[^@]+@[^@]+\.[^@]+/.test(v)) return 'email';

  // Instagram: starts with @
  if (v.startsWith('@')) return 'instagram';

  // Website: looks like a URL (contains a dot, no spaces, no @)
  if (/^[^\s@]+\.[^\s@.]{2,}$/.test(v)) return 'website';

  // Default
  return 'handle';
}

const INPUT_TYPE_LABELS = {
  instagram: { icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>', label: 'Instagram',   cls: 'type-instagram' },
  phone:     { icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>', label: 'Phone',        cls: 'type-phone'     },
  email:     { icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',  label: 'Email',        cls: 'type-email'     },
  website:   { icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', label: 'Website',      cls: 'type-website'   },
  handle:    { icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>', label: 'Username',     cls: 'type-handle'    },
};

// ── Update input type badge ──────────────────────────────────
function updateInputTypeBadge(type, inputEl, badgeWrapEl, searchBoxEl) {
  // Clear all type classes from search box
  const allTypes = ['type-instagram','type-phone','type-email','type-website'];
  allTypes.forEach(c => searchBoxEl && searchBoxEl.classList.remove(c));

  if (!type || !badgeWrapEl) return;

  const cfg = INPUT_TYPE_LABELS[type];
  if (!cfg) { badgeWrapEl.innerHTML = ''; return; }

  badgeWrapEl.innerHTML = `
    <span class="input-type-badge ${cfg.cls}">
      ${cfg.icon} ${cfg.label}
    </span>
  `;

  if (searchBoxEl && type !== 'handle') {
    searchBoxEl.classList.add('type-' + type);
  }
}

// ── Cycling placeholder ──────────────────────────────────────
function initCyclingPlaceholder(inputEl) {
  if (!inputEl) return;
  if (!PLACEHOLDER_CYCLE || PLACEHOLDER_CYCLE.length === 0) return;

  let idx = 0;

  function setNext() {
    idx = (idx + 1) % PLACEHOLDER_CYCLE.length;
    // Remove + re-add class to retrigger animation
    inputEl.classList.remove('placeholder-cycling');
    void inputEl.offsetWidth; // reflow
    inputEl.placeholder = PLACEHOLDER_CYCLE[idx];
    inputEl.classList.add('placeholder-cycling');
  }

  // Set initial
  inputEl.placeholder = PLACEHOLDER_CYCLE[0];
  inputEl.classList.add('placeholder-cycling');

  // Only cycle when input is empty and not focused
  setInterval(() => {
    if (document.activeElement !== inputEl && !inputEl.value) {
      setNext();
    }
  }, 3500);
}

// ── Wire up input type detection to homepage search ──────────
(function initInputTypeDetection() {
  const inputEl     = document.getElementById('search-input');
  const searchBoxEl = document.getElementById('search-form');
  const badgeWrapEl = document.getElementById('input-type-badge-wrap');

  if (!inputEl) return;

  // Init cycling placeholder
  initCyclingPlaceholder(inputEl);

  // On input: detect type + update badge
  inputEl.addEventListener('input', function () {
    const type = detectInputType(this.value);
    updateInputTypeBadge(this.value.trim() ? type : null, inputEl, badgeWrapEl, searchBoxEl);
  });

  // On focus: stop showing cycling placeholder
  inputEl.addEventListener('focus', function () {
    inputEl.classList.remove('placeholder-cycling');
  });

  // On blur + empty: resume cycling
  inputEl.addEventListener('blur', function () {
    if (!this.value) {
      initCyclingPlaceholder(inputEl);
    }
  });
})();

