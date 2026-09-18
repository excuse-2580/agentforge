/**
 * llm.js - 大模型调用（OpenAI 兼容协议，支持流式）
 * 兼容：OpenAI / DeepSeek / Kimi(Moonshot) / Ollama / llama.cpp / 自定义端点
 */
const LLM = (() => {

  // 各服务商的默认端点 & 推荐模型
  const PRESETS = {
    openai:   { baseUrl: 'https://api.openai.com/v1',     modelName: 'gpt-4o-mini' },
    deepseek: { baseUrl: 'https://api.deepseek.com/v1',   modelName: 'deepseek-chat' },
    kimi:     { baseUrl: 'https://api.moonshot.cn/v1',   modelName: 'moonshot-v1-8k' },
    ollama:   { baseUrl: 'http://localhost:11434/v1',    modelName: 'llama3.2:3b' },
    custom:   { baseUrl: '',                              modelName: '' },
  };

  function getPreset(provider) {
    return PRESETS[provider] || PRESETS.custom;
  }

  /**
   * 发送一条消息，返回完整文本（非流式）
   * @param {Object} agent 智能体对象
   * @param {Array}  history [{role, content}]
   */
  async function chat(agent, history) {
    const cfg = agent.model;
    const url = normalizeBaseUrl(cfg.baseUrl) + '/chat/completions';
    const messages = buildMessages(agent, history);
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(cfg),
      body: JSON.stringify({
        model: cfg.modelName,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        top_p: cfg.topP,
        stream: false,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[${res.status}] ${errText || res.statusText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 流式对话：通过 fetch + ReadableStream 逐块回调
   * @param {Function} onDelta(chunkText)
   * @param {Function} onDone(fullText)
   */
  async function chatStream(agent, history, onDelta, onDone) {
    const cfg = agent.model;
    const url = normalizeBaseUrl(cfg.baseUrl) + '/chat/completions';
    const messages = buildMessages(agent, history);
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(cfg),
      body: JSON.stringify({
        model: cfg.modelName,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        top_p: cfg.topP,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[${res.status}] ${errText || res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 以 "\n\n" 分帧
      let sepIdx;
      while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, sepIdx).trim();
        buffer = buffer.slice(sepIdx + 2);
        if (!frame.startsWith('data:')) continue;
        const payload = frame.slice(5).trim();
        if (payload === '[DONE]') { onDone && onDone(full); return; }
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            onDelta && onDelta(delta);
          }
        } catch (e) { /* 忽略不完整帧 */ }
      }
    }
    onDone && onDone(full);
  }

  /** 测试连接：发一条最小请求 */
  async function testConnection(agent) {
    const cfg = agent.model;
    const url = normalizeBaseUrl(cfg.baseUrl) + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(cfg),
      body: JSON.stringify({
        model: cfg.modelName,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`连接失败 [${res.status}] ${t || res.statusText}`);
    }
    return '连接成功 ✓';
  }

  // ---- 内部工具 ----
  function normalizeBaseUrl(base) {
    let u = (base || '').trim().replace(/\/+$/, '');
    if (!u) throw new Error('API 地址不能为空');
    return u;
  }

  function buildHeaders(cfg) {
    const h = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) h['Authorization'] = 'Bearer ' + cfg.apiKey;
    return h;
  }

  function buildMessages(agent, history) {
    const msgs = [];
    if (agent.systemPrompt) {
      msgs.push({ role: 'system', content: agent.systemPrompt });
    }
    if (agent.greeting && (!history || history.length === 0)) {
      // 开场白作为首条 assistant 提示（可选）
    }
    (history || []).forEach(m => msgs.push({ role: m.role, content: m.content }));
    return msgs;
  }

  return { PRESETS, getPreset, chat, chatStream, testConnection };
})();

// 显式挂载到 window，兼容 jsdom / 严格环境
if (typeof window !== 'undefined') window.LLM = LLM;
