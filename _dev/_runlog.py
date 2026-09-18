#!/usr/bin/env python3
"""获取最近一次失败 run 的日志，定位 APK 构建失败原因。"""
import urllib.request, json
TOKEN = "${GITHUB_TOKEN}"
OWNER, REPO = "excuse-2580", "agentforge"
H = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}


def get(path):
    req = urllib.request.Request(f"https://api.github.com/repos/{OWNER}/{REPO}{path}", headers=H)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


c, d = get("/actions/workflows/build.yml/runs?per_page=3")
print("=== 最近 3 次 build runs ===")
runs = d.get("workflow_runs", [])
for r in runs:
    print(f"  id={r['id']}  status={r['status']}  conclusion={r['conclusion']}  created={r['created_at']}")
    print(f"    html: {r['html_url']}")
    print(f"    logs: {r['logs_url']}")

# 下载最近一次失败的日志
fail = next((r for r in runs if r["conclusion"] == "failure"), None)
if not fail:
    print("没有失败记录")
    raise SystemExit

run_id = fail["id"]
print(f"\n=== 拉取 run {run_id} 的日志列表 ===")
c, d = get(f"/actions/runs/{run_id}/logs")
# logs 端点返回 zip 流，无法直接 json；改用 jobs 端点拿步骤
c, d = get(f"/actions/runs/{run_id}/jobs?per_page=10")
print("jobs code:", c)
for job in d.get("jobs", []):
    print(f"\n  [Job] {job['name']}  status={job['status']}  conclusion={job['conclusion']}")
    for step in job.get("steps", []):
        print(f"    - {step['name']:40}  status={step['status']}  conclusion={step.get('conclusion')}")
        if step.get("conclusion") == "failure":
            print(f"      ⚠️ 失败步骤：{step['name']}")
