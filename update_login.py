import os
import re

file_path = "c:/Users/Gojan-R&D02/Downloads/hvid-deploy-main (1)/hvid-deploy-main/templates/auth/login.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We will completely replace <main class="auth-page" role="main"> ... </main> and ambient orbs
# We keep the scripts at the bottom.

new_body_content = """
  <style>
    body { background: var(--color-bg); margin: 0; padding: 0; display: flex; min-height: 100vh; font-family: var(--font-editorial); }
    .split-layout { display: flex; width: 100%; min-height: 100vh; }
    
    .left-panel {
      flex: 1;
      background: linear-gradient(135deg, #0B1F3A 0%, #102A4E 100%);
      color: #fff;
      padding: var(--space-12);
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .left-panel-content {
      position: relative;
      z-index: 2;
      max-width: 480px;
      margin: 0 auto;
    }
    .left-panel h1 { font-size: 48px; font-weight: 700; margin-bottom: var(--space-4); letter-spacing: -0.02em; line-height:1.1; }
    .left-panel p { font-size: 18px; color: #98A2B3; line-height: 1.6; }
    
    /* Subtle abstract security graphic */
    .abstract-graphic {
      position: absolute;
      right: -100px;
      bottom: -100px;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.05);
      z-index: 1;
    }
    .abstract-graphic::before {
      content: '';
      position: absolute;
      inset: 40px;
      border-radius: 50%;
      border: 1px dashed rgba(255,255,255,0.1);
      animation: spin 60s linear infinite;
    }
    .abstract-graphic::after {
      content: '';
      position: absolute;
      inset: 80px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.05);
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .right-panel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
      background: var(--color-bg);
    }
    .login-container {
      width: 100%;
      max-width: 440px;
      background: #FFFFFF;
      padding: var(--space-10);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--color-border);
    }
    .auth-logo-mark {
      width: 40px; height: 40px; border-radius: 10px; background: #155EEF;
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; margin-bottom: var(--space-6);
    }
    .auth-heading { font-size: 28px; font-weight: 700; color: #101828; margin-bottom: 8px; letter-spacing: -0.01em; }
    .auth-sub { font-size: 15px; color: #667085; margin-bottom: var(--space-8); }
    
    @media (max-width: 900px) {
      .left-panel { display: none; }
      .right-panel { padding: var(--space-4); }
      .login-container { padding: var(--space-6); }
    }
  </style>

  <div class="split-layout">
    <!-- LEFT PANEL -->
    <div class="left-panel">
      <div class="abstract-graphic"></div>
      <div class="left-panel-content animate-fadeUp">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--space-12);">
          <div style="width:32px;height:32px;border-radius:8px;background:#155EEF;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">HV</div>
          <span style="font-weight:700;font-size:20px;letter-spacing:-0.02em;">HVID</span>
        </div>
        <h1>Your Identity.<br>Protected.</h1>
        <p>Secure identity verification for a safer digital world.</p>
      </div>
    </div>

    <!-- RIGHT PANEL -->
    <div class="right-panel">
      <div class="login-container animate-fadeUp">
        <div class="auth-logo-mark">HV</div>
        <h1 class="auth-heading" id="auth-heading">Welcome Back</h1>
        <p class="auth-sub" id="auth-sub">Enter your phone number to sign in</p>

        <div id="form-error" class="input-error" role="alert" style="color:#F04438;font-size:13px;margin-bottom:16px;text-align:center;"></div>
        <div id="backend-warning" style="display:none;background:#FEF0C7;border:1px solid #FEC84B;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#B54708;">
          <strong>⚠️ Cannot reach backend server</strong><br>
          <span style="color:#B54708;margin-top:4px;display:block">Please start the backend server.</span>
        </div>

        <form class="auth-form" id="auth-form" data-auth-mode="login" novalidate autocomplete="off">
          <!-- Step 1: Phone -->
          <div id="otp-step-1">
            <div class="input-group" style="margin-bottom:16px;">
              <label class="input-label" for="country-code" style="color:#344054;font-weight:500;">Country code</label>
              <select id="country-code" class="input" style="border:1px solid #D0D5DD;border-radius:8px;">
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+91">🇮🇳 +91</option>
                <option value="+61">🇦🇺 +61</option>
              </select>
            </div>
            <div class="input-group" style="margin-bottom:24px;">
              <label class="input-label" for="phone-number" style="color:#344054;font-weight:500;">Phone number</label>
              <input type="tel" class="input" id="phone-number" name="phone" placeholder="555 000 0000" autocomplete="tel" required style="border:1px solid #D0D5DD;border-radius:8px;" />
            </div>
          </div>

          <!-- Step 2: OTP -->
          <div id="otp-step-2" aria-hidden="true" style="display:none; margin-bottom:24px;">
            <label class="input-label" style="color:#344054;font-weight:500;">Verification code</label>
            <p id="phone-sent-label" style="font-size:13px;color:#667085;margin-bottom:16px;">Sent to <span id="phone-echo" style="color:#155EEF;font-weight:600;"></span></p>
            <div class="otp-boxes" id="otp-boxes">
              <input class="otp-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" style="border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#101828;"/>
              <input class="otp-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" style="border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#101828;"/>
              <input class="otp-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" style="border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#101828;"/>
              <input class="otp-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" style="border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#101828;"/>
              <input class="otp-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" style="border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#101828;"/>
              <input class="otp-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" style="border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#101828;"/>
            </div>
            <input type="hidden" id="otp-real" name="otp" />
            <input type="hidden" id="otp" />
            <div style="text-align:center;margin-top:16px;">
              <button type="button" class="otp-back-link" id="otp-back-btn" style="color:#155EEF;font-size:13px;background:none;border:none;cursor:pointer;">Use different number</button>
            </div>
            <div id="resend-timer" style="font-size:13px;color:#667085;text-align:center;margin-top:8px;"></div>
          </div>

          <button type="submit" class="btn btn-primary" id="login-submit-btn" style="width:100%;padding:12px;font-size:15px;border-radius:8px;">
            Continue
          </button>
        </form>

        <p style="text-align:center;margin-top:24px;font-size:14px;color:#667085;">
          New here? <a href="/auth/signup" id="signup-link" style="color:#155EEF;font-weight:500;text-decoration:none;">Create account</a>
        </p>
      </div>
    </div>
  </div>
"""

# Replace body content up to the script tags
content = re.sub(r'<body>.*?<script src="/static/js/app.js">', '<body>' + new_body_content + '<script src="/static/js/app.js">', content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated login.html")
