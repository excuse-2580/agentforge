/**
 * ui.js —— Material Design 3 组件库
 * 提供：Snackbar / Dialog / BottomSheet / Menu / Switch / Slider 等声明式组件，
 * 统一挂载在 #overlay-root 下，避免散落在各页面。
 */
(function (global) {
  'use strict';

  const root = () => document.getElementById('overlay-root');

  // ---------- 工具 ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // ---------- Snackbar ----------
  /**
   * 显示 Material Snackbar（自动消失）
   * @param {string} text
   * @param {object} [opt] { action, duration, onAction }
   */
  function snackbar(text, opt = {}) {
    const { action, duration = 3000, onAction } = opt;
    const host = root();
    if (!host) return;
    // 移除旧的
    host.querySelectorAll('.md-snackbar').forEach(n => n.remove());

    const bar = el('div', { class: 'md-snackbar', role: 'status' }, [
      el('span', {}, text),
    ]);
    if (action) {
      bar.appendChild(el('span', {
        class: 'md-snackbar__action',
        onclick: () => { onAction && onAction(); bar.remove(); },
      }, action));
    }
    host.appendChild(bar);
    setTimeout(() => { bar.style.opacity = '0'; bar.style.transition = 'opacity .2s'; setTimeout(() => bar.remove(), 200); }, duration);
  }

  // ---------- Dialog（Alert / Confirm / Prompt） ----------
  /** 通用对话框容器 */
  function openDialog(contentBuilder, onClose) {
    const host = root();
    const scrim = el('div', { class: 'md-scrim' });
    const dialog = el('div', { class: 'md-dialog', role: 'dialog', 'aria-modal': 'true' });
    contentBuilder(dialog);
    scrim.appendChild(dialog);
    host.appendChild(scrim);

    const close = (val) => { scrim.remove(); onClose && onClose(val); };
    scrim.addEventListener('click', e => { if (e.target === scrim) close(null); });
    return { dialog, close };
  }

  /** Alert */
  function alertDialog(title, message, btnText = '知道了') {
    return new Promise(resolve => {
      openDialog(dialog => {
        dialog.appendChild(el('h3', {}, title));
        dialog.appendChild(el('p', {}, message));
        const actions = el('div', { class: 'md-dialog__actions' });
        actions.appendChild(el('button', {
          class: 'md-btn md-btn--text',
          onclick: () => { scrim.remove(); resolve(true); },
        }, btnText));
        dialog.appendChild(actions);
      }, () => resolve(false));
    });
  }

  /** Confirm（带取消/确认，确认可禁用） */
  function confirmDialog(title, message, confirmText = '确认', cancelText = '取消', danger = false) {
    return new Promise(resolve => {
      const dlg = openDialog(dialog => {
        dialog.appendChild(el('h3', {}, title));
        dialog.appendChild(el('p', {}, message));
        const actions = el('div', { class: 'md-dialog__actions' });
        actions.appendChild(el('button', {
          class: 'md-btn md-btn--text',
          onclick: () => { dlg.close(false); resolve(false); },
        }, cancelText));
        actions.appendChild(el('button', {
          class: 'md-btn md-btn--filled',
          style: danger ? 'background: var(--md-sys-error); color: var(--md-sys-on-error);' : '',
          onclick: () => { scrim.remove(); resolve(true); },
        }, confirmText));
        dialog.appendChild(actions);
      }, () => resolve(false));
    });
  }

  // ---------- Bottom Sheet ----------
  function bottomSheet(title, items) {
    return new Promise(resolve => {
      const host = root();
      const scrim = el('div', { class: 'md-scrim' });
      const dialog = el('div', { class: 'md-dialog' });
      if (title) dialog.appendChild(el('h3', {}, title));
      const list = el('div', {});
      items.forEach(item => {
        const btn = el('button', {
          class: 'md-menu__item',
          onclick: () => { scrim.remove(); resolve(item.value); },
        }, [
          item.icon ? el('span', { class: 'md-ico material-symbols-outlined' }, item.icon) : null,
          el('span', {}, item.label),
        ]);
        list.appendChild(btn);
      });
      dialog.appendChild(list);
      scrim.appendChild(dialog);
      host.appendChild(scrim);
      scrim.addEventListener('click', e => { if (e.target === scrim) { scrim.remove(); resolve(null); } });
    });
  }

  // ---------- Menu（锚定按钮的下拉菜单） ----------
  function openMenu(anchorEl, items) {
    return new Promise(resolve => {
      const host = root();
      const rect = anchorEl.getBoundingClientRect();
      const menu = el('div', { class: 'md-menu' });
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      items.forEach(item => {
        if (item.divider) { menu.appendChild(el('div', { class: 'md-menu__divider' })); return; }
        menu.appendChild(el('button', {
          class: 'md-menu__item',
          onclick: () => { menu.remove(); resolve(item.value ?? item.label); },
        }, [
          item.icon ? el('span', { class: 'md-ico material-symbols-outlined' }, item.icon) : null,
          el('span', {}, item.label),
        ]));
      });
      host.appendChild(menu);
      const close = e => { if (!menu.contains(e.target) && e.target !== anchorEl) { menu.remove(); document.removeEventListener('click', close); } };
      setTimeout(() => document.addEventListener('click', close), 0);
    });
  }

  // ---------- Switch ----------
  function switchHTML(name, checked, label) {
    return `
      <label class="md-check" style="display:flex;justify-content:space-between;width:100%;cursor:pointer;margin-bottom:0">
        <span class="md-label-lg">${label}</span>
        <span class="md-switch">
          <input type="checkbox" id="${name}" name="${name}" ${checked ? 'checked' : ''}>
          <span class="md-switch__track"></span>
          <span class="md-switch__thumb"></span>
        </span>
      </label>`;
  }

  // ---------- Slider ----------
  function sliderHTML(name, value, min, max, step, labelId) {
    return `
      <input type="range" class="md-slider" id="${name}" name="${name}" min="${min}" max="${max}" step="${step}"
             value="${value}" aria-labelledby="${labelId}" list="${name}-ticks">
      <datalist id="${name}-ticks"></datalist>`;
  }

  // ---------- 页面包装：带返回/标题的 AppBar + 内容区 ----------
  /**
   * 生成标准页面骨架
   * @param {object} opt
   * @param {string} [opt.title]
   * @param {string} [opt.sub]
   * @param {boolean} [opt.large=false] 是否 Large App Bar
   * @param {Array} [opt.actions] 右侧 icon-btn 列表 [{icon, title, onClick, id}]
   * @param {string|Node} [opt.body]
   * @param {boolean} [opt.back=true] 是否显示返回按钮
   */
  function page(opt) {
    const { title = '', sub = '', large = false, actions = [], body = '', back = true } = opt;
    const appbar = el('header', { class: 'md-appbar' + (large ? ' md-appbar--large' : '') });

    if (back) {
      appbar.appendChild(el('button', {
        class: 'md-icon-btn md-appbar__nav', title: '返回', 'aria-label': '返回',
        onclick: () => { window.location.hash = '#/'; },
      }, [el('span', { class: 'material-symbols-outlined' }, 'arrow_back')]));
    }

    const titleWrap = el('div', { class: 'md-appbar__title' });
    titleWrap.appendChild(el('h1', { class: large ? 'md-display-sm' : '' }, title));
    if (sub) titleWrap.appendChild(el('p', { class: 'md-sub' }, sub));
    appbar.appendChild(titleWrap);

    const actWrap = el('div', { class: 'md-appbar__actions' });
    actions.forEach(a => {
      actWrap.appendChild(el('button', {
        class: 'md-icon-btn', id: a.id || '', title: a.title || '', 'aria-label': a.title || '',
        onclick: a.onClick,
      }, [el('span', { class: 'material-symbols-outlined' }, a.icon)]));
    });
    appbar.appendChild(actWrap);

    const content = el('main', { class: 'md-content md-page' });
    if (typeof body === 'string') content.innerHTML = body;
    else if (body) content.appendChild(body);

    const frag = document.createDocumentFragment();
    frag.appendChild(appbar);
    frag.appendChild(content);
    return frag;
  }

  /** 渲染页面（清空 #app 并挂载） */
  function render(fragment) {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(fragment);
    window.scrollTo(0, 0);
  }

  /** 主 FAB */
  function fab(icon, onClick, label) {
    const f = el('button', {
      class: 'md-fab', title: label || '', 'aria-label': label || '',
      onclick: onClick,
    }, [el('span', { class: 'material-symbols-outlined' }, icon)]);
    document.getElementById('app').appendChild(f);
    return f;
  }

  /** Material Icon 快捷生成 */
  function ico(name, filled = false) {
    const s = document.createElement('span');
    s.className = 'material-symbols-outlined';
    if (filled) s.style.fontVariationSettings = "'FILL' 1";
    s.textContent = name;
    return s;
  }

  global.UI = {
    el, snackbar, alert: alertDialog, confirm: confirmDialog,
    bottomSheet, openMenu, switchHTML, sliderHTML, page, render, fab, ico,
    materialIcon: (name, filled) => `<span class="material-symbols-outlined"${filled ? ' style="font-variation-settings:\\"FILL\\" 1"' : ''}>${name}</span>`,
  };
})(window);
