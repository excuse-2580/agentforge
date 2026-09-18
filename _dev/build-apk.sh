#!/bin/bash
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
