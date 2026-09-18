#!/usr/bin/env python3
"""将三张设计预览拼成一张横排展示图，顶部加页面标签。"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
files = ["preview_home.png", "preview_chat.png", "preview_editor.png"]
labels = ["① 首页 · 智能体列表", "② 聊天页 · Material 气泡", "③ 编辑器 · Tabs / Switch / Slider"]

imgs = [Image.open(os.path.join(OUT, f)).convert("RGB") for f in files]
w, h = imgs[0].size
gap = 32
label_h = 56
canvas_w = w*3 + gap*4
canvas_h = h + label_h + 40
canvas = Image.new("RGB", (canvas_w, canvas_h), (11, 13, 18))

def font(sz):
    for p in ["/usr/share/fonts/truetype/roboto/Roboto-Medium.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

d = ImageDraw.Draw(canvas)
x = gap
for img, label in zip(imgs, labels):
    # 圆角描边外框
    d.rounded_rectangle((x-3, label_h-3, x+w+3, label_h+h+3), radius=18, outline=(68,70,79), width=2)
    canvas.paste(img, (x, label_h))
    # 页面标签
    d.text((x+12, 16), label, font=font(19), fill=(180, 196, 255))
    # 主题标签
    d.text((x+w-150, 18), "Material You · 深色", font=font(13), fill=(142, 144, 153))
    x += w + gap

canvas.save(os.path.join(OUT, "design_preview.png"))
print("✓ design_preview.png")
