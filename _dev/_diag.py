#!/usr/bin/env python3
"""诊断：为什么 GitHub Actions 无法 push APK artifact。
思路：用同一个令牌，尝试以 "workflows" 相关 endpoint 验证权限，
并检查 Actions 是否可用、能否触发一次运行。"""
import urllib.request, json

TOKEN = "${GITHUB_TOKEN}"
OWNER, REPO = "excuse-2580", "agentforge"
H = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}


def get(path):
    req = urllib.request.Request(f"https://api.github.com/repos/{OWNER}/{REPO}{path}", headers=H)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read().decode()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def post(path, body=None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{OWNER}/{REPO}{path}",
        method="POST", headers={**H, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body else None)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


print("=== 1) 当前令牌身份 ===")
c, d = get("/")
print("  code:", c, "| type:", type(d).__name__)
if isinstance(d, str):
    print("  raw:", d[:400])
    d = {}
print("  repo:", d.get("full_name"), "| default_branch:", d.get("default_branch"),
      "| has_actions:", d.get("has_actions"))

print("\n=== 2) Actions 是否启用 ===")
c, d = get("/actions/permissions")
print("  code:", c, "| workflow_permissions:", d.get("workflow_permissions"),
      "| default_workflow_permissions:", d.get("default_workflow_permissions"))

print("\n=== 3) Workflow 列表 ===")
c, d = get("/actions/workflows")
print("  code:", c)
if isinstance(d, dict):
    for w in d.get("workflows", []):
        print("   -", w.get("name"), "| state:", w.get("state"), "| path:", w.get("path"))

print("\n=== 4) 最近的 workflow runs ===")
c, d = get("/actions/runs?per_page=5")
print("  code:", c)
if isinstance(d, dict):
    for r in d.get("workflow_runs", []):
        print("   -", r.get("name"), "| status:", r.get("status"), "| conclusion:", r.get("conclusion"))

print("\n=== 5) 尝试手动触发一次 build (workflow_dispatch) ===")
c, d = post("/actions/workflows/build.yml/dispatches", {"ref": "main"})
print("  dispatch code:", c, "| resp:", str(d)[:200])
