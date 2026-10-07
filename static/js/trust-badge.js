/**
 * HVID Trust Badge Component
 * 
 * Usage:
 * <div id="hvid-trust-badge" data-identity-id="UUID"></div>
 * <script src="/js/trust-badge.js"></script>
 */

(function() {
  'use strict';

  async function initTrustBadge() {
    const container = document.getElementById('hvid-trust-badge');
    if (!container) return;

    const identityId = container.getAttribute('data-identity-id');
    if (!identityId) return;

    try {
      // Note: This uses the public trust-signals endpoint
      const res = await fetch(`/api/identity/${identityId}/trust-signals`);
      if (!res.ok) throw new Error('Failed to load trust signals');
      
      const signals = await res.json();
      renderBadge(container, signals);
    } catch (err) {
      console.error('HVID Trust Badge Error:', err);
      container.innerHTML = '<span style="font-size:11px; color:rgba(255,255,255,0.2)">Trust signals unavailable</span>';
    }
  }

  function renderBadge(container, signals) {
    const styles = `
      .hvid-badge-wrap { display: flex; gap: 8px; align-items: center; }
      .hvid-signal { 
        font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
        padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);
      }
      .hvid-VERIFIED { color: #10b981; background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.2); }
      .hvid-UNVERIFIED { color: #94a3b8; background: rgba(148,163,184,0.05); }
      .hvid-LIMITED { color: #f59e0b; background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.2); }
      .hvid-SUSPENDED { color: #ef4444; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); }
      .hvid-stability { color: #818cf8; font-weight: 600; opacity: 0.8; }
    `;

    const styleTag = document.createElement('style');
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);

    container.innerHTML = `
      <div class="hvid-badge-wrap">
        <span class="hvid-signal hvid-${signals.verification}">${signals.verification}</span>
        <span class="hvid-signal hvid-${signals.status}">${signals.status}</span>
        <span class="hvid-signal hvid-stability">${signals.stability}</span>
      </div>
    `;
  }

  // Auto-init if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrustBadge);
  } else {
    initTrustBadge();
  }
})();
