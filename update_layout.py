import os
import re

base_dir = "c:/Users/Gojan-R&D02/Downloads/hvid-deploy-main (1)/hvid-deploy-main/templates/dashboard"

sidebar_template = """  <aside class="sidebar" id="sidebar">
    <div class="sidebar-top">
      <a href="/" class="sidebar-logo">
        <div class="sidebar-logo-mark">HV</div>
        HVID
      </a>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-nav-section">
        <div class="sidebar-nav-label">OVERVIEW</div>
        <a href="/dashboard" class="sidebar-link __DASHBOARD_ACTIVE__" id="nav-overview">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </span> Dashboard
        </a>
      </div>
      <div class="sidebar-nav-section">
        <div class="sidebar-nav-label">IDENTITY</div>
        <a href="/dashboard/identity" class="sidebar-link __IDENTITY_ACTIVE__" id="nav-identity">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </span> My Identity
        </a>
        <a href="/dashboard/verification" class="sidebar-link __VERIFICATION_ACTIVE__" id="nav-verification">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </span> Verification
        </a>
        <a href="/dashboard/linked-accounts" class="sidebar-link __LINKED_ACTIVE__" id="nav-linked">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </span> Linked Accounts
        </a>
      </div>
      <div class="sidebar-nav-section">
        <div class="sidebar-nav-label">SECURITY</div>
        <a href="/dashboard/timeline" class="sidebar-link __TIMELINE_ACTIVE__" id="nav-timeline">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          </span> Activity
        </a>
      </div>
      <div class="sidebar-nav-section">
        <div class="sidebar-nav-label">REPORTS</div>
        <a href="/dashboard/reports" class="sidebar-link __REPORTS_ACTIVE__" id="nav-reports">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </span> Reports &amp; Alerts
        </a>
      </div>
    </nav>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar" id="sidebar-user-initial">U</div>
        <div>
          <div class="sidebar-user-name" id="sidebar-user-name">Loading…</div>
          <div class="sidebar-user-email" id="sidebar-user-email"></div>
        </div>
      </div>
      <div style="margin-top:var(--space-2)">
        <a href="#" class="sidebar-link" id="logout-btn" style="color:var(--color-text-muted)">
          <span class="sidebar-link-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </span> Sign Out
        </a>
      </div>
    </div>
  </aside>"""

topbar_template = """    <header class="topbar">
      <div class="topbar-title" style="display:flex;align-items:center;gap:12px">
        <button class="sidebar-toggle" id="mobile-sidebar-toggle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <span id="topbar-page-title">__PAGE_TITLE__</span>
      </div>
      <div class="topbar-right">
        <span style="font-size:12px;color:var(--color-text-muted);font-family:monospace;background:var(--color-surface-2);padding:4px 8px;border-radius:6px;border:1px solid var(--color-border)" id="topbar-hvid"></span>
        <span id="verify-me-slot" style="margin-right:4px"></span>
        <a href="/dashboard/reports" class="topbar-icon-btn" title="Alerts" id="topbar-alerts-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </a>
        <a href="/dashboard/identity" class="topbar-icon-btn" title="Identity" id="topbar-identity-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </a>
      </div>
    </header>"""

for filename in os.listdir(base_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(base_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract title if possible
        title_match = re.search(r'<div class="topbar-title">([^<]+)</div>', content)
        title = title_match.group(1).strip() if title_match else "Dashboard"
        if "My Identity" in content[:1000]: title = "My Identity"
        if filename == "identity.html": title = "My Identity"
        if filename == "verification.html": title = "Verification"
        if filename == "linked-accounts.html": title = "Linked Accounts"
        if filename == "timeline.html": title = "Activity"
        if filename == "reports.html": title = "Reports & Alerts"
        if filename == "index.html": title = "Dashboard"

        tb = topbar_template.replace("__PAGE_TITLE__", title)

        sb = sidebar_template
        sb = sb.replace("__DASHBOARD_ACTIVE__", "active" if filename == "index.html" else "")
        sb = sb.replace("__IDENTITY_ACTIVE__", "active" if filename == "identity.html" else "")
        sb = sb.replace("__VERIFICATION_ACTIVE__", "active" if filename == "verification.html" else "")
        sb = sb.replace("__LINKED_ACTIVE__", "active" if filename == "linked-accounts.html" else "")
        sb = sb.replace("__TIMELINE_ACTIVE__", "active" if filename == "timeline.html" else "")
        sb = sb.replace("__REPORTS_ACTIVE__", "active" if filename == "reports.html" else "")

        # Replace sidebar
        content = re.sub(r'<aside class="sidebar".*?</aside>', sb, content, flags=re.DOTALL)
        
        # Replace topbar
        content = re.sub(r'<header class="topbar">.*?</header>', tb, content, flags=re.DOTALL)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

print("Updated HTML layouts")
