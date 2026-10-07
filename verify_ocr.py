from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from services.document_validator import extract_text_from_image

img = Image.new("RGB", (1200, 900), "white")
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 52)
except Exception:
    font = ImageFont.load_default()

text_lines = [
    "Aadhaar",
    "Unique Identification Authority of India",
    "1234 5678 9012",
    "Name: Deva",
    "DOB: 01/01/1990",
]
for i, line in enumerate(text_lines, start=1):
    draw.text((60, 60 + (i - 1) * 110), line, fill="black", font=font)

buf = BytesIO()
img.save(buf, format="PNG")
text = extract_text_from_image(buf.getvalue(), "aadhaar-test.png")
print(text)
