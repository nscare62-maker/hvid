from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import requests

img = Image.new('RGB', (1200, 900), 'white')
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 52)
except Exception:
    font = ImageFont.load_default()

text_lines = [
    'Aadhaar',
    'Unique Identification Authority of India',
    '1234 5678 9012',
    'Name: Deva',
    'DOB: 01/01/1990',
]
for i, line in enumerate(text_lines, start=1):
    draw.text((60, 60 + (i - 1) * 110), line, fill='black', font=font)

buf = BytesIO()
img.save(buf, format='PNG')
data = buf.getvalue()
resp = requests.post(
    'https://api.ocr.space/parse/image',
    files={'file': ('aadhaar-test.png', data, 'image/png')},
    data={
        'apikey': 'helloworld',
        'language': 'eng',
        'isOverlayRequired': 'false',
        'detectOrientation': 'true',
        'scale': 'true',
        'OCREngine': '2',
    },
    timeout=60,
)
print(resp.status_code)
print(resp.text)
