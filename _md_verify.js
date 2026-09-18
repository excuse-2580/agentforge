#!/usr/bin/env node
/**
 * 验证 Material Design 重构后的页面能正确渲染（无 JS 报错、关键元素存在）。
 * 使用 jsdom 模拟 DOM，通过 hash 路由触发各页面渲染函数。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const html = `<!DOCTYPE html><html><head></head><body>
  <div id="app"></div>
  <div id="overlay-root"></div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://localhost/' });
const { window } = dom;

if (!window.localStorage) {
  let store = {};
  window.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

// 捕获所有错误
const errors = [];
window.onerror = (m) => errors.push(String(m));
window.console.error = (...a) => { /* 静默 jsdom 内部警告 */ };

// 加载依赖脚本：拼接为单个脚本字符串，用一次 eval 执行，
// 保证所有 const（Storage / LLM / QQ / UI）处于同一全局作用域，可互相引用。
const scripts = ['js/storage.js', 'js/llm.js', 'js/qq.js', 'js/ui.js', 'js/app.js'];
let bundle = '';
for (const s of scripts) {
  bundle += `\n/* ===== ${s} ===== */\n` + fs.readFileSync(path.join(ROOT, s), 'utf8');
  console.log(`  ✓ loaded ${s}`);
}
try { window.eval(bundle); }
catch (e) { console.error(`  ✗ bundle eval failed: ${e.message}`); process.exit(1); }

const w = window;

function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); errors.push(`${name}: ${e.message}`); }
}

// 触发初始化（seed 会创建示例智能体「小夜」）
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

// 确保 seed 执行完、agents 已初始化
w.AgentForge.renderHome();

console.log('\n=== 渲染各页面 ===');

check('首页 #/', () => {
  w.location.hash = '#/';
  w.AgentForge.renderHome();
  const app = w.document.getElementById('app');
  if (!app.querySelector('.md-appbar')) throw new Error('缺少 .md-appbar');
  if (!app.querySelector('.md-fab')) throw new Error('缺少 FAB');
  if (!app.querySelector('.md-grid')) throw new Error('列表未渲染');
});

check('新建智能体 #/new', () => {
  w.location.hash = '#/new';
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  if (!w.Storage.loadAgents().some(a => a.name === '新智能体')) throw new Error('未创建智能体');
});

const agents = w.Storage.loadAgents();
const aid = agents[0]?.id;
console.log('  (agents:', agents.map(a => a.name).join(', ') || '无', '| aid=' + aid + ')');

check('聊天页 #/agent/:id', () => {
  if (!aid) { console.log('    (跳过，无 agent)'); return; }
  w.AgentForge.renderHome('#/agent/' + aid);
  const app = w.document.getElementById('app');
  if (!app.querySelector('.md-chat')) throw new Error('缺少 .md-chat');
  if (!app.querySelector('.md-composer')) throw new Error('缺少 .md-composer');
});

check('编辑器 #/edit/:id', () => {
  if (!aid) { console.log('    (跳过，无 agent)'); return; }
  w.AgentForge.renderHome('#/edit/' + aid);
  const app = w.document.getElementById('app');
  if (!app.querySelector('.md-tabs')) throw new Error('缺少 .md-tabs');
  if (!app.querySelector('.md-tab-panel--active')) throw new Error('Tab 面板未激活');
  if (!app.querySelector('.md-switch')) throw new Error('缺少 Switch');
  if (!app.querySelector('.md-slider')) throw new Error('缺少 Slider');
});

check('全局设置 #/settings', () => {
  w.location.hash = '#/settings';
  w.AgentForge.renderHome();
  const app = w.document.getElementById('app');
  if (!app.querySelector('.md-select')) throw new Error('缺少 select');
  if (!app.querySelector('.md-danger-zone')) throw new Error('缺少 danger zone');
});

