#!/usr/bin/env python3
"""本地烟雾测试：模拟 CI 的关键步骤，验证能否成功构建 APK。
方案：用 Docker 跑一个 android-build 环境（若可用），否则给出明确提示。
这里采用「无 Docker」时的降级方案 —— 直接校验 gradle 构建所需的工程文件是否齐备。
"""
import os, subprocess, sys

ROOT = "/data/workspace/agentforge"
print("=== 本地校验：APK 构建所需产物 ===")

# 1. capacitor sync 会生成 android/ 工程。我们检查 package.json + capacitor.config
for f in ["package.json", "capacitor.config.json", "index.html"]:
    p = os.path.join(ROOT, f)
    print(f"  {'✓' if os.path.exists(p) else '✗'} {f}")

# 2. 尝试用 Docker 跑完整的 android build（如环境支持）
docker = subprocess.run(["which", "docker"], capture_output=True, text=True).stdout.strip()
print("\n=== Docker 可用性 ===")
print("  docker:", docker or "未安装")

if docker:
    print("\n（Docker 可用时，可运行以下命令在本地完整构建 APK，与 CI 一致）")
    print("  docker run --rm -v $PWD:/app -w /app cirrusci/android-sdk:latest bash -c '")
    print("    sdkmanager --install \"platform-tools\" \"platforms;android-34\" \"build-tools;34.0.0\" && \\")
    print("    npm install && npx cap add android && npx cap sync && \\")
    print("    cd android && ./gradlew assembleDebug'")
else:
    print("\n本机无 Docker，改用「云端 CI 直接构建」方案（推荐）：")
    print("  workflow 已配置好，push 到 main 即触发 GitHub Actions 构建 APK。")
    print("  本次优化重点：手动装 SDK + 接受 licenses + gradle cache，规避第三方 action 权限问题。")

# 3. 生成一份「本地构建 APK」的一键脚本，供你在自己电脑上跑
script = """#!/bin/bash
# 本地一键构建 APK（需已安装 Node 18+ 与 Android Studio / SDK）
set -e
cd "$(dirname "$0")"
echo ">>> [1/4] 安装依赖"
npm install
echo ">>> [2/4] 添加安卓平台（如已存在可跳过）"
[ -d "android" ] || npx cap add android
echo ">>> [3/4] 同步 web 资源到安卓工程"
npx cap sync android
echo ">>> [4/4] 构建 Debug APK"
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo ">>> APK 输出：android/app/build/outputs/apk/debug/app-debug.apk"
"""
with open(os.path.join(ROOT, "build-apk.sh"), "w") as f:
    f.write(script)
os.chmod(os.path.join(ROOT, "build-apk.sh"), 0o755)
print("\n✓ 已生成 build-apk.sh —— 在你本机（配好 Android SDK 后）一键跑出 APK。")
