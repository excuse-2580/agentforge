/**
 * qq-relay/index.js - QQ 接入中继服务（Node.js）
 *
 * 架构：
 *   QQ 用户 <-> QQ 机器人(go-cqhttp / OneBot) <-> 本中继 <-> AgentForge App
 *
 * 功能：
 *   1. 接收来自 AgentForge App 的 /send 请求，通过 OneBot 把文本发到指定 QQ 群/好友
 *   2. （可选）监听 QQ 群消息，回调 App 触发智能体推理，实现"机器人自动回复"
 *
 * 用法：
 *   npm install
 *   node index.js
 */
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.json());

// ====== 配置（建议用环境变量覆盖）======
const CONFIG = {
  port: process.env.PORT || 3000,
  relayToken: process.env.RELAY_TOKEN || '',
  // go-cqhttp HTTP API 地址（本服务主动调用）
  obHttpUrl: process.env.OB_HTTP_URL || 'http://127.0.0.1:5700',
  obAccessToken: process.env.OB_ACCESS_TOKEN || '',
  // WebSocket：go-cqhttp 反向 WS 连过来（用于接收群消息）
  wsHost: process.env.WS_HOST || '0.0.0.0',
  wsPort: process.env.WS_PORT || 8081,
};

// ====== 鉴权中间件 ======
function auth(req, res, next) {
  if (!CONFIG.relayToken) return next();
  const token = req.headers['x-relay-token'] || req.query.token;
  if (token !== CONFIG.relayToken) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// ====== 通过 go-cqhttp HTTP API 发送消息 ======
async function callOneBot(action, params) {
  const headers = { 'Content-Type': 'application/json' };
  if (CONFIG.obAccessToken) headers['Authorization'] = 'Bearer ' + CONFIG.obAccessToken;
  const res = await fetch(CONFIG.obHttpUrl + '/' + action, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`OneBot ${action} failed: ${res.status}`);
  return res.json();
}

// ====== 健康检查 ======
app.get('/health', auth, (req, res) => {
  res.json({ ok: true, service: 'agentforge-qq-relay', time: Date.now() });
});

// ====== 发送消息 ======
// Body: { target_id, target_type: 'group' | 'private', message, agent_id? }
app.post('/send', auth, async (req, res) => {
  const { target_id, target_type, message } = req.body || {};
  if (!target_id || !message) return res.status(400).json({ error: 'target_id & message required' });
  try {
    if (target_type === 'private') {
      await callOneBot('send_private_msg', { user_id: Number(target_id), message });
    } else {
      await callOneBot('send_group_msg', { group_id: Number(target_id), message });
    }
    console.log(`[send] -> ${target_type}:${target_id} : ${String(message).slice(0, 60)}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[send] error', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ====== 启动（同时支持 HTTP API + WebSocket 接收事件）======
const { createServer } = require('http');
const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: '/onebot' });
wss.on('connection', ws => {
  console.log('[onebot] go-cqhttp 已连接 (WebSocket)');
  ws.on('message', data => {
    try {
      const evt = JSON.parse(data.toString());
      // 收到群/私聊消息 -> 这里可以回调 AgentForge App 的智能体推理接口
      // 简化示例：仅打印。实际部署时可在此处触发 webhook 让智能体回复
      if (evt.post_type === 'message') {
        console.log(`[onebot] ${evt.message_type}:${evt.group_id || evt.user_id} :: ${evt.raw_message}`);
      }
    } catch (e) { /* ignore */ }
  });
});

httpServer.listen(CONFIG.port, () => {
  console.log(`AgentForge QQ Relay 监听 :${CONFIG.port}`);
  console.log(`  - HTTP API:  http://localhost:${CONFIG.port}`);
  console.log(`  - OneBot WS: ws://localhost:${CONFIG.port}/onebot  (go-cqhttp 反向 WS)`);
});

module.exports = app;
