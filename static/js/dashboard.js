/* ============================================================
   HVID — Dashboard Logic
   Auth guard, session population, sidebar active link

   Token-aware: reads from Auth.getSession() which includes
   both token-based (identityId, phone) and legacy (email, name)
   fields. Protected-route.js handles token validation.
   ============================================================ */

'use strict';

// ── Auth guard — run on every dashboard page ────────────────
(function dashboardInit() {
  if (!window.Auth || !Auth.requireAuth()) return;

  const session = Auth.getSession();
  if (!session) return;

  // Populate user info in sidebar
  const nameEl  = document.getElementById('sidebar-user-name');
  const emailEl = document.getElementById('sidebar-user-email');
  const initEl  = document.getElementById('sidebar-user-initial');

  // Token-based session: prefer username, then phone, then identityId
  const displayName = session.username || session.name || session.email || session.phone || 'HVID User';
  const displaySub  = session.phone_last4 ? `****${session.phone_last4}` : (session.phone || '');
  const displayInit = displayName[0].toUpperCase();

  const isBusiness = (session.identity_type || session.identityType || session.account_type) === 'BUSINESS';
  document.querySelectorAll('[data-business-only]').forEach(el => {
    el.style.display = isBusiness ? '' : 'none';
  });

  if (nameEl)  nameEl.textContent  = displayName;
  if (emailEl) emailEl.textContent = displaySub;
  if (initEl)  initEl.textContent  = displayInit;

  const switchAccountBtn = document.getElementById('switch-account-btn');
  if (switchAccountBtn) {
    fetch('/api/auth/accounts', { headers: Auth.apiHeaders() })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const accounts = data?.accounts || [];
        const types = new Set(accounts.map(account => account.identity_type));
        const hasBoth = types.has('PERSONAL') && types.has('BUSINESS');
        switchAccountBtn.style.display = hasBoth ? 'inline-flex' : 'none';
        if (!hasBoth) return;

        const targetType = isBusiness ? 'PERSONAL' : 'BUSINESS';
        switchAccountBtn.textContent = `Switch to ${targetType === 'BUSINESS' ? 'Business' : 'Individual'}`;
        switchAccountBtn.addEventListener('click', async () => {
          switchAccountBtn.disabled = true;
          switchAccountBtn.textContent = 'Switching…';
          try {
            const response = await fetch('/api/auth/switch', {
              method: 'POST',
              headers: Auth.apiHeaders(),
              body: JSON.stringify({ identity_type: targetType }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to switch account.');
            Auth.loginWithToken(result.token, result.identity_id, result);
            window.location.reload();
          } catch (error) {
            switchAccountBtn.disabled = false;
            switchAccountBtn.textContent = `Switch to ${targetType === 'BUSINESS' ? 'Business' : 'Individual'}`;
            window.HVID?.toast(error.message, 'error');
          }
        });
      })
      .catch(() => {});
  }

  // Populate topbar HVID ID: prefer identityId (short), then hvid, then phone
  const hvidEl = document.getElementById('topbar-hvid');
  if (hvidEl) {
    const shortId = session.hvid
      || (session.identityId ? session.identityId.slice(0, 8).toUpperCase() : null);
    if (shortId) hvidEl.textContent = 'ID:' + shortId;
  }

  // Populate db-hvid-id (main dashboard card)
  const dbHvidEl = document.getElementById('db-hvid-id');
  if (dbHvidEl && session.identityId) {
    dbHvidEl.textContent = 'HVID-' + session.identityId.slice(0, 8).toUpperCase();
  }

  // Populate db-display-name and avatar initial
  const dbNameEl   = document.getElementById('db-display-name');
  const dbAvatarEl = document.getElementById('db-avatar');
  if (dbNameEl)   dbNameEl.textContent   = displayName;
  if (dbAvatarEl) dbAvatarEl.textContent = displayInit;

  // Render tier badge in topbar and any tier-badge slots
  if (session.identityId) {
    (async () => {
      let tier = 'BASIC';
      try {
        const r = await fetch(`/api/kyc/status?identityId=${session.identityId}`);
        if (r.ok) {
          const j = await r.json();
          if (j.status === 'VERIFIED') tier = 'PROFESSIONAL';
        }
        const r2 = await fetch(`/api/face/status?identityId=${session.identityId}`);
        if (r2.ok) {
          const j2 = await r2.json();
          if (j2.status === 'VERIFIED') tier = 'PREMIUM';
        }
      } catch (_) { /* default BASIC */ }

      if (window.TierUI) {
        // Inject compact badge into any element with id="topbar-tier-badge"
        const slot = document.getElementById('topbar-tier-badge');
        if (slot) {
          slot.innerHTML = '';
          slot.appendChild(TierUI.compact(tier));
        }
        // Also populate any tier-card targets on this page
        const card = document.getElementById('tier-card-target');
        if (card && !card.hasChildNodes()) TierUI.card(tier, card);
      }
    })();
  }
})();

// ── Sidebar active state ────────────────────────────────────
(function setActiveSidebarLink() {
  const links = document.querySelectorAll('.sidebar-link');
  const current = window.location.pathname.split('/').pop() || '/';

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.split('/').pop() === current) {
      link.classList.add('active');
    }
  });
})();

// ── Logout handler ──────────────────────────────────────────
(function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    Auth.logout();
    window.location.href = '/auth/login';
  });
})();

// ── Dashboard home — stat counters ─────────────────────────
(function animateCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  counters.forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;

    let current = 0;
    const step = Math.ceil(target / 30);
    const tick = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(tick);
    }, 30);
  });
})();

// ── Add linked account (placeholder) ───────────────────────
(function initAddAccount() {
  const btn = document.getElementById('add-account-btn');
  const modal = document.getElementById('add-account-modal');
  const closeBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('modal-cancel');

  // The linked-accounts page owns the real claim form and verification flow.
  if (!btn || !modal || document.getElementById('add-account-form')) return;

  btn.addEventListener('click', () => { modal.classList.add('open'); });
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('open'));

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });

  const form = document.getElementById('add-account-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      modal.classList.remove('open');
      window.HVID && window.HVID.toast('Asset submitted for verification.', 'info');
    });
  }
})();

// CLEANUP M4: initReportForm() fake handler REMOVED.
// Previously: intercepted form submit → called form.reset() → showed success toast
// "Report submitted privately. Our team will review." — with NO API call whatsoever.
// Users believed their report was filed; nothing was stored.
//
// The report form UI (report-form) is left intact.
// Real submission must be wired to HVID_API.report.submit() in the backend rebuild.
//
// (function initReportForm() { ... })();  // removed
