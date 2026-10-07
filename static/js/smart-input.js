/**
 * HVID — Smart Input UX Layer
 * ─────────────────────────────────────────────────────────────
 * Enhances the existing #search-input with:
 *   • Live input type detection + dynamic hints
 *   • Partial input messaging
 *   • Loading / analyzing state
 *   • Result confidence display integration
 *
 * DOES NOT modify search.js or any backend call.
 * Attaches to the same #search-input element as a zero-conflict
 * enhancement layer (reads events, injects a hint element only).
 *
 * SAFETY: Never reveals interpretation details to the user.
 *         Shows only neutral UX guidance text.
 */
'use strict';

(function SmartInput() {

  // ── Client-side input type detection (mirrors backend rules) ─
  // Used ONLY for UX hints — never sent to backend directly.
  function detectType(v) {
    if (!v) return null;
    const n = v.trim().toLowerCase().replace(/[\s\-().]/g, '');
    if (n.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n)) return 'EMAIL';
    if (/\*{2,}/.test(n) && n.includes('@')) return 'EMAIL';
    if (/^\+?\d{7,15}$/.test(n.replace(/\D/g,''))) return 'PHONE';
    if (/^[\w.]{2,30}$/.test(v.trim())) return 'USERNAME';
    return 'UNKNOWN';
  }

  function isPartial(v, type) {
    const clean = v.trim().replace(/[\s\-().+]/g, '');
    if (type === 'PHONE')    return clean.replace(/\D/g,'').length < 8;
    if (type === 'EMAIL')    return /\*{2,}/.test(v.split('@')[0]);
    if (type === 'USERNAME') return clean.length < 4;
    return false;
  }

  function isValid(v, type) {
    if (!v || !type || type === 'UNKNOWN') return v.trim().length >= 2;
    return true;
  }

  // ── Hint text config ──────────────────────────────────────────
  const HINTS = {
    PHONE: {
      full:    '📱 Checking phone number…',
      partial: '📱 Partial phone — results may vary',
    },
    EMAIL: {
      full:    '✉️ Checking email…',
      partial: '✉️ Masked email — searching by domain',
    },
    USERNAME: {
      full:    '🔍 Checking username…',
      partial: '🔍 Short fragment — results may vary',
    },
    UNKNOWN: {
      full:    null,     // no hint for unknown full input
      partial: null,
    },
  };

  // ── CSS ───────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hvid-smart-input-css')) return;
    const s = document.createElement('style');
    s.id = 'hvid-smart-input-css';
    s.textContent = `
      .si-hint-wrap {
        height: 22px; overflow: hidden;
        margin-top: 6px;
        transition: opacity .2s;
      }
      .si-hint {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11px; font-weight: 600; letter-spacing: .02em;
        padding: 3px 9px; border-radius: 99px; border: 1px solid;
        transition: all .2s; white-space: nowrap;
        animation: siHintIn .2s ease;
      }
      @keyframes siHintIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
      .si-hint-info    { color: rgba(255,255,255,.55); background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.08); }
      .si-hint-partial { color: #fbbf24;               background: rgba(251,191,36,.07);  border-color: rgba(251,191,36,.2);  }
      .si-hint-loading { color: #818cf8;               background: rgba(129,140,248,.07); border-color: rgba(129,140,248,.18); }
      .si-hint-error   { color: #f87171;               background: rgba(248,113,113,.06); border-color: rgba(248,113,113,.18); }
      .si-hint-partial { color: #fbbf24;               background: rgba(251,191,36,.07);  border-color: rgba(251,191,36,.2);  }
      .si-hint-confidence {
        display: inline-block; margin-top: 6px;
        font-size: 11px; color: rgba(255,255,255,.4);
        padding: 2px 0;
      }

      /* Subtle input border tinting while type is detected */
      #search-input.si-phone    { border-color: rgba(129,140,248,.35) !important; }
      #search-input.si-email    { border-color: rgba(52,211,153,.3)   !important; }
      #search-input.si-username { border-color: rgba(251,191,36,.3)   !important; }
      #search-input.si-error    { border-color: rgba(248,113,113,.35) !important; }
      #search-input.si-loading  { border-color: rgba(129,140,248,.4)  !important; }

      /* Spinner purely CSS — no extra DOM */
      .si-spinner {
        display: inline-block; width: 8px; height: 8px;
        border: 1.5px solid rgba(129,140,248,.25);
        border-top-color: #818cf8; border-radius: 50%;
        animation: siSpin .6s linear infinite; flex-shrink: 0;
      }
      @keyframes siSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  // ── Mount ─────────────────────────────────────────────────────
  function mount() {
    const input = document.getElementById('search-input');
    if (!input) return;

    injectStyles();

    // Inject hint container just after the input (or its parent form)
    const hintWrap = document.createElement('div');
    hintWrap.className = 'si-hint-wrap';
    hintWrap.id = 'si-hint-wrap';
    hintWrap.setAttribute('aria-live', 'polite');
    hintWrap.setAttribute('aria-atomic', 'true');

    const parent = input.closest('form') || input.parentElement;
    parent.insertAdjacentElement('afterend', hintWrap);

    // ── State ──────────────────────────────────────────────────
    let lastType    = null;
    let loadingTimer = null;

    // ── Helpers ────────────────────────────────────────────────
    function showHint(text, cls) {
      hintWrap.innerHTML = text
        ? `<span class="si-hint ${cls}">${text}</span>`
        : '';
    }

    function clearHint() { hintWrap.innerHTML = ''; }

    function setInputState(cls) {
      ['si-phone','si-email','si-username','si-error','si-loading'].forEach(c => input.classList.remove(c));
      if (cls) input.classList.add(cls);
    }

    // ── Input event ────────────────────────────────────────────
    input.addEventListener('input', function () {
      clearTimeout(loadingTimer);
      const raw  = this.value;
      const v    = raw.trim();

      if (!v) {
        clearHint();
        setInputState(null);
        lastType = null;
        return;
      }

      // Minimum length before showing hints
      if (v.length < 2) {
        clearHint();
        setInputState(null);
        return;
      }

      const type    = detectType(v);
      const partial = isPartial(v, type);
      const valid   = isValid(v, type);
      lastType      = type;

      // Immediately validate — show error if clearly invalid
      if (!valid) {
        showHint('Enter a valid identifier', 'si-hint-error');
        setInputState('si-error');
        return;
      }

      // Show partial warning immediately (before debounce triggers)
      if (partial) {
        const msg = (HINTS[type] || HINTS.UNKNOWN).partial || 'Partial input — results may vary';
        showHint(msg, 'si-hint-partial');
        setInputState(type === 'PHONE' ? 'si-phone' : type === 'EMAIL' ? 'si-email' : 'si-username');
        return;
      }

      // Full valid input — show type hint immediately
      const typeHint = (HINTS[type] || HINTS.UNKNOWN).full;
      if (typeHint) {
        showHint(typeHint, 'si-hint-info');
      } else {
        clearHint();
      }

      // Input border tint
      setInputState(type === 'PHONE' ? 'si-phone' : type === 'EMAIL' ? 'si-email' : type === 'USERNAME' ? 'si-username' : null);

      // Loading indicator: show after 400ms if still typing
      // (search.js fires its own API call after 600ms debounce)
      loadingTimer = setTimeout(() => {
        if (input.value.trim() === v) {
          showHint('<span class="si-spinner"></span> Analyzing input…', 'si-hint-loading');
          setInputState('si-loading');
        }
      }, 400);
    });

    // ── Blur ───────────────────────────────────────────────────
    input.addEventListener('blur', () => {
      clearTimeout(loadingTimer);
      const v = input.value.trim();
      if (!v) { clearHint(); setInputState(null); return; }
      const type = detectType(v);
      if (!isValid(v, type)) {
        showHint('Enter a valid identifier', 'si-hint-error');
        setInputState('si-error');
      } else {
        clearHint();
        setInputState(null);
      }
    });

    // ── Clear on focus (reset loading state) ───────────────────
    input.addEventListener('focus', () => {
      clearTimeout(loadingTimer);
      setInputState(null);
      const v = input.value.trim();
      if (!v) clearHint();
    });

    // ── Intercept search result panel mutations ────────────────
    // Watch for result panel updates from search.js and inject
    // confidence label when result is a PARTIAL_MATCH.
    const panel = document.getElementById('search-result-panel');
    if (panel && typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => {
        clearTimeout(loadingTimer);
        setInputState(null);

        // Detect if panel shows a partial match result
        const isPartialResult = panel.querySelector('.result-stat-value')
          ?.textContent?.toLowerCase() === 'pending';
        const hasResult = panel.classList.contains('active');

        if (hasResult && isPartialResult) {
          showHint('Possible match found — verify to confirm', 'si-hint-partial');
        } else if (hasResult) {
          clearHint();
        }
      });
      obs.observe(panel, { childList: true, subtree: true });
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();
