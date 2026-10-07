import os
import re

base_dir = "c:/Users/Gojan-R&D02/Downloads/hvid-deploy-main (1)/hvid-deploy-main"

# 1. Update global.css
global_css_path = os.path.join(base_dir, "static", "css", "global.css")
with open(global_css_path, "r", encoding="utf-8") as f:
    global_css = f.read()

# Replace root variables
global_css = re.sub(
    r':root \{.*?(?=  /\* Spacing \*/)',
    """:root {
  /* Palette */
  --color-bg:         #F6F8FC;
  --color-surface:    #FFFFFF;
  --color-surface-1:  #FFFFFF;
  --color-surface-2:  #F9FAFB;
  --color-surface-3:  #F2F4F7;
  --color-border:     #E4E7EC;
  --color-border-hover: #D0D5DD;

  /* Accent */
  --color-primary:    #155EEF;
  --color-primary-h:  #0d4bbd;
  --color-secondary:  #0B1F3A;
  --color-green:      #12B76A;
  --color-amber:      #F79009;
  --color-red:        #F04438;
  --color-navy:       #0B1F3A;

  /* Text */
  --color-text-primary:   #101828;
  --color-text-secondary: #667085;
  --color-text-muted:     #98A2B3;
  --font-editorial: 'Inter', sans-serif;
  --color-accent-soft: #EFF4FF;

""",
    global_css,
    flags=re.DOTALL
)

global_css = re.sub(
    r'/\* Shadows \*/.*?--shadow-glow: [^\n]+;',
    """/* Shadows */
  --shadow-sm:  0 1px 3px rgba(16,24,40,0.05), 0 1px 2px rgba(16,24,40,0.03);
  --shadow-md:  0 4px 8px -2px rgba(16,24,40,0.05), 0 2px 4px -2px rgba(16,24,40,0.03);
  --shadow-lg:  0 12px 24px -4px rgba(16,24,40,0.08), 0 4px 8px -4px rgba(16,24,40,0.03);
  --shadow-glow: 0 0 0 4px rgba(21,94,239,0.1);""",
    global_css,
    flags=re.DOTALL
)

global_css = global_css.replace('background: var(--color-surface) !important; color: var(--color-text-primary) !important; box-shadow: var(--shadow-md) !important;', 'background: var(--color-surface) !important; color: var(--color-text-primary) !important; box-shadow: var(--shadow-lg) !important;')

with open(global_css_path, "w", encoding="utf-8") as f:
    f.write(global_css)

print("Updated global.css")
