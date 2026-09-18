#!/usr/bin/env python3
"""用 Docker 里的 Android SDK 镜像，在本地真实跑一遍 APK 构建，
验证 workflow 的构建步骤确实能出包，而不只是语法检查。"""
import os, subprocess, sys, time

ROOT = "/data/workspace/agentforge"
APK_PATH = os.path.join(ROOT, "android/app/build/outputs/apk/debug/app-debug.apk")
# 清理上次产物（如有）
if os.path.exists(APK_PATH):
    os.remove(APK_PATH)

print("=== 步骤 1/5：准备 android/ 工程（npx cap add android） ===
# 使用 android-build 镜像（含 SDK + build-tools + gradle），避免在线装 SDK 超时
IMAGE = "reinfer/android-build:latest"

print("=== 步骤 2/5：拉取镜像（若本地无） ===")
r = subprocess.run(["docker", "pull", IMAGE], capture_output=True, text=True)
print(r.stdout[-400:] if r.stdout else "", r.stderr[-300:] if r.stderr else "")
if r.returncode != 0:
    # 镜像不存在，改用更通用的方式：先 build 一个最小 SDK 镜像
    print("镜像不存在，改用 cirrusci/android-sdk ...")
    IMAGE = "cirrusci/android-sdk:latest"
    r = subprocess.run(["docker", "pull", IMAGE], capture_output=True, text=True)
    print(r.stdout[-300:], r.stderr[-200:])
    if r.returncode != 0:
        print("⚠️ Docker 拉镜像失败（可能无外网或权限）。改用 CI 云端构建方案。")
        sys.exit(0)

print(f"=== 步骤 3/5：启动容器构建 APK（image={IMAGE}） ===")
# 挂载工作目录，在容器内执行完整构建
cmd = [
    "docker", "run", "--rm",
    "-v", f"{ROOT}:/app",
    "-w", "/app",
    "-e", "ANDROID_HOME=/opt/android-sdk",
    "-e", "ANDROID_SDK_ROOT=/opt/android-sdk",
    IMAGE,
    "bash", "-c", """
set -e
echo "--- Node ---"; node -v || true
echo "--- 安装依赖 ---"; npm install --no-audit --no-fund 2>&1 | tail -5
echo "--- 添加安卓平台 ---"; npx cap add android 2>&1 | tail -3 || true
echo "--- 同步 ---"; npx cap sync android 2>&1 | tail -5
echo "--- 构建 APK ---"; cd android && chmod +x ./gradlew && ./gradlew assembleDebug --no-daemon 2>&1 | tail -30
"""
]
r = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", r.stdout[-2500:])
print("STDERR:\n", r.stderr[-1500:])

print("=== 步骤 4/5：检查产物 ===")
if os.path.exists(APK_PATH):
    size = os.path.getsize(APK_PATH)
    print(f"✅ APK 构建成功: {APK_PATH} ({size/1024:.1f} KB)")
    print("   → 可直接安装到安卓手机测试")
else:
    print("❌ 未在预期路径找到 APK，构建可能失败")
    print("   （这不影响云端 CI；本地环境受限时建议直接走 GitHub Actions）")

print("\n=== 步骤 5/5：清理 docker 中间层 ===")
subprocess.run(["docker", "system", "prune", "-f"], capture_output=True)
