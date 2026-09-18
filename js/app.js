/**
 * app.js —— 智能体管家 主逻辑
 * 路由 / 智能体列表 / 编辑器 / 聊天 / QQ 接入 / 全局设置
 * UI 全部采用 Material Design 3（见 js/ui.js）
 */
(function () {
  'use strict';

  const U = window.UI;

  // ============ 路由 ============
  const routes = {
    '#/': renderHome,
    '#/agent/': renderChat,
    '#/edit/': renderEditor,
    '#/new': renderNewAgent,
    '#/settings': renderSettings,
  };

  function navigate(hash) { location.hash = hash; }
  function router() {
    const hash = location.hash || '#/';
    const [path, query] = hash.split('?');
    // 1) 精确匹配
    let handler = routes[path];
    let param = query || '';
    // 2) 带参数的动态路由：#/agent/:id  #/edit/:id
    if (!handler) {
      const slashIdx = path.lastIndexOf('/');
      const prefix = slashIdx > 0 ? path.slice(0, slashIdx + 1) : '';
      const matched = Object.keys(routes).find(k => k.endsWith('/') && prefix === k);
      if (matched) { handler = routes[matched]; param = path.slice(matched.length) || query || ''; }
    }
    (handler || renderHome)(param);
  }
  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', () => { applyTheme(); router(); });

  // ============ 主题 ============
  function applyTheme() {
    const t = Storage.loadSettings().theme || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#181a21' : '#fbf8ff';
  }
  function toggleTheme() {
    const s = Storage.loadSettings();
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    Storage.saveSettings(s); applyTheme();
  }

  // ============ 首页：智能体列表 ============
  function renderHome() {
    const agents = Storage.loadAgents();
    const M = U.materialIcon;

    let body = `
      <section class="md-hero">
        <p class="md-body-lg">在手机上自由创建、删除、配置你的 AI 智能体。</p>
        <p>Material You · 支持本地模型 · 支持 QQ 接入</p>
      </section>

      <div class="md-toolbar">
        <button class="md-btn md-btn--outlined md-btn--sm" id="btn-import">
          ${M('download')}<span>导入备份</span>
        </button>
        <button class="md-btn md-btn--outlined md-btn--sm" id="btn-export">
          ${M('upload')}<span>导出备份</span>
        </button>
      </div>

      <div class="md-grid" id="agent-list"></div>
      <input type="file" id="import-file" accept="application/json" hidden>
    `;

    const frag = U.page({
      title: '智能体管家', sub: 'AgentForge · 管理你的 AI 智能体',
      large: true,
      actions: [
        { icon: 'contrast', title: '切换主题', onClick: toggleTheme, id: 'btn-theme' },
        { icon: 'settings', title: '全局设置', onClick: () => navigate('#/settings'), id: 'btn-settings' },
      ],
      body,
    });
    U.render(frag);
    U.fab('add', () => navigate('#/new'), '新建智能体');

    renderAgentList(agents);
    bindHomeEvents();
  }

  function renderAgentList(agents) {
    const el = document.getElementById('agent-list');
    const M = U.materialIcon;
    if (!agents.length) {
      el.innerHTML = `
        <div class="md-empty" style="grid-column:1/-1">
          <div class="md-empty__ico">${M('smart_toy', true)}</div>
          <h3>还没有智能体</h3>
          <p>点击下方按钮，创建你的第一个 AI 智能体吧</p>
          <button class="md-btn md-btn--filled" id="btn-new-2">
            ${M('add')}<span>创建第一个智能体</span>
          </button>
        </div>`;
      document.getElementById('btn-new-2')?.addEventListener('click', () => navigate('#/new'));
      return;
    }

    el.innerHTML = agents.map(a => {
      const status = a.qq?.enabled
        ? '<span class="md-badge md-badge--on"><span class="md-dot"></span>QQ 在线</span>'
        : '<span class="md-badge md-badge--off"><span class="md-dot"></span>离线</span>';
      return `
        <article class="md-card md-card--elevated agent-card" data-id="${a.id}">
          <header class="agent-card__head">
            <span class="md-avatar">${escapeHtml(a.avatar || '🤖')}</span>
            <div class="agent-card__body">
              <h3 class="agent-card__title">${escapeHtml(a.name)}</h3>
              <p class="agent-card__sub">${status} <span>·</span> ${escapeHtml(providerLabel(a.model?.provider))}</p>
            </div>
            ${M('more_vert')}
          </header>

          <p class="agent-card__summary">${escapeHtml(a.summary || a.systemPrompt?.slice(0, 40) || '暂无设定')}</p>

          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(a.tags || []).slice(0, 3).map(t => `<span class="md-chip">${escapeHtml(t)}</span>`).join('')}
          </div>

          <footer class="agent-card__foot">
            <button class="md-btn md-btn--filled md-btn--sm" data-act="chat">
              ${M('chat')}<span>聊天</span>
            </button>
            <button class="md-btn md-btn--tonal md-btn--sm" data-act="edit">
              ${M('edit')}<span>编辑</span>
            </button>
            ${a.qq?.enabled ? `<button class="md-btn md-btn--outlined md-btn--sm" data-act="qq">${M('send')}<span>发到 QQ</span></button>` : ''}
          </footer>
        </article>`;
    }).join('');

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
      // 点击卡片其他区域 → 进入聊天
      card.addEventListener('click', e => { if (!e.target.closest('[data-act]')) navigate('#/agent/' + id); });
    });
  }

  function bindHomeEvents() {
    document.getElementById('btn-settings')?.addEventListener('click', () => navigate('#/settings'));
    document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-export')?.addEventListener('click', exportBackup);
    document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file')?.addEventListener('change', importBackup);
  }

  // ============ 新建智能体 ============
  function renderNewAgent() {
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
    U.confirm('删除智能体', `确定要删除「${a.name}」吗？此操作不可撤销。`, '删除', '取消', true)
      .then(ok => { if (ok) { Storage.deleteAgent(id); renderHome(); U.snackbar('已删除'); } });
  }

  function sendAgentToQQ(id) {
    const a = Storage.getAgent(id);
    if (!a?.qq?.enabled) { U.snackbar('请先在编辑页启用并配置 QQ 接入'); return; }
    promptSendQQ(a);
  }

  function promptSendQQ(agent) {
    const text = prompt('输入要发送到 QQ 的内容：');
    if (!text) return;
    QQ.sendMessage(agent, text).then(r => U.snackbar(r)).catch(e => U.snackbar(e.message, { action: '关闭' }));
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
    U.snackbar('已导出备份');
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { Storage.importAll(reader.result); U.snackbar('导入成功'); renderHome(); }
      catch (err) { U.snackbar('导入失败：' + err.message, { action: '关闭' }); }
    };
    reader.readAsText(file);
  }

  // ============ 聊天页 ============
  let chatState = { streaming: false };

  function renderChat(query) {
    const id = query;
    let agent = Storage.getAgent(id);
    if (!agent) { navigate('#/'); return; }
    const M = U.materialIcon;

    const body = `
      <div class="md-chat" id="chat-log"></div>
      <footer class="md-composer">
        <textarea class="md-composer__input" id="composer-input" rows="1" placeholder="给 ${escapeAttr(agent.name)} 发消息…"></textarea>
        <button class="md-composer__send" id="btn-send" title="发送" aria-label="发送">${M('send')}</button>
      </footer>`;

    const frag = U.page({
      title: agent.name, sub: `${providerLabel(agent.model?.provider)} · ${escapeHtml(agent.model?.modelName || '')}`,
      back: false,
      actions: [
        { icon: 'arrow_back', title: '返回', onClick: () => navigate('#/') },
        { icon: 'edit', title: '编辑', onClick: () => navigate('#/edit/' + agent.id) },
        { icon: 'delete_sweep', title: '清空对话', onClick: clearMessages },
      ],
      body,
    });
    U.render(frag);

    const logEl = document.getElementById('chat-log');
    renderMessages(logEl, agent);

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
    const M = U.materialIcon;
    const msgs = agent.messages || [];
    if (!msgs.length) {
      logEl.innerHTML = `
        <div class="md-empty" style="margin:auto">
          <div class="md-empty__ico">${M('chat_bubble_outline')}</div>
          <h3>开始对话</h3>
          <p>给 ${escapeHtml(agent.name)} 发一条消息试试</p>
        </div>`;
      return;
    }
    logEl.innerHTML = msgs.map(m => `
      <div class="md-msg ${m.role === 'user' ? 'md-msg--user' : 'md-msg--bot'}">
        ${m.role === 'assistant' ? `<span class="md-avatar md-avatar--sm">${escapeHtml(agent.avatar || '🤖')}</span>` : ''}
        <div class="md-msg__bubble">
          ${m.role === 'assistant' ? `<div class="md-msg__name">${escapeHtml(agent.name)}</div>` : ''}
          <div class="md-msg__text">${renderContent(m.content)}</div>
        </div>
      </div>`).join('');
    scrollBottom(logEl);
  }

  function bindChatEvents(agent, logEl) {
    const input = document.getElementById('composer-input');
    const sendBtn = document.getElementById('btn-send');

    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(agent, logEl, input); } });
    sendBtn.addEventListener('click', () => send(agent, logEl, input));
  }

  async function send(agent, logEl, input) {
    if (chatState.streaming) return;
    const text = input.value.trim();
    if (!text) return;

    if (!agent.model?.modelName) { U.snackbar('请先到编辑页配置模型'); return; }
    if (!agent.model?.apiKey && agent.model?.provider !== 'ollama') { U.snackbar('请先到编辑页填写 API Key'); return; }

    Storage.appendMessage(agent.id, { role: 'user', content: text, time: Date.now() });
    input.value = ''; input.style.height = 'auto';
    agent = Storage.getAgent(agent.id);
    renderMessages(logEl, agent);

    const placeholder = appendStreamingBubble(logEl, agent);
    chatState.streaming = true; setSending(true);
    showTyping(logEl, true);

    try {
      if (agent.model?.stream) {
        let acc = '';
        await LLM.chatStream(agent, agent.messages.slice(0, -1), delta => {
          acc += delta;
          placeholder.innerHTML = renderContent(acc) + '<span class="md-msg__cursor">▍</span>';
          scrollBottom(logEl);
        }, full => { Storage.appendMessage(agent.id, { role: 'assistant', content: full, time: Date.now() }); });
      } else {
        const full = await LLM.chat(agent, agent.messages.slice(0, -1));
        Storage.appendMessage(agent.id, { role: 'assistant', content: full, time: Date.now() });
      }
      agent = Storage.getAgent(agent.id);
      renderMessages(logEl, agent);
    } catch (e) {
      placeholder.innerHTML = `<span class="md-msg__error">⚠️ ${escapeHtml(e.message)}</span>`;
    } finally {
      chatState.streaming = false; setSending(false); showTyping(logEl, false);
    }
  }

  function appendStreamingBubble(logEl, agent) {
    const wrap = document.createElement('div');
    wrap.className = 'md-msg md-msg--bot';
    wrap.innerHTML = `<span class="md-avatar md-avatar--sm">${escapeHtml(agent.avatar || '🤖')}</span>
      <div class="md-msg__bubble"><div class="md-msg__name">${escapeHtml(agent.name)}</div><div class="md-msg__text"></div></div>`;
    logEl.appendChild(wrap); scrollBottom(logEl);
    return wrap.querySelector('.md-msg__text');
  }

  function showTyping(logEl, on) {
    let el = logEl.querySelector('.md-typing');
    if (on && !el) {
      el = document.createElement('div'); el.className = 'md-msg md-msg--bot md-typing';
      el.innerHTML = `<span class="md-avatar md-avatar--sm"></span><div class="md-msg__bubble"><span class="md-typing"><span></span><span></span><span></span></span></div>`;
      logEl.appendChild(el); scrollBottom(logEl);
    } else if (!on && el) el.remove();
  }

  function setSending(on) {
    const btn = document.getElementById('btn-send');
    if (btn) btn.disabled = on;
  }
  function scrollBottom(el) { requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); }

  function clearMessages() {
    // 从当前渲染的 agent id 反推
    const hash = location.hash || '';
    const id = hash.replace('#/agent/', '');
    U.confirm('清空对话', '确定清空该智能体的全部对话？', '清空', '取消', true)
      .then(ok => { if (ok) { Storage.clearMessages(id); renderChat(id); } });
  }

  // ============ 编辑器 ============
  function renderEditor(query) {
    const id = query;
    let agent = Storage.getAgent(id);
    if (!agent) { navigate('#/'); return; }
    const M = U.materialIcon;
    const tabs = [
      { key: 'basic', icon: 'tune', label: '基本' },
      { key: 'model', icon: 'model_training', label: '模型' },
      { key: 'qq', icon: 'chat', label: 'QQ' },
      { key: 'advanced', icon: 'settings', label: '高级' },
    ];

    const body = `
      <nav class="md-tabs" id="tabs">
        ${tabs.map(t => `<button class="md-tab ${t.key === 'basic' ? 'md-tab--active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
      </nav>

      <section class="md-tab-panel ${'md-tab-panel--active'} md-surface" data-panel="basic">
        <div class="md-field">
          <label>名称</label>
          <input class="md-textfield" type="text" id="f-name" value="${escapeAttr(agent.name)}">
        </div>
        <div class="md-field">
          <label>头像（Emoji 或文字）</label>
          <input class="md-textfield" type="text" id="f-avatar" value="${escapeAttr(agent.avatar || '🤖')}" maxlength="4">
          <div class="md-emoji-grid" id="emoji-grid"></div>
        </div>
        <div class="md-field">
          <label>一句话简介</label>
          <input class="md-textfield" type="text" id="f-summary" value="${escapeAttr(agent.summary || '')}">
        </div>
        <div class="md-field">
          <label>智能体设定 / 系统提示词（System Prompt）</label>
          <textarea class="md-textfield" id="f-prompt" rows="8" placeholder="例如：你是小夜，一只巧克力味的小狼…">${escapeText(agent.systemPrompt || '')}</textarea>
        </div>
        <div class="md-field">
          <label>开场白</label>
          <input class="md-textfield" type="text" id="f-greeting" value="${escapeAttr(agent.greeting || '')}">
        </div>
        <div class="md-field">
          <label>标签（逗号分隔）</label>
          <input class="md-textfield" type="text" id="f-tags" value="${escapeAttr((agent.tags || []).join(', '))}">
        </div>
      </section>

      <section class="md-tab-panel md-surface" data-panel="model">
        <div class="md-field">
          <label>模型服务商</label>
          <select class="md-select" id="f-provider">
            <option value="openai" ${agent.model.provider === 'openai' ? 'selected' : ''}>OpenAI 兼容（API）</option>
            <option value="deepseek" ${agent.model.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
            <option value="kimi" ${agent.model.provider === 'kimi' ? 'selected' : ''}>Kimi / Moonshot</option>
            <option value="ollama" ${agent.model.provider === 'ollama' ? 'selected' : ''}>本地模型（Ollama / llama.cpp）</option>
            <option value="custom" ${agent.model.provider === 'custom' ? 'selected' : ''}>自定义端点</option>
          </select>
        </div>
        <div class="md-field">
          <label>API 地址（Base URL）</label>
          <input class="md-textfield" type="text" id="f-baseurl" value="${escapeAttr(agent.model.baseUrl || '')}" placeholder="https://api.example.com/v1">
        </div>
        <div class="md-field">
          <label>API Key <span class="md-helper" style="display:inline">${agent.model.provider === 'ollama' ? '· 本地模型可留空' : ''}</span></label>
          <input class="md-textfield" type="password" id="f-apikey" value="${escapeAttr(agent.model.apiKey || '')}" placeholder="sk-...">
        </div>
        <div class="md-field">
          <label>模型名称</label>
          <input class="md-textfield" type="text" id="f-modelname" value="${escapeAttr(agent.model.modelName || '')}" placeholder="gpt-4o-mini">
        </div>
        <div class="md-field-row">
          <div class="md-field">
            <label id="lbl-temp">温度 Temperature：<span>${agent.model.temperature}</span></label>
            ${U.sliderHTML('f-temp', agent.model.temperature, 0, 2, 0.05, 'lbl-temp')}
          </div>
          <div class="md-field">
            <label>最大长度 Max Tokens</label>
            <input class="md-textfield" type="number" id="f-maxtokens" value="${agent.model.maxTokens}" min="1" max="32000">
          </div>
        </div>
        <div class="md-field">
          <label>Top P</label>
          <input class="md-textfield" type="number" id="f-topp" value="${agent.model.topP}" min="0" max="1" step="0.05">
        </div>
        ${U.switchHTML('f-stream', agent.model.stream, '启用流式输出（Streaming）')}
        <button class="md-btn md-btn--outlined md-btn--block" id="btn-test-llm" style="margin-top:8px">
          ${M('cable')}<span>测试连接</span>
        </button>
      </section>

      <section class="md-tab-panel md-surface" data-panel="qq">
        ${U.switchHTML('f-qq-enable', agent.qq?.enabled, '启用 QQ 接入')}
        <div class="md-field">
          <label>中继服务地址（Relay URL）</label>
          <input class="md-textfield" type="text" id="f-qq-url" value="${escapeAttr(agent.qq?.relayUrl || '')}" placeholder="http://你的服务器:3000">
        </div>
        <div class="md-field">
          <label>中继 Token（可选）</label>
          <input class="md-textfield" type="password" id="f-qq-token" value="${escapeAttr(agent.qq?.relayToken || '')}">
        </div>
        <div class="md-field">
          <label>默认目标群 / 好友 ID</label>
          <input class="md-textfield" type="text" id="f-qq-target" value="${escapeAttr(agent.qq?.targetId || '')}" placeholder="QQ 群号 或 好友 QQ 号">
        </div>
        <div class="md-field">
          <label>目标类型</label>
          <select class="md-select" id="f-qq-type">
            <option value="group" ${agent.qq?.targetType === 'group' ? 'selected' : ''}>群聊</option>
            <option value="private" ${agent.qq?.targetType === 'private' ? 'selected' : ''}>私聊</option>
          </select>
        </div>
        <div class="md-hint">QQ 接入需要一个运行中的「中继服务」把消息转给 QQ 机器人（如 go-cqhttp / OneBot）。仓库内 <code>qq-relay/</code> 提供了开箱即用的 Node 中继示例。</div>
        <button class="md-btn md-btn--outlined md-btn--block" id="btn-test-qq" style="margin-top:8px">
          ${M('cable')}<span>测试中继连接</span>
        </button>
      </section>

      <section class="md-tab-panel md-surface" data-panel="advanced">
        ${U.switchHTML('f-markdown', Storage.loadSettings().markdown, '渲染 Markdown 回复')}
        ${U.switchHTML('f-savehist', Storage.loadSettings().saveHistory, '保存对话历史')}
        <div class="md-danger-zone">
          <h4>危险区</h4>
          <button class="md-btn md-btn--outlined md-btn--sm" id="btn-clear-msg">${M('delete_sweep')}<span>清空该智能体对话</span></button>
          <button class="md-btn md-btn--outlined md-btn--sm" id="btn-delete-agent" style="border-color:var(--md-sys-error);color:var(--md-sys-error)">${M('delete_forever')}<span>删除智能体</span></button>
        </div>
      </section>

      <div style="height:80px"></div>
    `;

    const frag = U.page({
      title: '编辑智能体', sub: escapeHtml(agent.name),
      back: false,
      actions: [
        { icon: 'close', title: '取消', onClick: () => navigate('#/agent/' + agent.id) },
        { icon: 'check', title: '保存', onClick: () => saveEditor(agent), id: 'btn-save-header' },
      ],
      body,
    });
    U.render(frag);
    // 保存后回到聊天页
    Object.defineProperty(agent, '__saved', { value: false, writable: true });
    bindEditorEvents(agent);
  }

  function bindEditorEvents(agent) {
    // 服务商切换
    document.getElementById('f-provider').addEventListener('change', e => {
      const p = e.target.value;
      const preset = LLM.getPreset(p);
      document.getElementById('f-baseurl').value = preset.baseUrl;
      document.getElementById('f-modelname').value = preset.modelName;
      document.getElementById('f-apikey').placeholder = p === 'ollama' ? '本地模型可留空' : 'sk-...';
    });

    // 温度滑块
    document.getElementById('f-temp').addEventListener('input', e => {
      document.querySelector('#lbl-temp span').textContent = parseFloat(e.target.value).toFixed(2);
    });

    // Emoji 选择
    const grid = document.getElementById('emoji-grid');
    const emojis = ['🤖', '🐺', '🦊', '🐱', '🐶', '🐰', '🐼', '🦉', '🐧', '🌟', '🎮', '💻', '🎨', '📚', '🎵', '🍫'];
    grid.innerHTML = emojis.map(e => `<button type="button" class="md-emoji-chip" data-e="${e}">${e}</button>`).join('');
    grid.querySelectorAll('.md-emoji-chip').forEach(c => {
      c.addEventListener('click', () => { document.getElementById('f-avatar').value = c.dataset.e; });
    });

    // Tabs
    document.querySelectorAll('.md-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.md-tab').forEach(t => t.classList.remove('md-tab--active'));
        tab.classList.add('md-tab--active');
        const panel = tab.dataset.tab;
        document.querySelectorAll('.md-tab-panel').forEach(p => p.classList.toggle('md-tab-panel--active', p.dataset.panel === panel));
      });
    });

    // 测试按钮
    const bindTest = (btnId, fn) => {
      document.getElementById(btnId).addEventListener('click', async () => {
        const btn = document.getElementById(btnId); const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = U.materialIcon('sync', true) + '<span>测试中…</span>';
        try { const r = await fn(); U.snackbar(r); }
        catch (e) { U.snackbar(e.message, { action: '关闭' }); }
        finally { btn.disabled = false; btn.innerHTML = orig; }
      });
    };
    bindTest('btn-test-llm', () => LLM.testConnection(readEditor(agent)));
    bindTest('btn-test-qq', () => QQ.testRelay(readEditor(agent)));

    document.getElementById('btn-clear-msg').addEventListener('click', () => {
      U.confirm('清空对话', '确定清空该智能体全部对话？', '清空', '取消', true)
        .then(ok => { if (ok) { Storage.clearMessages(agent.id); U.snackbar('已清空'); } });
    });
    document.getElementById('btn-delete-agent').addEventListener('click', () => {
      U.confirm('删除智能体', `确定删除「${agent.name}」？此操作不可撤销。`, '删除', '取消', true)
        .then(ok => { if (ok) { Storage.deleteAgent(agent.id); U.snackbar('已删除'); navigate('#/'); } });
    });
  }

  function readEditor(agent) {
    const tagsRaw = document.getElementById('f-tags').value;
    const tags = tagsRaw.split(/[，,]/).map(s => s.trim()).filter(Boolean);
    const settings = Storage.loadSettings();
    settings.markdown = document.querySelector('input[name="f-markdown"]').checked;
    settings.saveHistory = document.querySelector('input[name="f-savehist"]').checked;
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
    U.snackbar('已保存'); navigate('#/agent/' + agent.id);
  }

  // ============ 全局设置 ============
  function renderSettings() {
    const s = Storage.loadSettings();
    const M = U.materialIcon;
    const body = `
      <div class="md-surface">
        <div class="md-field">
          <label>默认主题</label>
          <select class="md-select" id="set-theme">
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>浅色</option>
          </select>
        </div>
        ${U.switchHTML('set-stream', s.defaultStream, '新智能体默认启用流式输出')}

        <div class="md-divider"></div>
        <div class="md-field-row">
          <button class="md-btn md-btn--outlined md-btn--block" id="set-export">${M('upload')}<span>导出全部数据</span></button>
          <button class="md-btn md-btn--outlined md-btn--block" id="set-import">${M('download')}<span>导入备份</span></button>
        </div>

        <div class="md-danger-zone">
          <h4>危险区</h4>
          <button class="md-btn md-btn--outlined md-btn--sm" id="set-clear" style="border-color:var(--md-sys-error);color:var(--md-sys-error)">${M('warning')}<span>清空全部数据</span></button>
        </div>

        <p class="md-hint" style="margin-top:16px">本项目为开源免费软件 · MIT License<br>源码 & 构建见 GitHub</p>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
    `;
    const frag = U.page({ title: '全局设置', sub: '主题 / 备份 / 数据', body });
    U.render(frag);

    document.getElementById('set-theme').addEventListener('change', e => { s.theme = e.target.value; Storage.saveSettings(s); applyTheme(); });
    document.getElementById('set-stream').addEventListener('change', e => { s.defaultStream = e.target.checked; Storage.saveSettings(s); });
    document.getElementById('set-export').addEventListener('click', exportBackup);
    document.getElementById('set-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importBackup);
    document.getElementById('set-clear').addEventListener('click', () => {
      U.confirm('清空全部数据', '确定清空全部智能体与对话？此操作不可撤销！', '清空', '取消', true)
        .then(ok => { if (ok) { Storage.clearAll(); U.snackbar('已清空'); renderHome(); } });
    });
  }

  // ============ 工具函数 ============
  function providerLabel(p) {
    return ({ openai: 'OpenAI', deepseek: 'DeepSeek', kimi: 'Kimi', ollama: '本地模型', custom: '自定义' })[p] || '未配置';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  /** 极简 Markdown 渲染（离线可用） */
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

  // 暴露给测试 / 调试：AgentForge.renderHome(hash) 可直接渲染指定路由
  window.AgentForge = { navigate, renderHome: (hash) => { if (hash) location.hash = hash; router(); }, providerLabel };
})();
