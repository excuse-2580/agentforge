/**
 * app.js - 智能体管家 主逻辑
 * 路由、智能体列表、编辑器、聊天、QQ 接入、全局设置
 */
(function () {
  'use strict';

  // ============ 简易路由 ============
  const routes = {
    '#/': renderHome,
    '#/agent/': renderChat,
    '#/edit/': renderEditor,
    '#/settings': renderSettings,
  };

  function navigate(hash) {
    location.hash = hash;
  }

  function router() {
    const hash = location.hash || '#/';
    const [path, query] = hash.split('?');
    const handler = routes[path] || renderHome;
    handler(query);
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    router();
  });

  // ============ 主题 ============
  function applyTheme() {
    const t = Storage.loadSettings().theme || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const s = Storage.loadSettings();
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    Storage.saveSettings(s);
    applyTheme();
  }

  // ============ 首页：智能体列表 ============
  function renderHome() {
    const agents = Storage.loadAgents();
    const html = `
      <header class="appbar">
        <div class="brand">
          <span class="logo">🤖</span>
          <div>
            <h1>智能体管家</h1>
            <p class="sub">AgentForge</p>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" id="btn-theme" title="切换主题">🌓</button>
          <button class="icon-btn" id="btn-settings" title="全局设置">⚙️</button>
        </div>
      </header>

      <section class="hero">
        <p>在手机上自由创建、删除、配置你的 AI 智能体。</p>
        <p class="muted">支持本地模型 · 支持 QQ 接入</p>
      </section>

      <div class="toolbar">
        <button class="btn primary" id="btn-new">＋ 新建智能体</button>
        <button class="btn ghost" id="btn-import">📥 导入备份</button>
        <button class="btn ghost" id="btn-export">📤 导出备份</button>
      </div>

      <main id="agent-list" class="grid"></main>
      <input type="file" id="import-file" accept="application/json" hidden>
    `;
    document.getElementById('app').innerHTML = html;

    renderAgentList(agents);
    bindHomeEvents();
  }

  function renderAgentList(agents) {
    const el = document.getElementById('agent-list');
    if (!agents.length) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-emoji">🐾</div>
          <p>还没有智能体，点上方按钮创建一个吧</p>
          <button class="btn primary" id="btn-new-2">＋ 创建第一个智能体</button>
        </div>`;
      document.getElementById('btn-new-2')?.addEventListener('click', newAgent);
      return;
    }
    el.innerHTML = agents.map(a => `
      <div class="card agent-card" data-id="${a.id}">
        <div class="card-head">
          <span class="avatar">${escapeHtml(a.avatar || '🤖')}</span>
          <div class="card-title">
            <h3>${escapeHtml(a.name)}</h3>
            <span class="status ${a.qq?.enabled ? 'on' : 'off'}">
              ${a.qq?.enabled ? '📨 QQ在线' : '💤 离线'}
            </span>
          </div>
        </div>
        <p class="card-summary">${escapeHtml(a.summary || a.systemPrompt?.slice(0, 40) || '暂无设定')}</p>
        <div class="tags">
          ${(a.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          <span class="tag model">${escapeHtml(providerLabel(a.model?.provider))}</span>
        </div>
        <div class="card-actions">
          <button class="btn small" data-act="chat">💬 聊天</button>
          <button class="btn small ghost" data-act="edit">✎ 编辑</button>
          ${a.qq?.enabled ? `<button class="btn small ghost" data-act="qq" title="发到QQ">📨 QQ</button>` : ''}
          <button class="btn small danger" data-act="delete">🗑</button>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.agent-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const act = btn.dataset.act;
          if (act === 'chat') navigate('#/agent/' + id);
          if (act === 'edit') navigate('#/edit/' + id);
          if (act === 'qq') sendAgentToQQ(id);
          if (act === 'delete') confirmDelete(id);
        });
      });
    });
  }

  function bindHomeEvents() {
    document.getElementById('btn-new')?.addEventListener('click', newAgent);
    document.getElementById('btn-settings')?.addEventListener('click', () => navigate('#/settings'));
    document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-export')?.addEventListener('click', exportBackup);
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file')?.addEventListener('change', importBackup);
  }

  function newAgent() {
    const a = Storage.createAgent({
      name: '新智能体',
      avatar: pickEmoji(),
      summary: '一个全新的 AI 智能体',
      systemPrompt: '你是我的专属智能体，请友善、有帮助地回答问题。',
      greeting: '你好！我是你的新智能体，有什么可以帮你的吗？',
    });
    navigate('#/edit/' + a.id);
  }

  function confirmDelete(id) {
    const a = Storage.getAgent(id);
    if (!a) return;
    if (confirm(`确定要删除智能体「${a.name}」吗？此操作不可撤销。`)) {
      Storage.deleteAgent(id);
      renderHome();
    }
  }

  function sendAgentToQQ(id) {
    const a = Storage.getAgent(id);
    if (!a?.qq?.enabled) { alert('请先在编辑页启用并配置 QQ 接入'); return; }
    promptSendQQ(a);
  }

  function promptSendQQ(agent) {
    const text = prompt('输入要发送到 QQ 的内容：');
    if (!text) return;
    QQ.sendMessage(agent, text).then(r => alert(r)).catch(e => alert(e.message));
  }

  function exportBackup() {
    const json = Storage.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agentforge-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Storage.importAll(reader.result);
        alert('导入成功！');
        renderHome();
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ============ 聊天页 ============
  let chatState = { streaming: false };

  function renderChat(query) {
    const id = query;
    let agent = Storage.getAgent(id);
    if (!agent) { navigate('#/'); return; }

    const html = `
      <header class="appbar">
        <button class="icon-btn" id="btn-back">‹</button>
        <div class="brand small">
          <span class="avatar sm">${escapeHtml(agent.avatar || '🤖')}</span>
          <div>
            <h1>${escapeHtml(agent.name)}</h1>
            <p class="sub">${escapeHtml(providerLabel(agent.model?.provider))} · ${escapeHtml(agent.model?.modelName || '')}</p>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" id="btn-edit" title="编辑">✎</button>
          <button class="icon-btn" id="btn-clear" title="清空对话">🧹</button>
        </div>
      </header>
      <main id="chat-log" class="chat-log"></main>
      <footer class="composer">
        <textarea id="composer-input" rows="1" placeholder="给 ${escapeHtml(agent.name)} 发消息…"></textarea>
        <button class="btn primary" id="btn-send">发送</button>
      </footer>
    `;
    document.getElementById('app').innerHTML = html;

    const logEl = document.getElementById('chat-log');
    renderMessages(logEl, agent);

    // 自动开场白
    if (!agent.messages || !agent.messages.length) {
      if (agent.greeting) {
        Storage.appendMessage(agent.id, { role: 'assistant', content: agent.greeting, time: Date.now() });
        agent = Storage.getAgent(id);
        renderMessages(logEl, agent);
      }
    }

    bindChatEvents(agent, logEl);
  }

  function renderMessages(logEl, agent) {
    const msgs = agent.messages || [];
    logEl.innerHTML = msgs.map(m => `
      <div class="msg ${m.role === 'user' ? 'user' : 'bot'}">
        <div class="msg-bubble">
          ${m.role === 'assistant' ? `<div class="msg-name">${escapeHtml(agent.avatar || '🤖')} ${escapeHtml(agent.name)}</div>` : ''}
          <div class="msg-text">${renderContent(m.content)}</div>
        </div>
      </div>
    `).join('');
    scrollBottom(logEl);
  }

  function bindChatEvents(agent, logEl) {
    const input = document.getElementById('composer-input');
    const sendBtn = document.getElementById('btn-send');
    document.getElementById('btn-back').addEventListener('click', () => navigate('#/'));
    document.getElementById('btn-edit').addEventListener('click', () => navigate('#/edit/' + agent.id));
    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('清空该智能体的全部对话？')) {
        Storage.clearMessages(agent.id);
        renderChat(agent.id);
      }
    });

    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(agent, logEl, input); }
    });
    sendBtn.addEventListener('click', () => send(agent, logEl, input));
  }

  async function send(agent, logEl, input) {
    if (chatState.streaming) return;
    const text = input.value.trim();
    if (!text) return;

    // 检查模型配置
    if (!agent.model?.modelName) { alert('请先到编辑页配置模型'); return; }
    if (!agent.model?.apiKey && agent.model?.provider !== 'ollama') {
      alert('请先到编辑页填写 API Key');
      return;
    }

    Storage.appendMessage(agent.id, { role: 'user', content: text, time: Date.now() });
    input.value = ''; input.style.height = 'auto';
    agent = Storage.getAgent(agent.id);
    renderMessages(logEl, agent);

    // 创建占位气泡用于流式更新
    const placeholder = appendStreamingBubble(logEl, agent);
    chatState.streaming = true;
    setSending(true);

    try {
      if (agent.model?.stream) {
        let acc = '';
        await LLM.chatStream(agent, agent.messages.slice(0, -1), delta => {
          acc += delta;
          placeholder.innerHTML = renderContent(acc) + '<span class="cursor">▍</span>';
          scrollBottom(logEl);
        }, full => {
          Storage.appendMessage(agent.id, { role: 'assistant', content: full, time: Date.now() });
        });
      } else {
        const full = await LLM.chat(agent, agent.messages.slice(0, -1));
        Storage.appendMessage(agent.id, { role: 'assistant', content: full, time: Date.now() });
      }
      agent = Storage.getAgent(agent.id);
      renderMessages(logEl, agent);
    } catch (e) {
      placeholder.innerHTML = `<em class="err">⚠️ ${escapeHtml(e.message)}</em>`;
    } finally {
      chatState.streaming = false;
      setSending(false);
    }
  }

  function appendStreamingBubble(logEl, agent) {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    wrap.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-name">${escapeHtml(agent.avatar || '🤖')} ${escapeHtml(agent.name)}</div>
        <div class="msg-text"></div>
      </div>`;
    logEl.appendChild(wrap);
    scrollBottom(logEl);
    return wrap.querySelector('.msg-text');
  }

  function setSending(on) {
    const btn = document.getElementById('btn-send');
    if (btn) btn.disabled = on;
  }
  function scrollBottom(el) { requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); }

  // ============ 编辑器 ============
  function renderEditor(query) {
    const id = query;
    let agent = Storage.getAgent(id);
    if (!agent) { navigate('#/'); return; }

    const preset = LLM.getPreset(agent.model?.provider);
    const html = `
      <header class="appbar">
        <button class="icon-btn" id="btn-back">‹</button>
        <div class="brand small">
          <span class="avatar sm">${escapeHtml(agent.avatar || '🤖')}</span>
          <div><h1>编辑智能体</h1><p class="sub">${escapeHtml(agent.name)}</p></div>
        </div>
        <div class="actions">
          <button class="btn primary small" id="btn-save">保存</button>
        </div>
      </header>

      <nav class="tabs">
        <button class="tab active" data-tab="basic">基本</button>
        <button class="tab" data-tab="model">模型</button>
        <button class="tab" data-tab="qq">QQ</button>
        <button class="tab" data-tab="advanced">高级</button>
      </nav>

      <!-- 基本 -->
      <section class="tab-panel" data-panel="basic">
        <div class="field">
          <label>名称</label>
          <input type="text" id="f-name" value="${escapeAttr(agent.name)}">
        </div>
        <div class="field">
          <label>头像（Emoji 或文字）</label>
          <input type="text" id="f-avatar" value="${escapeAttr(agent.avatar || '🤖')}" maxlength="4">
          <div class="emoji-row" id="emoji-row"></div>
        </div>
        <div class="field">
          <label>一句话简介</label>
          <input type="text" id="f-summary" value="${escapeAttr(agent.summary || '')}">
        </div>
        <div class="field">
          <label>智能体设定 / 系统提示词（System Prompt）</label>
          <textarea id="f-prompt" rows="8" placeholder="例如：你是小夜，一只巧克力味的小狼，温柔又有点玻璃心…">${escapeText(agent.systemPrompt || '')}</textarea>
        </div>
        <div class="field">
          <label>开场白</label>
          <input type="text" id="f-greeting" value="${escapeAttr(agent.greeting || '')}">
        </div>
        <div class="field">
          <label>标签（逗号分隔）</label>
          <input type="text" id="f-tags" value="${escapeAttr((agent.tags || []).join(', '))}">
        </div>
      </section>

      <!-- 模型 -->
      <section class="tab-panel hidden" data-panel="model">
        <div class="field">
          <label>模型服务商</label>
          <select id="f-provider">
            <option value="openai" ${agent.model.provider === 'openai' ? 'selected' : ''}>OpenAI 兼容（API）</option>
            <option value="deepseek" ${agent.model.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
            <option value="kimi" ${agent.model.provider === 'kimi' ? 'selected' : ''}>Kimi / Moonshot</option>
            <option value="ollama" ${agent.model.provider === 'ollama' ? 'selected' : ''}>本地模型（Ollama / llama.cpp）</option>
            <option value="custom" ${agent.model.provider === 'custom' ? 'selected' : ''}>自定义端点</option>
          </select>
        </div>
        <div class="field">
          <label>API 地址（Base URL）</label>
          <input type="text" id="f-baseurl" value="${escapeAttr(agent.model.baseUrl || preset.baseUrl)}" placeholder="https://api.example.com/v1">
        </div>
        <div class="field">
          <label>API Key ${agent.model.provider === 'ollama' ? '（本地模型可留空）' : ''}</label>
          <input type="password" id="f-apikey" value="${escapeAttr(agent.model.apiKey || '')}" placeholder="sk-...">
        </div>
        <div class="field">
          <label>模型名称</label>
          <input type="text" id="f-modelname" value="${escapeAttr(agent.model.modelName || preset.modelName)}" placeholder="gpt-4o-mini">
        </div>
        <div class="field-row">
          <div class="field">
            <label>温度 Temperature：<span id="lbl-temp">${agent.model.temperature}</span></label>
            <input type="range" id="f-temp" min="0" max="2" step="0.05" value="${agent.model.temperature}">
          </div>
          <div class="field">
            <label>最大长度 Max Tokens</label>
            <input type="number" id="f-maxtokens" value="${agent.model.maxTokens}" min="1" max="32000">
          </div>
        </div>
        <div class="field">
          <label>Top P</label>
          <input type="number" id="f-topp" value="${agent.model.topP}" min="0" max="1" step="0.05">
        </div>
        <label class="check">
          <input type="checkbox" id="f-stream" ${agent.model.stream ? 'checked' : ''}> 启用流式输出（Streaming）
        </label>
        <button class="btn ghost" id="btn-test-llm">🔌 测试连接</button>
      </section>

      <!-- QQ -->
      <section class="tab-panel hidden" data-panel="qq">
        <label class="check">
          <input type="checkbox" id="f-qq-enable" ${agent.qq?.enabled ? 'checked' : ''}> 启用 QQ 接入
        </label>
        <div class="field">
          <label>中继服务地址（Relay URL）</label>
          <input type="text" id="f-qq-url" value="${escapeAttr(agent.qq?.relayUrl || '')}" placeholder="http://你的服务器:3000">
        </div>
        <div class="field">
          <label>中继 Token（可选）</label>
          <input type="password" id="f-qq-token" value="${escapeAttr(agent.qq?.relayToken || '')}">
        </div>
        <div class="field">
          <label>默认目标群 / 好友 ID</label>
          <input type="text" id="f-qq-target" value="${escapeAttr(agent.qq?.targetId || '')}" placeholder="QQ 群号 或 好友 QQ 号">
        </div>
        <div class="field">
          <label>目标类型</label>
          <select id="f-qq-type">
            <option value="group" ${agent.qq?.targetType === 'group' ? 'selected' : ''}>群聊</option>
            <option value="private" ${agent.qq?.targetType === 'private' ? 'selected' : ''}>私聊</option>
          </select>
        </div>
        <p class="hint">QQ 接入需要一个运行中的「中继服务」把消息转给 QQ 机器人（如 go-cqhttp / OneBot）。仓库内 <code>qq-relay/</code> 提供了开箱即用的 Node 中继示例。</p>
        <button class="btn ghost" id="btn-test-qq">🔌 测试中继连接</button>
      </section>

      <!-- 高级 -->
      <section class="tab-panel hidden" data-panel="advanced">
        <label class="check">
          <input type="checkbox" id="f-markdown" ${Storage.loadSettings().markdown ? 'checked' : ''}> 渲染 Markdown 回复
        </label>
        <label class="check">
          <input type="checkbox" id="f-savehist" ${Storage.loadSettings().saveHistory ? 'checked' : ''}> 保存对话历史
        </label>
        <div class="danger-zone">
          <h4>危险区</h4>
          <button class="btn danger small" id="btn-clear-msg">清空该智能体对话</button>
          <button class="btn danger small" id="btn-delete-agent">删除智能体</button>
        </div>
      </section>
    `;
    document.getElementById('app').innerHTML = html;

    bindEditorEvents(agent);
  }

  function bindEditorEvents(agent) {
    document.getElementById('btn-back').addEventListener('click', () => navigate('#/agent/' + agent.id));
    document.getElementById('btn-save').addEventListener('click', () => saveEditor(agent));

    // 服务商切换 -> 自动填默认值
    document.getElementById('f-provider').addEventListener('change', e => {
      const p = e.target.value;
      const preset = LLM.getPreset(p);
      document.getElementById('f-baseurl').value = preset.baseUrl;
      document.getElementById('f-modelname').value = preset.modelName;
      if (p === 'ollama') document.getElementById('f-apikey').placeholder = '本地模型可留空';
      else document.getElementById('f-apikey').placeholder = 'sk-...';
    });

    // 温度滑块
    document.getElementById('f-temp').addEventListener('input', e => {
      document.getElementById('lbl-temp').textContent = e.target.value;
    });

    // Emoji 快捷选择
    const row = document.getElementById('emoji-row');
    const emojis = ['🤖', '🐺', '🦊', '🐱', '🐶', '🐰', '🐼', '🦉', '🐧', '🌟', '🎮', '💻', '🎨', '📚', '🎵', '🍫'];
    row.innerHTML = emojis.map(e => `<button type="button" class="emoji-chip" data-e="${e}">${e}</button>`).join('');
    row.querySelectorAll('.emoji-chip').forEach(c => {
      c.addEventListener('click', () => { document.getElementById('f-avatar').value = c.dataset.e; });
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panel = tab.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => {
          p.classList.toggle('hidden', p.dataset.panel !== panel);
        });
      });
    });

    // 测试按钮
    document.getElementById('btn-test-llm').addEventListener('click', async () => {
      const draft = readEditor(agent);
      const btn = document.getElementById('btn-test-llm');
      btn.disabled = true; btn.textContent = '测试中…';
      try { const r = await LLM.testConnection(draft); alert(r); }
      catch (e) { alert(e.message); }
      finally { btn.disabled = false; btn.textContent = '🔌 测试连接'; }
    });
    document.getElementById('btn-test-qq').addEventListener('click', async () => {
      const draft = readEditor(agent);
      const btn = document.getElementById('btn-test-qq');
      btn.disabled = true; btn.textContent = '测试中…';
      try { const r = await QQ.testRelay(draft); alert(r); }
      catch (e) { alert(e.message); }
      finally { btn.disabled = false; btn.textContent = '🔌 测试中继连接'; }
    });

    // 高级操作
    document.getElementById('btn-clear-msg').addEventListener('click', () => {
      if (confirm('清空该智能体全部对话？')) { Storage.clearMessages(agent.id); alert('已清空'); }
    });
    document.getElementById('btn-delete-agent').addEventListener('click', () => {
      if (confirm(`确定删除「${agent.name}」？`)) { Storage.deleteAgent(agent.id); navigate('#/'); }
    });
  }

  function readEditor(agent) {
    const tagsRaw = document.getElementById('f-tags').value;
    const tags = tagsRaw.split(/[，,]/).map(s => s.trim()).filter(Boolean);
    const settings = Storage.loadSettings();
    settings.markdown = document.getElementById('f-markdown').checked;
    settings.saveHistory = document.getElementById('f-savehist').checked;
    Storage.saveSettings(settings);

    return Object.assign({}, agent, {
      name: document.getElementById('f-name').value.trim() || '未命名',
      avatar: document.getElementById('f-avatar').value.trim() || '🤖',
      summary: document.getElementById('f-summary').value.trim(),
      systemPrompt: document.getElementById('f-prompt').value,
      greeting: document.getElementById('f-greeting').value.trim(),
      tags,
      model: {
        provider: document.getElementById('f-provider').value,
        baseUrl: document.getElementById('f-baseurl').value.trim(),
        apiKey: document.getElementById('f-apikey').value.trim(),
        modelName: document.getElementById('f-modelname').value.trim(),
        temperature: parseFloat(document.getElementById('f-temp').value),
        maxTokens: parseInt(document.getElementById('f-maxtokens').value) || 1024,
        topP: parseFloat(document.getElementById('f-topp').value) || 1,
        stream: document.getElementById('f-stream').checked,
      },
      qq: {
        enabled: document.getElementById('f-qq-enable').checked,
        relayUrl: document.getElementById('f-qq-url').value.trim(),
        relayToken: document.getElementById('f-qq-token').value.trim(),
        targetId: document.getElementById('f-qq-target').value.trim(),
        targetType: document.getElementById('f-qq-type').value,
      },
    });
  }

  function saveEditor(agent) {
    const draft = readEditor(agent);
    Storage.updateAgent(agent.id, draft);
    alert('已保存 ✓');
    navigate('#/agent/' + agent.id);
  }

  // ============ 全局设置 ============
  function renderSettings() {
    const s = Storage.loadSettings();
    const html = `
      <header class="appbar">
        <button class="icon-btn" id="btn-back">‹</button>
        <div class="brand small"><div><h1>全局设置</h1><p class="sub">主题 / 备份 / 数据</p></div></div>
      </header>
      <section class="panel">
        <div class="field">
          <label>默认主题</label>
          <select id="set-theme">
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>暗色</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>亮色</option>
          </select>
        </div>
        <label class="check">
          <input type="checkbox" id="set-stream" ${s.defaultStream ? 'checked' : ''}> 新智能体默认启用流式输出
        </label>
        <div class="field-row" style="margin-top:16px">
          <button class="btn" id="set-export">📤 导出全部数据</button>
          <button class="btn ghost" id="set-import">📥 导入备份</button>
        </div>
        <button class="btn danger" id="set-clear" style="margin-top:16px">⚠️ 清空全部数据</button>
        <p class="hint">本项目为开源免费软件 · MIT License<br>源码 & 构建见 <a href="https://github.com/" target="_blank">GitHub</a></p>
      </section>
      <input type="file" id="import-file" accept="application/json" hidden>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('btn-back').addEventListener('click', () => navigate('#/'));
    document.getElementById('set-theme').addEventListener('change', e => {
      s.theme = e.target.value; Storage.saveSettings(s); applyTheme();
    });
    document.getElementById('set-stream').addEventListener('change', e => {
      s.defaultStream = e.target.checked; Storage.saveSettings(s);
    });
    document.getElementById('set-export').addEventListener('click', exportBackup);
    document.getElementById('set-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importBackup);
    document.getElementById('set-clear').addEventListener('click', () => {
      if (confirm('确定清空全部智能体与对话？此操作不可撤销！')) {
        Storage.clearAll(); alert('已清空'); renderHome();
      }
    });
  }

  // ============ 工具函数 ============
  function providerLabel(p) {
    return ({ openai: 'OpenAI', deepseek: 'DeepSeek', kimi: 'Kimi', ollama: '本地模型', custom: '自定义' })[p] || '未配置';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeText(s) { return escapeHtml(s); }
  function escapeAttr(s) { return escapeHtml(s); }
  function renderContent(text) {
    const settings = Storage.loadSettings();
    if (settings.markdown) return markedLite(text);
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
  function pickEmoji() {
    const list = ['🤖', '🐺', '🦊', '🐱', '🐶', '🐰', '🐼', '🦉'];
    return list[Math.floor(Math.random() * list.length)];
  }

  /** 极简 Markdown 渲染（避免引入重依赖，PWA 离线可用） */
  function markedLite(text) {
    let s = escapeHtml(text);
    s = s.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    s = s.replace(/\n{2,}/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');
    return '<p>' + s + '</p>';
  }

  // 暴露给全局（供内联调用）
  window.AgentForge = { navigate, renderHome, providerLabel };
})();
