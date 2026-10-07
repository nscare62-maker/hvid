import os
import re

file_path = "c:/Users/Gojan-R&D02/Downloads/hvid-deploy-main (1)/hvid-deploy-main/templates/dashboard/index.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_main = """    <main class="page-content">
      <div class="page-header animate-fadeUp">
        <h1 class="page-title">Command Center</h1>
        <p class="page-subtitle">Your secure identity dashboard and trusted verification status.</p>
      </div>

      <!-- Guidance Slot -->
      <div id="db-guidance-slot" class="animate-fadeUp"></div>
      <div class="db-reverify-banner" id="db-reverify-banner" style="display:none;margin-bottom:var(--space-4)"></div>
      <div class="db-frozen-banner" id="db-frozen-banner">
        <div class="db-frozen-icon">🔒</div>
        <div>
          <div class="db-frozen-text">Identity Frozen</div>
          <div style="font-size:12px;color:rgba(248,113,113,.7)">Your identity is temporarily restricted. Use "Recover Identity" to restore access.</div>
        </div>
      </div>

      <!-- HERO CARD: Trust & Identity Status -->
      <div class="card animate-fadeUp" style="padding:var(--space-8); margin-bottom:var(--space-8); background: linear-gradient(135deg, #0B1F3A, #102A4E); color: #fff; border: none;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-6);">
          <div>
            <div style="font-size:12px; letter-spacing:0.1em; color:#98A2B3; text-transform:uppercase; margin-bottom:var(--space-2);">Identity Status</div>
            <div style="display:flex; align-items:center; gap:var(--space-4); margin-bottom:var(--space-4);">
              <div class="db-avatar" id="db-avatar" style="width:64px; height:64px; font-size:24px; background:#155EEF; border:2px solid #fff; box-shadow:0 0 0 4px rgba(21,94,239,0.3);">U</div>
              <div>
                <div class="db-identity-name" id="db-display-name" style="font-size:24px; font-weight:700; color:#fff;">—</div>
                <div class="db-identity-hvid" id="db-hvid-id" style="font-size:14px; color:#98A2B3; font-family:monospace;">HVID-XXXXXXX</div>
              </div>
            </div>
            <div style="display:flex; gap:var(--space-3); flex-wrap:wrap;">
              <span class="badge badge-pending" id="db-identity-status" style="background:rgba(247,144,9,0.2); border-color:rgba(247,144,9,0.5); color:#F79009;">Active</span>
              <div id="db-tier-slot"></div>
              <span id="db-trust-signal" style="background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:12px; font-size:12px;">—</span>
            </div>
          </div>
          
          <div style="min-width:240px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:var(--radius-lg); padding:var(--space-5);">
            <div style="font-size:12px; color:#98A2B3; margin-bottom:8px;">HVID SECURITY LEVEL</div>
            <div style="font-size:28px; font-weight:700; color:#12B76A; margin-bottom:4px;" id="verification-level-value">Evaluating...</div>
            <div style="font-size:13px; color:#98A2B3; margin-bottom:16px;">Based on your current verification</div>
            <div id="trust-signal-container"></div>
            <div id="trust-card-target"></div>
            <div id="db-verify-me-slot" style="margin-top:12px;"></div>
          </div>
        </div>
      </div>

      <!-- QUICK ACTIONS -->
      <div class="dash-section-title animate-fadeUp delay-1">Quick Actions</div>
      <div class="quick-actions animate-fadeUp delay-1" style="grid-template-columns: repeat(4, 1fr); margin-bottom:var(--space-8);">
        <a href="/dashboard/identity" class="quick-action-btn" style="flex-direction:column; text-align:center; gap:var(--space-2);">
          <div class="quick-action-icon" style="background:#EFF4FF; color:#155EEF; border:none; width:48px; height:48px; border-radius:50%;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
          <div class="quick-action-label" style="font-size:13px;">My Identity</div>
        </a>
        <a href="/dashboard/verification" class="quick-action-btn" style="flex-direction:column; text-align:center; gap:var(--space-2);">
          <div class="quick-action-icon" style="background:#EFF4FF; color:#155EEF; border:none; width:48px; height:48px; border-radius:50%;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
          <div class="quick-action-label" style="font-size:13px;">Verify Now</div>
        </a>
        <a href="/dashboard/linked-accounts" class="quick-action-btn" style="flex-direction:column; text-align:center; gap:var(--space-2);">
          <div class="quick-action-icon" style="background:#EFF4FF; color:#155EEF; border:none; width:48px; height:48px; border-radius:50%;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></div>
          <div class="quick-action-label" style="font-size:13px;">Linked Accounts</div>
        </a>
        <a href="/dashboard/reports" class="quick-action-btn" style="flex-direction:column; text-align:center; gap:var(--space-2);">
          <div class="quick-action-icon" style="background:#EFF4FF; color:#155EEF; border:none; width:48px; height:48px; border-radius:50%;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
          <div class="quick-action-label" style="font-size:13px;">Reports & Alerts</div>
        </a>
      </div>

      <!-- MAIN CONTENT GRIDS -->
      <div class="grid-2 animate-fadeUp delay-2" style="margin-bottom:var(--space-8);">
        
        <!-- Verification Status -->
        <div class="card" style="display:flex; flex-direction:column;">
          <div class="dash-section-title" style="margin-bottom:var(--space-4);">Verification Status</div>
          <div id="db-verif-list" style="flex:1;"></div>
          <div style="margin-top:var(--space-4); padding-top:var(--space-4); border-top:1px solid var(--color-border); font-size:12px; color:var(--color-text-muted);">
            <div id="db-identity-type" style="display:inline-block; font-weight:600; color:var(--color-text-primary);"></div>
            <span id="identity-type-value"></span>
            <div id="db-identity-type-info" style="display:none;"></div>
            <a href="/identity-type" id="db-change-type-link" style="color:var(--color-primary); margin-left:8px;">Change type &rarr;</a>
          </div>
        </div>

        <!-- Security & Controls -->
        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3);">
              <div class="dash-section-title" style="margin:0;">Account Security</div>
              <span id="db-sec-status" class="badge badge-verified" style="background:#ECFDF3; color:#027A48; border-color:#ABEFC6;">Active</span>
            </div>
            <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:var(--space-4);">
              Last activity: <span id="db-last-activity" style="color:var(--color-text-primary); font-weight:500;">—</span>
              <br>Flags: <span id="security-flag-count" style="color:var(--color-text-primary); font-weight:500;">0</span>
            </div>
            <div id="db-security-alerts"></div>
            
            <div style="margin-top:var(--space-4); display:flex; flex-direction:column; gap:8px;">
              <button class="db-control-btn" id="db-freeze-btn" style="background:#FEF3F2; border-color:#FEE4E2; color:#B42318; border-radius:8px;">
                <span class="db-control-btn-icon">🔒</span>
                <div>
                  <div class="db-control-btn-label" style="color:#B42318;">Freeze Identity</div>
                </div>
              </button>
              <button class="db-control-btn" id="db-recover-btn" style="border-radius:8px; display:none;">
                <span class="db-control-btn-icon">🔓</span>
                <div>
                  <div class="db-control-btn-label">Recover Identity</div>
                </div>
              </button>
              <button class="db-control-btn" id="db-upgrade-btn" data-business-only style="border-radius:8px;">
                <span class="db-control-btn-icon">✨</span>
                <div>
                  <div class="db-control-btn-label">Upgrade Verification</div>
                </div>
              </button>
            </div>
          </div>
          
          <div class="card">
            <div class="dash-section-title" style="margin-bottom:var(--space-3);">Recent Match Activity</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:12px; color:var(--color-text-muted);">Times Checked</div>
                <div id="db-match-count" style="font-size:24px; font-weight:700; color:var(--color-text-primary);">0</div>
              </div>
              <a href="/dashboard/reports" class="btn btn-secondary btn-sm">View Match Log</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Timeline -->
      <div class="card animate-fadeUp delay-3">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-4);">
          <div class="dash-section-title" style="margin:0;">Recent Activity</div>
          <a href="/dashboard/timeline" style="font-size:13px; color:var(--color-primary); font-weight:500;">View all &rarr;</a>
        </div>
        <div id="db-activity-list" data-log="true"></div>
      </div>

      <div id="db-trust-insight" style="display:none;"></div>
      <div id="growth-upgrade-slot" data-business-only></div>

    </main>"""

content = re.sub(r'<main class="page-content">.*?</main>', new_main, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated index.html")
