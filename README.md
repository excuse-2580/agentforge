# 🤖 智能体管家 · AgentForge

一个运行在安卓上的 **AI 智能体管理软件**，让你在手机上自由地：

- ➕ **创建 / 删除** AI 智能体
- ✍️ **自由设置智能体设定**（系统提示词、开场白、头像、标签）
- 🧠 **配置模型**：OpenAI 兼容、DeepSeek、Kimi、以及**本地模型**（Ollama / llama.cpp）
- 💬 **接入 QQ**：通过 OneBot 中继（go-cqhttp / qq-relay）让智能体在 QQ 群/私聊中回复
- 📦 **导出 / 导入**备份，数据完全保存在本机

> 本项目为 **PWA + Capacitor** 架构：同一套代码，既能当网页 / 手机浏览器 App 使用，
> 也能一键打包成真正的 **Android APK**。数据默认只存在本机，不上传任何服务器
> （除非你主动配置了远端模型或 QQ 中继）。

---

## ✨ 功能一览

| 模块 | 说明 |
|------|------|
| 智能体管理 | 创建、编辑、删除、复制、标签分类 |
| 设定配置 | 名称 / 头像(Emoji) / 简介 / System Prompt / 开场白 |
| 模型配置 | OpenAI 兼容、DeepSeek、Kimi、Ollama 本地、自定义端点 |
| 参数调节 | Temperature / Max Tokens / Top P / 流式输出 |
| 聊天对话 | 内置聊天界面，支持 Markdown 渲染、流式打字 |
| QQ 接入 | OneBot v11 中继，支持群聊 & 私聊，可测试连接 |
| 数据存储 | localStorage（Web）/ SharedPreferences（App） |
| 备份 | 导出 / 导入 JSON，一键清空 |

## 🚀 快速开始（网页版）

```bash
git clone https://github.com/<你的用户名>/agentforge.git
cd agentforge
# 直接用浏览器打开 index.html，或：
python3 -m http.server 8080
# 访问 http://localhost:8080
```

## 📱 打包安卓 APK

```bash
cd agentforge
npm install
npm run build          # 构建 web 资源到 dist/
npx cap add android    # 首次添加安卓平台（已生成好可直接 sync）
npx cap sync
npx cap open android   # 用 Android Studio 打开，点 Run 即可生成 APK
# 或命令行打包：
cd android && ./gradlew assembleDebug
# 输出：android/app/build/outputs/apk/debug/app-debug.apk
```

> 前置：Node.js ≥ 18，JDK 17，Android SDK。也可用 GitHub Actions 自动构建。

## 🔌 QQ 接入说明

QQ 接入需要一个运行中的「中继服务」把消息转给 QQ 机器人（OneBot 协议，如 go-cqhttp）。

仓库内 `qq-relay/` 提供了一个开箱即用的 Node 中继示例：

1. 在一台服务器（或本机）启动 go-cqhttp，开启 WebSocket / HTTP 上报
2. 启动 `qq-relay/index.js`，它会：
   - 接收来自本 App 的智能体回复请求
   - 通过 OneBot 把消息发到指定 QQ 群 / 好友
3. 在 App 的「QQ 接入」页填：中继地址 + Token + 目标群号

```
QQ 用户 → QQ 机器人(go-cqhttp) → qq-relay → AgentForge App
                                        ↕ 智能体推理（本地 or API）
```

## 🧠 本地模型

App 通过 **OpenAI 兼容端点** 对接本地模型：

- **Ollama**：默认 `http://localhost:11434/v1`，模型如 `llama3.2:3b`
- **llama.cpp server**：`--host 0.0.0.0 --port 8080`，端点 `/v1`
- 手机端跑本地模型：可用 [MLC LLM](https://llc.ai) / [ollama-android](https://github.com/ollama/ollama) 等，把端点填进 App 即可

## 📂 项目结构

```
agentforge/
├── index.html              # 入口
├── css/style.css           # 样式（暗色/亮色主题）
├── js/app.js               # 主逻辑、路由、状态管理
├── js/storage.js           # 数据持久化（localStorage）
├── js/llm.js               # 模型调用（OpenAI 兼容 / 流式）
├── js/qq.js                # QQ 中继客户端
├── manifest.webmanifest     # PWA 配置
├── sw.js                   # Service Worker（离线缓存）
├── capacitor.config.json   # Capacitor 安卓配置
├── android/                # 安卓原生工程（cap sync 生成）
├── qq-relay/               # QQ 接入中继服务
│   ├── index.js
│   └── package.json
├── .github/workflows/      # 自动构建 APK & 部署 Pages
└── README.md
```

## 🛡️ 隐私

- 所有智能体设定、对话记录默认**只保存在本机**
- API Key 存储在本地，仅在你发消息时直连模型服务商
- 不收集任何用户数据

## 📜 开源协议

MIT License
