/**
 * qq.js - QQ 接入客户端（OneBot v11 中继）
 * 智能体在 QQ 群 / 私聊中回复，需要一个中继服务（见 qq-relay/index.js）
 * 中继协议：HTTP POST，JSON，鉴权头 X-Relay-Token
 */
const QQ = (() => {

  /**
   * 通过中继发送消息
   * @param {Object} agent 智能体（含 qq 配置）
   * @param {string} text  要发送的文本内容
   */
  async function sendMessage(agent, text) {
    const qq = agent.qq;
    if (!qq.enabled) throw new Error('QQ 接入未启用');
    const url = (qq.relayUrl || '').trim().replace(/\/+$/, '') + '/send';
    const body = {
      target_id: qq.targetId,
      target_type: qq.targetType, // group | private
      message: text,
      agent_id: agent.id,
    };
    const headers = { 'Content-Type': 'application/json' };
    if (qq.relayToken) headers['X-Relay-Token'] = qq.relayToken;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`发送失败 [${res.status}] ${t}`);
    }
    return '已通过 QQ 中继发送 ✓';
  }

  /** 测试中继连接 */
  async function testRelay(agent) {
    const qq = agent.qq;
    const url = (qq.relayUrl || '').trim().replace(/\/+$/, '') + '/health';
    const headers = {};
    if (qq.relayToken) headers['X-Relay-Token'] = qq.relayToken;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) throw new Error(`中继不可用 [${res.status}]`);
    return '中继连接正常 ✓';
  }

  return { sendMessage, testRelay };
})();
