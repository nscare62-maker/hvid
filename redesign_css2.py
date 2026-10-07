import os
import re

base_dir = "c:/Users/Gojan-R&D02/Downloads/hvid-deploy-main (1)/hvid-deploy-main"
css_dir = os.path.join(base_dir, "static", "css")

def replace_colors(content, is_dashboard=False):
    # Replace green/olive hardcoded colors with generic/blue ones
    # Greens/olives
    content = re.sub(r'#[a-fA-F0-9]{6}', lambda m: get_replacement(m.group(0), is_dashboard), content)
    
    # Also fix rgba replacements if needed, but we'll try to just catch the main hex ones
    return content

def get_replacement(hex_val, is_dashboard):
    hex_val = hex_val.lower()
    
    # Mapping of old green/olive colors to new theme
    mapping = {
        '#f0f3e9': '#0B1F3A', # Sidebar bg
        '#e0e8d5': '#155EEF', # Sidebar link active bg
        '#fffefa': '#FFFFFF', # Topbar bg / Quick action bg
        '#f1f4ec': '#F9FAFB', # Identity card top
        '#e4ecd9': '#EFF4FF', # Avatar bg
        '#c9d5be': '#155EEF', # Avatar border
        '#e8efdd': '#EFF4FF', # Quick action icon
        '#d5e0cb': '#155EEF', # Quick action icon border
        '#b9cbaa': '#155EEF', # step indicator
    }
    
    if is_dashboard and hex_val == '#f0f3e9':
        return '#0B1F3A' # Dark navy sidebar
    
    if hex_val in mapping:
        return mapping[hex_val]
    
    return hex_val

for filename in os.listdir(css_dir):
    if filename.endswith(".css"):
        filepath = os.path.join(css_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        new_content = replace_colors(content, is_dashboard=(filename == "dashboard.css"))
        
        # Additional custom fixes for dashboard sidebar text
        if filename == "dashboard.css":
            new_content = new_content.replace('color: var(--color-text-secondary);', 'color: var(--color-text-muted); /* overridden for sidebar */')
            # For sidebar logo, we want white text
            new_content = re.sub(r'\.sidebar-logo \{\s*display: flex;', '.sidebar-logo {\n  display: flex;\n  color: #FFFFFF !important;', new_content)
            new_content = re.sub(r'\.sidebar-link \{\s*display: flex;', '.sidebar-link {\n  display: flex;\n  color: #98A2B3;', new_content)
            new_content = re.sub(r'\.sidebar-link:hover \{\s*color: var\(--color-text-primary\);', '.sidebar-link:hover {\n  color: #FFFFFF;\n  background: rgba(255,255,255,0.05);', new_content)
            new_content = re.sub(r'\.sidebar-link\.active \{\s*color: var\(--color-primary-h\);\s*background: rgba\(91,95,239,0\.1\);', '.sidebar-link.active {\n  color: #FFFFFF;\n  background: var(--color-primary);', new_content)
            new_content = re.sub(r'\.sidebar-user-name \{\s*font-size: 13px;', '.sidebar-user-name {\n  font-size: 13px;\n  color: #FFFFFF;', new_content)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)

print("Updated CSS files")
