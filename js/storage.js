/**
 * storage.js - 智能体数据持久化
 * 使用 localStorage 存储，Capacitor 环境下可无缝迁移到 SharedPreferences
 */
const Storage = (() => {
  const KEY = 'agentforge.agents.v1';
  const SETTINGS_KEY = 'agentforge.settings.v1';

  function loadAgents() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch (e) {
      console.error('[Storage] loadAgents failed', e);
      return [];
    }
  }

  function saveAgents(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : getDefaultSettings();
    } catch (e) {
      return getDefaultSettings();
    }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function getDefaultSettings() {
    return {
      theme: 'dark',           // dark | light
      defaultStream: true,
      markdown: true,
      saveHistory: true,
    };
  }

  // ---- 智能体 CRUD ----
  function createAgent(partial = {}) {
    const now = Date.now();
    const agent = Object.assign({
      id: 'agt_' + Math.random().toString(36).slice(2, 10) + now.toString(36),
      name: '新智能体',
      avatar: '🤖',
      summary: '',
      systemPrompt: '',
      greeting: '',
      model: {
        provider: 'openai',    // openai | deepseek | kimi | ollama | custom
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1024,
        topP: 1.0,
        stream: true,
      },
      qq: {
        enabled: false,
        relayUrl: '',
        relayToken: '',
        targetId: '',
        targetType: 'group',   // group | private
      },
      tags: [],
      createdAt: now,
      updatedAt: now,
      messages: [],            // 对话历史
    }, partial);
    const list = loadAgents();
    list.unshift(agent);
    saveAgents(list);
    return agent;
  }

  function updateAgent(id, patch) {
    const list = loadAgents();
    const idx = list.findIndex(a => a.id === id);
    if (idx < 0) return null;
    list[idx] = Object.assign({}, list[idx], patch, { updatedAt: Date.now() });
    saveAgents(list);
    return list[idx];
  }

  function deleteAgent(id) {
    let list = loadAgents();
    list = list.filter(a => a.id !== id);
    saveAgents(list);
  }

  function getAgent(id) {
    return loadAgents().find(a => a.id === id) || null;
  }

  function appendMessage(id, msg) {
    const list = loadAgents();
    const agent = list.find(a => a.id === id);
    if (!agent) return;
    if (!agent.messages) agent.messages = [];
    agent.messages.push(msg);
    saveAgents(list);
  }

  function clearMessages(id) {
    const list = loadAgents();
    const agent = list.find(a => a.id === id);
    if (agent) agent.messages = [];
    saveAgents(list);
  }

  // ---- 备份 / 导入 ----
  function exportAll() {
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      agents: loadAgents(),
      settings: loadSettings(),
    }, null, 2);
  }

  function importAll(jsonText) {
    const data = JSON.parse(jsonText);
    if (!data.agents) throw new Error('无效的备份文件');
    saveAgents(data.agents);
    if (data.settings) saveSettings(data.settings);
  }

  function clearAll() {
    localStorage.removeItem(KEY);
  }

  return {
    loadAgents, saveAgents,
    loadSettings, saveSettings, getDefaultSettings,
    createAgent, updateAgent, deleteAgent, getAgent,
    appendMessage, clearMessages,
    exportAll, importAll, clearAll,
  };
})();
