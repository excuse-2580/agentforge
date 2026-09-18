#!/usr/bin/env python3
"""
Material Design 3 设计预览生成器
精确还原 AgentForge 改造后的界面：深色主题、M3 色槽、组件形态。
输出：preview_home.png / preview_chat.png / preview_editor.png
依赖：pip install Pillow  (无需浏览器)
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))

# ===== M3 深色主题色槽 =====
BG        = (17, 19, 26)      # --md-sys-background
SURF     = (24, 26, 33)      # --md-sys-surface
SURF1    = (31, 33, 41)      # --md-sys-surface-1
SURF2    = (38, 41, 52)      # --md-sys-surface-2
PRIMARY   = (180, 196, 255)   # --md-sys-primary
ON_PRIMARY= (27, 42, 85)      # --md-sys-on-primary
PRIMARY_C = (59, 79, 138)     # --md-sys-primary-container
ON_P_C    = (219, 226, 255)   # --md-sys-on-primary-container
ON_BG     = (227, 225, 236)   # --md-sys-on-background
ON_SURF_V = (197, 198, 208)   # --md-sys-on-surface-variant
OUTLINE   = (142, 144, 153)   # --md-sys-outline
OUTLINE_V = (68, 70, 79)      # --md-sys-outline-variant
SUCCESS   = (164, 215, 175)
ERROR     = (255, 180, 171)
ERROR_C   = (147, 0, 10)

W, H = 420, 860
RADIUS_LG, RADIUS_MD, RADIUS_SM, RADIUS_FULL = 16, 12, 8, 9999
PAD = 16

def font(size):
    for p in [
        "/usr/share/fonts/truetype/roboto/Roboto-Regular.ttf",
        "/usr/share/fonts/opentype/roboto/Roboto-Regular.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    ]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def shadow_card(draw, box, radius, fill):
    """模拟 M3 elevation：先画半透明偏移层"""
    off = (box[0]+2, box[1]+3, box[2]+2, box[3]+4)
    draw.rounded_rectangle(off, radius=max(radius,1), fill=(0,0,0,40))
    draw.rounded_rectangle(box, radius=radius, fill=fill)

class Surface:
    def __init__(self, img): self.img = img; self.d = ImageDraw.Draw(img, "RGBA")
    def rect(self, box, **kw): self.d.rounded_rectangle(box, **kw)
    def text(self, xy, text, size=14, fill=ON_BG, bold=False):
        self.d.text(xy, text, font=font(size), fill=fill)
    def line(self, xy, **kw): self.d.line(xy, **kw)

def new_canvas():
    img = Image.new("RGBA", (W, H), BG)
    return img, Surface(img)

def appbar(s, title, sub=None, back=True, actions=2):
    """M3 Top App Bar"""
    s.rect((0,0,W,64), fill=BG)
    x = PAD
    if back:
        s.rect((x, 14, x+36, 50), radius=RADIUS_FULL, fill=SURF2)
        s.text((x+9, 22), "‹", 22, fill=ON_BG)
        x += 44
    # brand
    s.text((x, 20), title, 19, ON_BG, bold=True)
    if sub: s.text((x, 42), sub, 10, ON_SURF_V)
    # actions (icon buttons)
    ax = W - PAD - 36*actions + (0 if actions>1 else 0)
    for i in range(actions):
        cx = W - PAD - 40*(i+1) + 4
        s.rect((cx, 14, cx+36, 50), radius=RADIUS_FULL, fill=SURF2)

def fab(img, icon="+"):
    """M3 FAB（右下角）"""
    d = ImageDraw.Draw(img, "RGBA")
    size = 56
    x, y = W - PAD - size, H - PAD - size - 8
    d.rounded_rectangle((x, y, x+size, y+size), radius=RADIUS_LG, fill=PRIMARY_C)
    d.text((x+size/2-8, y+size/2-12), icon, font=font(24), fill=ON_P_C)

# ================= 首页 =================
def preview_home():
    img, s = new_canvas()
    appbar(s, "智能体管家", "AgentForge · 管理你的 AI 智能体", back=False, actions=2)
    # Hero
    s.text((PAD, 76), "在手机上自由创建、删除、配置你的 AI 智能体。", 13, ON_SURF_V)
    s.text((PAD, 95), "Material You · 支持本地模型 · 支持 QQ 接入", 12, OUTLINE)

    # Toolbar buttons
    s.rect((PAD, 124, 178, 156), radius=RADIUS_FULL, fill=SURF2)
    s.text((PAD+14, 132), "⬇ 导入备份", 12, ON_BG)
    s.rect((190, 124, 304, 156), radius=RADIUS_FULL, outline=OUTLINE, width=1)
    s.text((200, 132), "⬆ 导出备份", 12, PRIMARY)

    # Section title
    s.text((PAD, 172), "你的智能体", 11, ON_SURF_V)

    # Agent cards (grid: 1 column on narrow)
    cards = [
        ("🐺", "小夜", "🟢 QQ 在线 · 本地模型", "一只巧克力味的小狼，温柔又有点玻璃心", ["Furry","助手","示例"]),
        ("🤖", "代码助手", "⚪ 离线 · OpenAI", "资深程序员，精通 Python/JS", ["编程","工具"]),
    ]
    cy = 196
    for avatar, name, status, summary, tags in cards:
        h = 138
        shadow_card(s.d, (PAD, cy, W-PAD, cy+h), RADIUS_LG, SURF1)
        # avatar
        s.rect((PAD+14, cy+16, PAD+62, cy+64), radius=RADIUS_FULL, fill=PRIMARY_C)
        s.text((PAD+24, cy+26), avatar, 22, fill=ON_P_C)
        # title + status
        s.text((PAD+74, cy+20), name, 16, ON_BG, bold=True)
        s.text((PAD+74, cy+42), status, 10, ON_SURF_V)
        # summary
        s.text((PAD+14, cy+74), summary, 12, ON_SURF_V)
        # chips
        cx = PAD+14
        for t in tags:
            tw = len(t)*13 + 18
            s.rect((cx, cy+h-34, cx+tw, cy+h-12), radius=RADIUS_FULL, fill=SURF2)
            s.text((cx+9, cy+h-31), t, 10, ON_SURF_V)
            cx += tw + 6
        # action buttons row
        by = cy+h-34
        bx = W - PAD - 96
        s.rect((bx, by, bx+84, by+22), radius=RADIUS_FULL, fill=PRIMARY)
        s.text((bx+10, by+3), "💬 聊天", 10, ON_PRIMARY, bold=True)
        cy += h + 12

    fab(img, "+")
    img.convert("RGB").save(os.path.join(OUT, "preview_home.png"))

# ================= 聊天页 =================
def preview_chat():
    img, s = new_canvas()
    appbar(s, "小夜", "本地模型 · llama3.2:3b", back=True, actions=2)
    # messages
    msgs = [
        ("bot",  "🐺", "小夜", "呜汪～你好呀！我是小夜，一只巧克力味的小狼，很高兴认识你！🍫🐾"),
        ("user", None, None, "小夜小夜，今天枣庄天气怎么样呀？"),
        ("bot",  "🐺", "小夜", "唔…让我想想，枣庄今天多云转晴，22~30°C，适合出去逛逛呢！不过我是本地小狼，不能真的查天气啦，可以去问问天气助手～"),
    ]
    y = 74
    for role, av, name, text in msgs:
        if role == "bot":
            # avatar
            s.rect((PAD, y, PAD+32, y+32), radius=RADIUS_FULL, fill=PRIMARY_C)
            if av: s.text((PAD+7, y+6), av, 14, ON_P_C)
            # bubble
            bx = PAD + 40
            s.text((bx, y-2), name, 9, ON_SURF_V)
            lines = [text[i:i+16] for i in range(0, len(text), 16)]
            bh = len(lines)*17 + 12
            s.rect((bx, y+8, W-PAD-20, y+8+bh), radius=18, fill=SURF1)
            for i, ln in enumerate(lines):
                s.text((bx+10, y+12+i*17), ln, 12, ON_BG)
            y += max(40, bh+24)
        else:
            text_lines = [text[i:i+18] for i in range(0, len(text), 18)]
            bw = max(len(text_lines[0])*12 + 24, 80)
            bx = W - PAD - bw
            bh = len(text_lines)*17 + 14
            s.rect((bx, y, bx+bw, y+bh), radius=18, fill=PRIMARY)
            for i, ln in enumerate(text_lines):
                s.text((bx+12, y+7+i*17), ln, 12, ON_PRIMARY, bold=True)
            y += bh + 16

    # Typing indicator
    s.rect((PAD+40, y, PAD+92, y+26), radius=18, fill=SURF1)
    for i in range(3):
        cx = PAD+52 + i*12
        s.rect((cx, y+9, cx+6, y+15), radius=3, fill=ON_SURF_V)

    # Composer
    composer_y = H - 72
    s.rect((0, composer_y, W, H), fill=SURF)
    s.line((0, composer_y, W, composer_y), fill=OUTLINE_V)
    s.rect((PAD, composer_y+12, W-PAD-66, composer_y+52), radius=RADIUS_LG, fill=SURF2)
    s.text((PAD+12, composer_y+22), "给 小夜 发消息…", 12, OUTLINE)
    # send FAB-small
    sx = W - PAD - 50
    s.rect((sx, composer_y+16, sx+44, composer_y+60), radius=RADIUS_FULL, fill=PRIMARY)
    s.text((sx+13, composer_y+26), "➤", 18, ON_PRIMARY)
    img.convert("RGB").save(os.path.join(OUT, "preview_chat.png"))

# ================= 编辑器 =================
def preview_editor():
    img, s = new_canvas()
    appbar(s, "编辑智能体", "小夜", back=False, actions=2)
    # Tabs (M3 segmented)
    tabs = ["基本", "模型", "QQ", "高级"]
    tx = PAD
    tab_y = 72
    active = 1  # 模型 tab
    for i, t in enumerate(tabs):
        tw = 58
        is_a = (i == active)
        color = PRIMARY if is_a else ON_SURF_V
        s.text((tx+10, tab_y+4), t, 13, color, bold=is_a)
        if is_a:
            s.line((tx, tab_y+28, tx+tw, tab_y+28), fill=PRIMARY, width=3)
        tx += tw + 6

    # Surface panel
    py = 112
    panel_h = 560
    s.rect((PAD, py, W-PAD, py+panel_h), radius=RADIUS_LG, fill=SURF1)

    def field(y, label, value, w=None, pw=False):
        s.text((PAD+14, y), label, 11, ON_SURF_V)
        fh = 40
        fy = y + 14
        s.rect((PAD+14, fy, W-PAD-14, fy+fh), radius=RADIUS_SM, outline=OUTLINE_V, width=1)
        if value:
            disp = "•"*len(value) if pw else value
            s.text((PAD+24, fy+11), disp, 12, ON_BG)
        return fy + fh

    y = py + 14
    y = field(y, "模型服务商", "") + 4
    s.text((PAD+24, y-26), "本地模型（Ollama / llama.cpp）", 12, ON_BG)
    y = field(y, "API 地址（Base URL）", "http://localhost:11434/v1") + 8
    y = field(y, "API Key  · 本地模型可留空", "") + 4
    s.text((PAD+24, y-26), "sk-•••••••••••", 12, ON_BG)
    y = field(y, "模型名称", "llama3.2:3b") + 8

    # Slider (温度)
    s.text((PAD+14, y+2), "温度 Temperature：0.80", 11, ON_SURF_V)
    sy = y + 22
    s.line((PAD+14, sy+6, W-PAD-14, sy+6), fill=PRIMARY_C, width=4)
    knob_x = PAD+14 + int((0.80/2.0)*(W-2*PAD-28))
    s.rect((knob_x-8, sy-2, knob_x+8, sy+14), radius=RADIUS_FULL, fill=PRIMARY)
    y = sy + 26

    # Switch (流式输出)
    s.text((PAD+14, y+4), "启用流式输出（Streaming）", 13, ON_BG)
    sx = W - PAD - 52
    s.rect((sx, y, sx+48, y+28), radius=RADIUS_FULL, fill=PRIMARY_C)
    s.rect((sx+22, y+4, sx+44, y+24), radius=RADIUS_FULL, fill=PRIMARY)
    y += 46

    # Test button (outlined, block)
    s.rect((PAD+14, y, W-PAD-14, y+40), radius=RADIUS_FULL, outline=OUTLINE, width=1)
    s.text((PAD+60, y+11), "🔌  测试连接", 13, PRIMARY)
    y += 56

    # Danger zone
    s.rect((PAD+14, y, W-PAD-14, y+96), radius=RADIUS_MD, outline=ERROR_C, width=1)
    s.text((PAD+26, y+12), "危险区", 11, ERROR)
    s.rect((PAD+26, y+34, PAD+150, y+64), radius=RADIUS_FULL, outline=ERROR, width=1)
    s.text((PAD+38, y+42), "清空对话", 11, ERROR)

    img.convert("RGB").save(os.path.join(OUT, "preview_editor.png"))

if __name__ == "__main__":
    preview_home()
    preview_chat()
    preview_editor()
    print("✓ 生成设计预览：preview_home.png / preview_chat.png / preview_editor.png")
