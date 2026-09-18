"""生成 AgentForge 的 PWA 图标（SVG + PNG），纯 PIL 绘制，不依赖 emoji 字体。"""
import os
here = os.path.dirname(os.path.abspath(__file__))


def make_svg(path):
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#7c8cff"/><stop offset="100%" stop-color="#4654e0"/></linearGradient></defs>
<rect width="512" height="512" rx="120" fill="url(#g)"/>
<text x="50%" y="52%" font-size="280" text-anchor="middle" dominant-baseline="middle">AF</text>
</svg>'''
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg)


def make_png(path, size):
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = int(size * 0.234)
    draw.rounded_rectangle([0, 0, size, size], radius=r, fill=(92, 108, 255, 255))
    text = "AF"
    # 尝试常见字体，失败则用默认
    font = None
    for fp in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, int(size * 0.36))
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - bbox[1]), text, fill=(255, 255, 255, 255), font=font)
    img.save(path)


make_svg(os.path.join(here, 'icon.svg'))
for s in (192, 512):
    try:
        make_png(os.path.join(here, f'icon-{s}.png'), s)
        print(f"生成 icon-{s}.png")
    except Exception as e:
        print(f"icon-{s}.png 生成失败（{e}），保留 SVG 亦可正常运行")
