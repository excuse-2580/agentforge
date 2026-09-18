#!/bin/bash
# 通过 GitHub Git Data API 推送当前仓库到 excuse-2580/agentforge main 分支。
# fine-grained PAT 不支持 git push，改用 API。
# 用法:  GITHUB_TOKEN=ghp_xxx ./_git_push.sh
set -e
cd "$(dirname "$0")"
if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: 请先设置环境变量 GITHUB_TOKEN"
  echo "  GITHUB_TOKEN=ghp_xxx ./_git_push.sh"
  exit 1
fi
exec python3 _api_push.py
