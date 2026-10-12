/**
 * HVID — Growth Loops Engine
 * ─────────────────────────────────────────────────────────────────
 * 7 organic growth loops, all optional, never forced.
 *
 * API (global window.Growth):
 *   Growth.verifyMeBtn(targetEl, opts)   — Loop 1: "Verify Me" CTA
 *   Growth.openShareModal(profileUrl)    — Loop 1+4: Share modal
 *   Growth.postMatchCta(containerEl)     — Loop 2: Post-match CTA
 *   Growth.defensiveCta(containerEl)     — Loop 3: Trust defensive CTA
 *   Growth.badgeWidget(targetEl, opts)   — Loop 5: Badge component
 *   Growth.upgradeCta(containerEl, tier) — Loop 6: Upgrade CTA
 *   Growth.embedCode(identityId)         — Loop 7: Embed generator
 *   Growth.initPage()                    — Auto-wire based on page context
 *
 * UX RULES (non-negotiable):
 *   - Never force share
 *   - Never spam
 *   - Always optional, dismissible
 *   - Messaging must be clean and trust-aligned
 */
'use strict';

const Growth = (() => {

  // ── Inject styles once ─────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hvid-growth-styles')) return;
    const s = document.createElement('style');
    s.id = 'hvid-growth-styles';
    s.textContent = `
      /* ── Share Modal ──────────────────────────────────────── */
      .growth-modal-overlay {
        position: fixed; inset: 0; z-index: 9000;
        background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        animation: growthFadeIn .18s ease;
      }
      .growth-modal {
        width: 100%; max-width: 460px;
        background: #13131f; border: 1px solid rgba(255,255,255,.1);
        border-radius: 18px; overflow: hidden;
        box-shadow: 0 24px 64px rgba(0,0,0,.7);
        animation: growthSlideUp .2s ease;
      }
      .growth-modal-header {
        padding: 20px 24px 0;
        display: flex; align-items: flex-start; justify-content: space-between;
      }
      .growth-modal-title {
        font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px;
      }
      .growth-modal-sub {
        font-size: 12px; color: rgba(255,255,255,.4); line-height: 1.5;
      }
      .growth-modal-close {
        background: rgba(255,255,255,.06); border: none; border-radius: 7px;
        width: 28px; height: 28px; cursor: pointer; color: rgba(255,255,255,.5);
        font-size: 14px; display: flex; align-items: center; justify-content: center;
        transition: background .15s; flex-shrink: 0; margin-left: 12px;
      }
      .growth-modal-close:hover { background: rgba(255,255,255,.1); }
      .growth-modal-body { padding: 20px 24px; }
      .growth-modal-footer { padding: 0 24px 20px; display: flex; gap: 8px; flex-wrap: wrap; }

      /* Share link row */
      .growth-share-row {
        display: flex; margin-bottom: 16px;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; overflow: hidden;
      }
      .growth-share-input {
        flex: 1; background: transparent; border: none;
        padding: 10px 14px; font-size: 12px; font-family: monospace;
        color: rgba(255,255,255,.6); cursor: default; outline: none;
      }
      .growth-copy-btn {
        padding: 10px 16px; background: transparent;
        border: none; border-left: 1px solid rgba(255,255,255,.08);
        font-size: 12px; font-weight: 600; color: #818cf8;
        cursor: pointer; white-space: nowrap; transition: background .15s;
      }
      .growth-copy-btn:hover { background: rgba(129,140,248,.1); }

      /* Message template */
      .growth-msg-box {
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 10px; padding: 12px 14px;
        font-size: 12px; color: rgba(255,255,255,.5);
        line-height: 1.6; margin-bottom: 16px;
      }
      .growth-share-actions {
        display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
      }
      .growth-share-btn {
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 9px; padding: 10px 8px;
        font-size: 11px; font-weight: 600;
        color: rgba(255,255,255,.6); cursor: pointer;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        transition: background .15s, color .15s;
      }
      .growth-share-btn:hover { background: rgba(255,255,255,.08); color: #fff; }
      .growth-share-btn-icon { font-size: 18px; }

      /* ── Embed section ────────────────────────────────────── */
      .growth-embed-code {
        background: rgba(0,0,0,.3);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 9px; padding: 12px 14px;
        font-size: 11px; font-family: monospace;
        color: rgba(255,255,255,.5); white-space: pre;
        overflow-x: auto; line-height: 1.8;
        margin-bottom: 10px;
      }

      /* ── Badge widget ─────────────────────────────────────── */
      .growth-badge-widget {
        display: inline-flex; align-items: center; gap: 8px;
        background: rgba(52,211,153,.07);
        border: 1px solid rgba(52,211,153,.18);
        border-radius: 999px; padding: 6px 14px;
        text-decoration: none; white-space: nowrap;
      }
      .growth-badge-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #34d399; flex-shrink: 0;
      }
      .growth-badge-text {
        font-size: 12px; font-weight: 700; color: #34d399; letter-spacing: .03em;
      }
      .growth-badge-logo {
        font-size: 10px; font-weight: 700; color: rgba(52,211,153,.5);
        letter-spacing: .05em;
      }

      /* ── CTA banners ──────────────────────────────────────── */
      .growth-cta-banner {
        border-radius: 12px; padding: 16px 18px;
        border: 1px solid;
        display: flex; align-items: center; gap: 14px;
        flex-wrap: wrap;
      }
      .growth-cta-text { flex: 1; min-width: 0; }
      .growth-cta-title {
        font-size: 13px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 3px;
      }
      .growth-cta-desc { font-size: 12px; color: var(--color-text-secondary); }
      .growth-cta-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 8px 16px; border-radius: 8px; border: 1px solid;
        font-size: 12px; font-weight: 600; cursor: pointer;
        text-decoration: none; white-space: nowrap;
        transition: opacity .15s, transform .1s; flex-shrink: 0;
      }
      .growth-cta-btn:hover { opacity: .82; transform: translateY(-1px); }

      @keyframes growthFadeIn  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes growthSlideUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function currentProfileUrl() {
    const session = window.Auth && Auth.getSession && Auth.getSession();
    const hvid    = session?.hvid || session?.identityId || '';
    return `${window.location.origin}/p.html?id=${encodeURIComponent(hvid)}`;
  }

  function copyText(text, btn, label = 'Copy link') {
    if (!btn) { navigator.clipboard.writeText(text).catch(() => {}); return; }
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!</span>';
      setTimeout(() => { btn.textContent = label; }, 2000);
    }).catch(() => {
      btn.textContent = label;
    });
  }

  // ── Loop 1+4: Share Modal ────────────────────────────────────
  function openShareModal(profileUrl) {
    injectStyles();
    profileUrl = profileUrl || currentProfileUrl();
    const msg  = `Verify my identity here: ${profileUrl}`;

    const overlay = document.createElement('div');
    overlay.className = 'growth-modal-overlay';
    overlay.id = 'growth-share-modal';
    overlay.innerHTML = `
      <div class="growth-modal" role="dialog" aria-label="Share identity profile">
        <div class="growth-modal-header">
          <div>
            <div class="growth-modal-title">Share your verified identity</div>
            <div class="growth-modal-sub">Let others verify who they're dealing with.</div>
          </div>
          <button class="growth-modal-close" id="growth-modal-close-btn" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="growth-modal-body">
          <!-- Link row -->
          <div class="growth-share-row">
            <input class="growth-share-input" id="growth-share-input" value="${profileUrl}" readonly />
            <button class="growth-copy-btn" id="growth-copy-link-btn">Copy link</button>
          </div>
          <!-- Message template -->
          <div class="growth-msg-box" id="growth-msg-box">${msg}</div>
          <!-- Share buttons -->
          <div class="growth-share-actions">
            <button class="growth-share-btn" id="gs-native">
              <span class="growth-share-btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></span>Share
            </button>
            <button class="growth-share-btn" id="gs-copy-msg">
              <span class="growth-share-btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>Copy message
            </button>
            <button class="growth-share-btn" id="gs-email">
              <span class="growth-share-btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></span>Email
            </button>
          </div>
        </div>
        <div class="growth-modal-footer">
          <button class="growth-cta-btn" id="growth-show-embed-btn"
            style="background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.5);font-size:11px">
            &#60;/&#62; Get embed code
          </button>
        </div>
        <!-- Embed code (hidden by default) -->
        <div id="growth-embed-section" style="display:none;padding:0 24px 20px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3);margin-bottom:8px">Embed on your website</div>
          <div class="growth-embed-code" id="growth-embed-code-block"></div>
          <button class="growth-copy-btn" id="growth-copy-embed-btn" style="padding:7px 14px;border:1px solid rgba(255,255,255,.08);border-radius:8px">Copy embed</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Wire close
    const close = () => overlay.remove();
    document.getElementById('growth-modal-close-btn').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    // Wire copy link
    const copyBtn = document.getElementById('growth-copy-link-btn');
    copyBtn.onclick = () => copyText(profileUrl, copyBtn);

    // Native share
    document.getElementById('gs-native').onclick = () => {
      if (navigator.share) {
        navigator.share({ title: 'My HVID Profile', text: msg, url: profileUrl }).catch(() => {});
      } else {
        copyText(profileUrl, copyBtn);
      }
    };

    // Copy message
    const msgBox = document.getElementById('growth-msg-box');
    document.getElementById('gs-copy-msg').onclick = function() {
      copyText(msgBox.textContent.trim(), this, 'Copy message');
    };

    // Email
    document.getElementById('gs-email').onclick = () => {
      window.location.href = `mailto:?subject=Verify%20my%20identity%20on%20HVID&body=${encodeURIComponent(msg)}`;
    };

    // Embed code toggle
    const embedBtn = document.getElementById('growth-show-embed-btn');
    const embedId  = profileUrl.split('id=')[1] || '';
    const iframeCode = `<iframe src="https://hvid.com/p.html?id=${decodeURIComponent(embedId)}"
  width="360" height="220" frameborder="0"
  style="border-radius:12px;border:none"
  title="HVID Identity Profile">
</iframe>`;
    const codeBlock = document.getElementById('growth-embed-code-block');
    const embedSection = document.getElementById('growth-embed-section');
    codeBlock.textContent = iframeCode;
    embedBtn.onclick = () => {
      const shown = embedSection.style.display !== 'none';
      embedSection.style.display = shown ? 'none' : 'block';
      embedBtn.textContent = shown ? '</> Get embed code' : 'Hide embed';
    };
    document.getElementById('growth-copy-embed-btn').onclick = function() {
      copyText(iframeCode, this, 'Copy embed');
    };
  }

  // ── Loop 1: "Verify Me" CTA button ──────────────────────────
  function verifyMeBtn(targetEl, opts = {}) {
    injectStyles();
    if (!targetEl) return;
    const profileUrl = opts.url || currentProfileUrl();
    const btn = document.createElement('button');
    btn.className = opts.className || 'growth-cta-btn';
    btn.style.cssText = opts.style || `background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.2);color:#34d399`;
    btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Verify Me</span>`;
    btn.onclick = () => openShareModal(profileUrl);
    targetEl.appendChild(btn);
    return btn;
  }

  // ── Loop 2: Post-match CTA ───────────────────────────────────
  function postMatchCta(containerEl) {
    injectStyles();
    if (!containerEl) return;
    const el = document.createElement('div');
    el.className = 'growth-cta-banner';
    el.style.cssText = `background:var(--color-accent-soft);border-color:var(--color-border);margin-top:16px`;
    el.innerHTML = `
      <div class="growth-cta-text">
        <div class="growth-cta-title">Want to verify yourself?</div>
        <div class="growth-cta-desc">Create your HVID identity so others can trust you too.</div>
      </div>
      <a href="/auth/signup" class="growth-cta-btn"
        style="background:var(--color-surface);border-color:var(--color-border);color:var(--color-primary)">
        Create your identity
      </a>`;
    containerEl.appendChild(el);
    return el;
  }

  // ── Loop 3: Trust defensive CTA ─────────────────────────────
  function defensiveCta(containerEl) {
    injectStyles();
    if (!containerEl) return;
    const el = document.createElement('div');
    el.className = 'growth-cta-banner';
    el.style.cssText = `background:rgba(251,191,36,.05);border-color:rgba(251,191,36,.15);margin-top:16px`;
    el.innerHTML = `
      <div class="growth-cta-text">
        <div class="growth-cta-title">Strengthen your identity to build trust</div>
        <div class="growth-cta-desc">Verification reduces risk signals and increases your credibility.</div>
      </div>
      <a href="/dashboard/verification" class="growth-cta-btn"
         style="background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.2);color:#fbbf24">
        Verify now
      </a>`;
    containerEl.appendChild(el);
    return el;
  }

  // ── Loop 5: Badge widget ─────────────────────────────────────
  function badgeWidget(targetEl, opts = {}) {
    injectStyles();
    if (!targetEl) return;
    const profileUrl = opts.url || currentProfileUrl();
    const el = document.createElement('a');
    el.href = profileUrl;
    el.className = 'growth-badge-widget';
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    el.title = 'Verified via HVID';
    el.innerHTML = `
      <span class="growth-badge-dot"></span>
      <span class="growth-badge-text">Verified Identity</span>
      <span class="growth-badge-logo">· HVID</span>`;
    targetEl.appendChild(el);
    return el;
  }

  // ── Loop 6: Upgrade CTA ──────────────────────────────────────
  function upgradeCta(containerEl, currentTier = 'BASIC') {
    injectStyles();
    if (!containerEl) return;
    if (currentTier === 'PREMIUM') return; // no upgrade needed

    const cfg = currentTier === 'PROFESSIONAL'
      ? { title: 'Unlock High Trust', desc: 'Add face verification for the strongest trust signal.', color: '#a78bfa', bg: 'rgba(167,139,250,.05)', border: 'rgba(167,139,250,.15)', btn: 'Complete Face Verification', href: '/dashboard/verification?step=face' }
      : { title: 'Unlock higher trust', desc: 'Verify your identity to unlock premium features.', color: '#60a5fa', bg: 'rgba(96,165,250,.06)', border: 'rgba(96,165,250,.15)', btn: 'Upgrade verification', href: '/dashboard/verification' };

    const el = document.createElement('div');
    el.className = 'growth-cta-banner';
    el.style.cssText = `background:${cfg.bg};border-color:${cfg.border};margin-top:16px`;
    el.innerHTML = `
      <div class="growth-cta-text">
        <div class="growth-cta-title" style="color:${cfg.color}">${cfg.title}</div>
        <div class="growth-cta-desc">${cfg.desc}</div>
      </div>
      <a href="${cfg.href}" class="growth-cta-btn"
         style="background:${cfg.bg};border-color:${cfg.border};color:${cfg.color}">
        ${cfg.btn}
      </a>`;
    containerEl.appendChild(el);
    return el;
  }

  // ── Loop 7: Embed code generator (standalone) ────────────────
  function embedCode(identityId) {
    return `<iframe src="https://hvid.com/p.html?id=${encodeURIComponent(identityId)}"
  width="360" height="220" frameborder="0"
  style="border-radius:12px;border:none"
  title="HVID Identity Profile">
</iframe>`;
  }

  // ── Auto-wire on page load ────────────────────────────────────
  function initPage() {
    injectStyles();
    const path = window.location.pathname;

    // Loop 2: Post-match CTA on result page
    if (path.endsWith('result.html') || document.getElementById('result-container')) {
      const actionsRow = document.getElementById('result-actions-row');
      if (actionsRow) postMatchCta(actionsRow);
    }

    // Loop 1: "Verify Me" on dashboard pages
    const verifyMeSlot = document.getElementById('verify-me-slot');
    if (verifyMeSlot) verifyMeBtn(verifyMeSlot);

    // Loop 5: Badge on profile page
    const badgeSlot = document.getElementById('growth-badge-slot');
    if (badgeSlot) badgeWidget(badgeSlot);

    // Loop 6: Upgrade CTA on dashboard
    const upgradeSlot = document.getElementById('growth-upgrade-slot');
    if (upgradeSlot) {
      const session = window.Auth && Auth.getSession && Auth.getSession();
      const tier    = session?.tier || 'BASIC';
      upgradeCta(upgradeSlot, tier);
    }
  }

  document.addEventListener('DOMContentLoaded', initPage);

  // ── Public API ───────────────────────────────────────────────
  return { verifyMeBtn, openShareModal, postMatchCta, defensiveCta, badgeWidget, upgradeCta, embedCode, initPage };
})();

window.Growth = Growth;
