/* ============================================================
   HVID — Core App JS
   Shared utilities, navigation, sidebar toggle
   ============================================================ */

'use strict';

// ── Public nav scroll effect ───────────────────────────────
(function initNavScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 20); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ── Active public nav link ─────────────────────────────────
(function setActiveNavLink() {
  const links   = document.querySelectorAll('.nav-link');
  const current = window.location.pathname;
  links.forEach(function(link) {
    const href = link.getAttribute('href');
    if (href && (href === current || current.endsWith(href))) {
      link.classList.add('active');
    }
  });
})();

// ── Dashboard sidebar active link ──────────────────────────
(function setActiveSidebarLink() {
  const links   = document.querySelectorAll('.sidebar-link');
  const current = window.location.pathname;
  links.forEach(function(link) {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href && href !== '/' && current === href) {
      link.classList.add('active');
    }
  });
})();

// ── Mobile sidebar toggle (dashboard pages) ────────────────
(function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Inject hamburger into topbar
  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('sidebar-toggle')) {
    var btn = document.createElement('button');
    btn.id        = 'sidebar-toggle';
    btn.className = 'sidebar-toggle';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.innerHTML = '☰';
    topbar.insertBefore(btn, topbar.firstChild);
  }

  // Inject overlay
  if (!document.getElementById('sidebar-overlay')) {
    var ov = document.createElement('div');
    ov.id        = 'sidebar-overlay';
    ov.className = 'sidebar-overlay';
    document.body.appendChild(ov);
  }

  var toggle  = document.getElementById('sidebar-toggle');
  var overlay = document.getElementById('sidebar-overlay');

  function openSidebar()  {
    sidebar.classList.add('open');
    if (overlay) overlay.style.display = 'block';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }

  if (toggle)  toggle.addEventListener('click',  function() {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  if (overlay) overlay.addEventListener('click', closeSidebar);

  sidebar.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.addEventListener('click', closeSidebar);
  });
})();

// ── Toast notification ─────────────────────────────────────
const HVID = window.HVID = {
  toast: function(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3000;

    var container = document.getElementById('hvid-toast-container');
    if (!container) {
      container    = document.createElement('div');
      container.id = 'hvid-toast-container';
      Object.assign(container.style, {
        position: 'fixed', bottom: '24px', right: '24px',
        zIndex: '9999', display: 'flex', flexDirection: 'column',
        gap: '10px', pointerEvents: 'none',
      });
      document.body.appendChild(container);
    }

    var colors = {
      info:    { bg: 'rgba(91,95,239,0.15)',   border: 'rgba(91,95,239,0.3)',   icon: '💬' },
      success: { bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  icon: '✓'  },
      warning: { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  icon: '⚠'  },
      error:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', icon: '✕'  },
    };
    var c = colors[type] || colors.info;

    var toast = document.createElement('div');
    toast.innerHTML = '<span style="margin-right:8px;opacity:0.8">' + c.icon + '</span>' + message;
    Object.assign(toast.style, {
      background: c.bg, border: '1px solid ' + c.border,
      color: '#F0F0FA', padding: '12px 18px', borderRadius: '10px',
      fontSize: '14px', fontWeight: '500', fontFamily: 'Inter, sans-serif',
      backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center',
      pointerEvents: 'auto', opacity: '1',
      transition: 'opacity 0.3s ease-out',
    });

    container.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 320);
    }, duration);
  },

  formatDate: function(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  truncate: function(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  },

  // Professional SVG Icons (No emojis)
  icons: {
    instagram: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>',
    camera: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>',
    twitter: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>',
    linkedin: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>',
    website: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    storefront: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>',
    custom: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    idCard: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"></rect><circle cx="8" cy="11" r="3"></circle><path d="M14 9h4"></path><path d="M14 13h4"></path><path d="M5 18c0-1.7 1.3-3 3-3s3 1.3 3 3"></path></svg>',
    shield: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    shieldCheck: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>',
    shieldLock: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><rect x="9" y="11" width="6" height="5" rx="1"></rect><path d="M10 11V9a2 2 0 0 1 4 0v2"></path></svg>',
    user: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    phone: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    mail: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    lock: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    bell: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    check: '<svg class="hvid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    checkCircle: '<svg class="hvid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    alertCircle: '<svg class="hvid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    clock: '<svg class="hvid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    xCircle: '<svg class="hvid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    bank: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M3 10h18"></path><path d="M5 10v11"></path><path d="M19 10v11"></path><path d="M9 10v11"></path><path d="M14 10v11"></path><path d="M12 2L2 7h20L12 2z"></path></svg>',
    wallet: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 3H4a2 2 0 0 0-2 2v2"></path><circle cx="17" cy="14" r="1"></circle></svg>',
    google: '<svg class="hvid-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.24 10.285V13.4h6.887C18.2 16.42 15.6 18.6 12.24 18.6 8.55 18.6 5.56 15.6 5.56 12s2.99-6.6 6.68-6.6c1.67 0 3.2.62 4.38 1.73l2.36-2.36C17.48 3.32 15.02 2.4 12.24 2.4 6.96 2.4 2.68 6.7 2.68 12s4.28 9.6 9.56 9.6c5.52 0 9.2-3.88 9.2-9.37 0-.64-.06-1.26-.17-1.945h-9.03z"/></svg>',
  },

  getIcon: function(name) {
    return this.icons[name] || this.icons.custom;
  }
};

window.HVID = HVID;
