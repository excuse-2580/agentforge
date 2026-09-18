#!/usr/bin/env python3
"""
通过 GitHub Git Data API 提交本地仓库全部文件并 force-update main 分支。
fine-grained PAT 不支持 git push，故用 API 完成。

策略：以远端 main 当前 tree 为 base，逐文件 upsert blob + 全量 tree，
      保留仓库已有但本地不存在的关键文件（CNAME、.nojekyll 等）。
"""
import os, json, base64, sys, urllib.request, urllib.error

TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
if not TOKEN:
    print("ERROR: 需要设置环境变量 GITHUB_TOKEN"); sys.exit(1)
OWNER, REPO = "excuse-2580", "agentforge"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"}
ROOT = os.path.dirname(os.path.abspath(__file__))

def req(path, method="GET", data=None):
    url = f"https://api.github.com/repos/{OWNER}/{REPO}{path}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    with urllib.request.urlopen(r) as resp:
        return resp.status, json.loads(resp.read().decode() or "{}")

def get(path):
    _, d = req(path); return d

SKIP_DIRS = {".git", "node_modules", ".idea"}
PRESERVE = {"CNAME", ".nojekyll"}   # 保留远端已有、本地没有的 Pages 关键文件

print("📦 收集本地文件...")
files = {}
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, ROOT).replace("\\", "/")
        if rel.startswith(".git/"): continue
        files[rel] = full
print(f"   本地 {len(files)} 个文件")

print("📤 上传 blobs...")
blobs = {}

def upload(rel, full):
    with open(full, "rb") as f:
        raw = f.read()
    try:
        content, encoding = raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        content, encoding = base64.b64encode(raw).decode(), "base64"
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/git/blobs"
    body = json.dumps({"content": content, "encoding": encoding}).encode()
    r = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read().decode())["sha"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        print(f"     [422 detail] {detail[:500]}")
        raise

for i, (rel, full) in enumerate(files.items(), 1):
    blobs[rel] = upload(rel, full)
    print(f"   [{i}/{len(files)}] ✓ {rel}")

# 远端 base commit
ref = get("/git/refs/heads/main")
base_sha = ref["object"]["sha"]
base_commit = get(f"/git/commits/{base_sha}")
base_tree_sha = base_commit["tree"]["sha"]

# 拉取远端 base tree（递归），保留本地没有但需保留的文件
print("🌳 拉取远端 base tree...")
_, base_tree = req(f"/git/trees/{base_tree_sha}?recursive=1")
remote_files = {t["path"]: t for t in base_tree.get("tree", []) if t["type"] == "blob"}

# 合并：本地文件优先，远端需保留的文件补充
tree_items = []
seen = set()
for rel, sha in blobs.items():
    tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": sha})
    seen.add(rel)

preserved = 0
for path, entry in remote_files.items():
    if path not in seen and os.path.basename(path) in PRESERVE:
        tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": entry["sha"]})
        preserved += 1
        print(f"   ↳ 保留远端文件: {path}")
print(f"   保留 {preserved} 个远端 Pages 文件")

print("🌳 创建新 tree...")
_, new_tree = req("/git/trees", "POST", {"base_tree": base_tree_sha, "tree": tree_items})

author = {"name": "AgentForge Bot", "email": "agentforge-bot@users.noreply.github.com"}

print("✏️  创建 commit...")
_, commit = req("/git/commits", "POST", {
    "message": "refactor(ui): 全面迁移到 Material Design 3 (Material You)\n\n"
               "- 重写 css/style.css：M3 语义色槽、形状系统、层级、动效、深浅双主题\n"
               "- 新增 js/ui.js 组件库（Snackbar/Dialog/Sheet/Menu/Switch/Slider/FAB）\n"
               "- 采用 Google Material Symbols 图标\n"
               "- 页面重构：Large App Bar + FAB、卡片网格、Material 气泡、Segmented Tabs\n"
               "- 修复 slider 缺 id 导致编辑器事件绑定失败的 bug\n"
               "- 新增 _md_verify.js 无头 DOM 渲染验证 + 端到端交互测试\n"
               "- 新增设计预览图与设计说明",
    "author": author, "committer": author,
    "tree": new_tree["sha"], "parents": [base_sha],
})

print("🔀 force-update main...")
_, r = req("/git/refs/heads/main", "PATCH", {"sha": commit["sha"], "force": True})
print(f"   ref: {r.get('ref')}  sha: {r.get('object',{}).get('sha','')[:8]}")

print(f"\n✅ 推送完成！commit {commit['sha'][:8]}")
print(f"   https://github.com/{OWNER}/{REPO}")
print(f"   https://{OWNER}.github.io/{REPO}/")