check('UI 组件：Snackbar / SwitchHTML / SliderHTML', () => {
  const UI = w.UI;
  UI.snackbar('测试消息');
  if (!w.document.querySelector('.md-snackbar')) throw new Error('Snackbar 未挂载');
  const sw = UI.switchHTML('test', true, '标签');
  if (!sw.includes('md-switch')) throw new Error('switchHTML 输出异常');
  const sl = UI.sliderHTML('s', 0.5, 0, 1, 0.1, 'lbl');
  if (!sl.includes('md-slider')) throw new Error('sliderHTML 输出异常');
  UI.confirm('x', 'y').catch(() => {});
});

// ============ 端到端交互测试 ============
console.log('\n=== 端到端交互 ===');

check('E2E：切换主题 → 保存 → 回首页', () => {
  // 1. 进设置页
  w.AgentForge.renderHome('#/settings');
  const themeSelect = w.document.getElementById('set-theme');
  if (!themeSelect) throw new Error('设置页缺少 set-theme');
  // 2. 模拟切换主题（触发 change 事件）
  themeSelect.value = 'light';
  themeSelect.dispatchEvent(new w.Event('change'));
  if (w.document.documentElement.getAttribute('data-theme') !== 'light') {
    throw new Error('主题切换未生效，当前=' + w.document.documentElement.getAttribute('data-theme'));
  }
  // 3. 切回 dark
  themeSelect.value = 'dark';
  themeSelect.dispatchEvent(new w.Event('change'));
});

check('E2E：编辑器表单交互（服务商/温度/Emoji）', () => {
  if (!aid) { console.log('    (跳过)'); return; }
  w.AgentForge.renderHome('#/edit/' + aid);
  const d = w.document;

  // 服务商切换
  const provider = d.getElementById('f-provider');
  provider.value = 'ollama';
  provider.dispatchEvent(new w.Event('change'));
  if (d.getElementById('f-apikey').placeholder !== '本地模型可留空') {
    throw new Error('服务商切换未更新 apikey placeholder');
  }

  // 温度滑块
  const temp = d.getElementById('f-temp');
  temp.value = '1.5';
  temp.dispatchEvent(new w.Event('input'));
  const lbl = d.querySelector('#lbl-temp span');
  if (!lbl || lbl.textContent !== '1.50') throw new Error('温度滑块标签未更新: ' + (lbl && lbl.textContent));

  // Emoji 选择
  const emoji = d.querySelector('.md-emoji-chip');
  if (emoji) emoji.click();

  // 切到 QQ Tab
  const qqTab = Array.from(d.querySelectorAll('.md-tab')).find(t => t.dataset.tab === 'qq');
  qqTab.click();
  if (!d.querySelector('.md-tab-panel[data-panel="qq"].md-tab-panel--active')) {
    throw new Error('Tab 切换未生效');
  }
});

check('E2E：保存编辑器 → 数据持久化', () => {
  if (!aid) { console.log('    (跳过)'); return; }
  w.AgentForge.renderHome('#/edit/' + aid);
  const d = w.document;
  d.getElementById('f-name').value = '小夜（已编辑）';
  // 模拟点击 header 保存按钮
  d.getElementById('btn-save-header').click();
  const saved = w.Storage.getAgent(aid);
  if (saved.name !== '小夜（已编辑）') throw new Error('保存未生效: ' + saved.name);
  // 恢复原名，避免影响其他测试
  saved.name = '小夜'; w.Storage.updateAgent(aid, saved);
});

check('E2E：确认对话框渲染', () => {
  // 直接验证 confirmDialog 能挂载 DOM（不模拟点击确定）
  const before = w.document.querySelectorAll('.md-scrim').length;
  w.UI.confirm('测试标题', '测试内容', '确认', '取消', true).catch(() => {});
  const after = w.document.querySelectorAll('.md-scrim').length;
  if (after <= before) throw new Error('对话框未挂载到 DOM');
  // 清理：点击取消按钮关闭
  const cancelBtn = w.document.querySelector('.md-dialog__actions .md-btn--text');
  cancelBtn && cancelBtn.click();
});

console.log('\n=== 结果汇总 ===');
if (errors.length) {
  console.error(`  ✗ ${errors.length} 个问题：`);
  errors.forEach(e => console.error('    - ' + e));
  process.exit(1);
} else {
  console.log('  ✓ 全部页面渲染通过，无 JS 错误');
}
