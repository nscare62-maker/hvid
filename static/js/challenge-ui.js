/**
 * HVID — Challenge UI component
 * ─────────────────────────────────────────────────────────────────
 * Handles Ownership Challenge submission and status tracking.
 *
 * SAFETY RULES:
 *  - Never display accusation text publicly.
 *  - Use neutral, legally-safe terminology (Challenge vs Report).
 *  - Only show "Challenge under review" or "Challenge resolved".
 */
'use strict';

const ChallengeUI = (() => {

  function injectStyles() {
    if (document.getElementById('hvid-challenge-styles')) return;
    const s = document.createElement('style');
    s.id = 'hvid-challenge-styles';
    s.textContent = `
      .ch-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,.85); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; opacity: 0; transition: opacity .2s;
      }
      .ch-modal {
        width: 100%; max-width: 480px; background: #111;
        border: 1px solid rgba(255,255,255,.1); border-radius: 20px;
        padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,.4);
        transform: translateY(20px); transition: transform .2s;
      }
      .ch-modal.active { transform: translateY(0); }
      .ch-title { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #fff; }
      .ch-desc { font-size: 14px; color: rgba(255,255,255,.5); line-height: 1.6; margin-bottom: 24px; }
      .ch-field { margin-bottom: 20px; }
      .ch-label { display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,.3); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
      .ch-input { width: 100%; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 12px 16px; color: #fff; font-size: 14px; transition: border-color .2s; }
      .ch-input:focus { outline: none; border-color: #818cf8; background: rgba(255,255,255,.05); }
      .ch-textarea { min-height: 100px; resize: none; }
      .ch-footer { display: flex; gap: 12px; margin-top: 32px; }
      .ch-btn { flex: 1; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s; border: 1px solid transparent; }
      .ch-btn-cancel { background: transparent; border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.6); }
      .ch-btn-submit { background: #818cf8; color: #fff; box-shadow: 0 4px 12px rgba(129,140,248,.3); }
      .ch-btn:hover { opacity: .9; transform: translateY(-1px); }
      .ch-fee-notice { font-size: 11px; color: rgba(255,255,255,.3); text-align: center; margin-top: 16px; font-style: italic; }
    `;
    document.head.appendChild(s);
  }

  function openSubmission(targetId, assetId = null) {
    injectStyles();
    const overlay = document.createElement('div');
    overlay.className = 'ch-modal-overlay';
    overlay.innerHTML = `
      <div class="ch-modal">
        <div class="ch-title">Ownership Challenge</div>
        <div class="ch-desc">
          You are raising a formal challenge regarding the control of this identity/asset. 
          Challenges are reviewed manually by the HVID safety team.
        </div>
        
        <div class="ch-field">
          <label class="ch-label">Evidence Description</label>
          <textarea id="ch-desc-input" class="ch-input ch-textarea" placeholder="Explain why you believe this ownership claim is incorrect..."></textarea>
        </div>

        <div class="ch-field">
          <label class="ch-label">Evidence Links (max 3)</label>
          <input type="text" class="ch-input ch-evidence" placeholder="https://..." style="margin-bottom:8px">
          <input type="text" class="ch-input ch-evidence" placeholder="https://..." style="margin-bottom:8px">
          <input type="text" class="ch-input ch-evidence" placeholder="https://...">
        </div>

        <div class="ch-fee-notice">A processing fee of 50 HVID credits applies to ownership challenges.</div>

        <div class="ch-footer">
          <button class="ch-btn ch-btn-cancel" id="ch-close">Cancel</button>
          <button class="ch-btn ch-btn-submit" id="ch-submit">Raise Challenge</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => { overlay.style.opacity = '1'; overlay.querySelector('.ch-modal').classList.add('active'); }, 10);

    const close = () => {
      overlay.style.opacity = '0';
      overlay.querySelector('.ch-modal').classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('#ch-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelector('#ch-submit').onclick = async () => {
      const desc = overlay.querySelector('#ch-desc-input').value.trim();
      const links = Array.from(overlay.querySelectorAll('.ch-evidence'))
                         .map(el => el.value.trim())
                         .filter(v => v.length > 0);

      if (!desc) return alert('Please provide an evidence description.');

      const btn = overlay.querySelector('#ch-submit');
      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const token = localStorage.getItem('hvid_token');
        const myId = (typeof HVID_API !== 'undefined') ? HVID_API.auth.identityId() : null;

        const res = await fetch('/api/challenge/create', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            reporter_identity_id: myId,
            target_identity_id:   targetId,
            target_asset_id:      assetId,
            description:          desc,
            evidence_links:       links
          })
        });

        if (!res.ok) throw new Error('Failed to create challenge');
        
        btn.textContent = '✓ Raised';
        setTimeout(() => {
          close();
          alert('Challenge submitted successfully. It is now under review.');
          window.location.reload();
        }, 1000);

      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Raise Challenge';
        alert('Error: ' + err.message);
      }
    };
  }

  function getStatusLabel(status) {
    const MAP = {
      PENDING:            'Challenge under review',
      UNDER_REVIEW:       'Challenge under review',
      CHALLENGE_UPHELD:   'Challenge resolved — Ownership revoked',
      CHALLENGE_REJECTED: 'Challenge resolved — Claim confirmed',
      RESOLVED:           'Challenge resolved',
      REJECTED:           'Challenge resolved',
    };
    return MAP[status] || 'Challenge status unknown';
  }

  return { openSubmission, getStatusLabel };
})();

window.ChallengeUI = ChallengeUI;
