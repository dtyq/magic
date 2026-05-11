/**
 * 工具调试面板交互逻辑
 */

// ── 持久化 ────────────────────────────────────────────
// 结构：{ lastToolName: string, tools: { [toolName]: { params, result, resultOk } } }
const STORAGE_KEY = 'td_state_v1';

function loadStorage() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (!raw.tools) raw.tools = {};
        return raw;
    } catch (_) { return { tools: {} }; }
}

function saveStorage(patch) {
    try {
        const prev = loadStorage();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
    } catch (_) {}
}

function saveToolState(toolName, patch) {
    try {
        const prev = loadStorage();
        prev.tools[toolName] = { ...(prev.tools[toolName] || {}), ...patch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
    } catch (_) {}
}

function getToolState(toolName) {
    return loadStorage().tools[toolName] || {};
}

// ── 状态 ──────────────────────────────────────────────
const state = {
    serverUrl: 'http://127.0.0.1:8002',
    builtinTools: [],       // [{name, description, input_schema}]
    selectedTool: null,
    searchQuery: '',
    schemaVisible: false,
    executing: false,
};

// ── DOM 引用 ──────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
    serverUrl:          $('serverUrl'),
    refreshAllBtn:      $('refreshAllBtn'),
    contextSelect:      $('contextSelect'),
    contextIdInput:     $('contextIdInput'),
    workspacePathInput: $('workspacePathInput'),
    contextModeTag:     $('contextModeTag'),
    builtinCount:       $('builtinCount'),
    toolSearch:         $('toolSearch'),
    toolList:           $('toolList'),
    tdPlaceholder:  $('tdPlaceholder'),
    tdToolInfo:     $('tdToolInfo'),
    tdToolName:     $('tdToolName'),
    tdToolDesc:     $('tdToolDesc'),
    schemaToggleBtn: $('schemaToggleBtn'),
    formatBtn:      $('formatBtn'),
    fillDefaultBtn:  $('fillDefaultBtn'),
    fillExampleBtn:  $('fillExampleBtn'),
    paramsEditor:   $('paramsEditor'),
    schemaPanel:    $('schemaPanel'),
    executeBtn:     $('executeBtn'),
    executeStatus:  $('executeStatus'),
    resultBadge:    $('resultBadge'),
    resultEmpty:    $('resultEmpty'),
    resultContent:  $('resultContent'),
    copyResultBtn:  $('copyResultBtn'),
    clearResultBtn: $('clearResultBtn'),
    tdSidebar:      $('tdSidebar'),
    tdResizer:      $('tdResizer'),
    tdResultPanel:  $('tdResultPanel'),
    tdResultResizer: $('tdResultResizer'),
};

// ── 工具函数 ──────────────────────────────────────────
function getServerUrl() {
    return els.serverUrl.value.trim().replace(/\/+$/, '');
}

function getContextId() {
    const manual = els.contextIdInput.value.trim();
    if (manual) return manual;
    return els.contextSelect.value.trim();
}

function getWorkspacePath() {
    return els.workspacePathInput ? els.workspacePathInput.value.trim() : '';
}

/** 是否使用调试模式（无 context） */
function isDebugMode() {
    return !getContextId();
}

function updateContextModeTag() {
    if (!els.contextModeTag) return;
    if (isDebugMode()) {
        els.contextModeTag.textContent = '调试模式';
        els.contextModeTag.style.background = 'rgba(52,199,89,0.12)';
        els.contextModeTag.style.color = '#248a3d';
    } else {
        els.contextModeTag.textContent = '正常模式';
        els.contextModeTag.style.background = 'rgba(0,122,255,0.1)';
        els.contextModeTag.style.color = '#0066cc';
    }
}

async function fetchJson(path) {
    const res = await fetch(getServerUrl() + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function postJson(path, body) {
    const res = await fetch(getServerUrl() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── 刷新逻辑 ─────────────────────────────────────────
async function refreshAll() {
    setStatus('正在加载...', 'running');
    els.refreshAllBtn.disabled = true;
    els.refreshAllBtn.textContent = '加载中...';

    try {
        await Promise.all([
            loadContexts(),
            loadBuiltinTools(),
        ]);
        setStatus('加载完成', 'success');
        setTimeout(() => setStatus('', ''), 1500);
    } catch (e) {
        setStatus(`加载失败: ${e.message}`, 'error');
    } finally {
        els.refreshAllBtn.disabled = false;
        els.refreshAllBtn.textContent = '刷新';
    }
}

async function loadContexts() {
    let contexts = [];
    try {
        const data = await fetchJson('/api/sdk/contexts');
        contexts = (data.data && data.data.contexts) ? data.data.contexts : [];
    } catch (_) {
        // 忽略错误，保持空列表
    }

    // 记住当前选中值
    const current = els.contextSelect.value;
    els.contextSelect.innerHTML = '<option value="">-- 选择 Agent Context --</option>';
    contexts.forEach(ctx => {
        const opt = document.createElement('option');
        opt.value = ctx.context_id;
        opt.textContent = ctx.label ? `${ctx.label}  (${ctx.context_id.slice(0, 8)}...)` : ctx.context_id;
        els.contextSelect.appendChild(opt);
    });
    // 恢复选中
    if (current) els.contextSelect.value = current;
}

async function loadBuiltinTools() {
    const data = await fetchJson('/api/sdk/tools');
    state.builtinTools = (data.data && data.data.tools) ? data.data.tools : [];
    els.builtinCount.textContent = state.builtinTools.length;
    renderToolList();
    restoreLastState();
}

function restoreLastState() {
    const saved = loadStorage();
    if (!saved.lastToolName) return;
    const tool = state.builtinTools.find(t => t.name === saved.lastToolName);
    if (tool) selectTool(tool);   // selectTool 内部会自动恢复参数和结果
}

// ── 工具列表渲染 ──────────────────────────────────────
function getVisibleTools() {
    const q = state.searchQuery.toLowerCase();
    if (!q) return state.builtinTools;
    return state.builtinTools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
}

function renderToolList() {
    const tools = getVisibleTools();
    els.toolList.innerHTML = '';

    if (tools.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'td-tool-empty';
        empty.textContent = state.searchQuery ? '没有匹配的工具' : '暂无工具，请点击「刷新」';
        els.toolList.appendChild(empty);
        return;
    }

    tools.forEach(tool => {
        const item = document.createElement('div');
        item.className = 'td-tool-item';
        if (state.selectedTool && state.selectedTool.name === tool.name) {
            item.classList.add('selected');
        }

        const nameRow = document.createElement('div');
        nameRow.className = 'td-tool-item-name-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'td-tool-item-name';
        nameSpan.textContent = tool.name;
        nameRow.appendChild(nameSpan);

        const desc = document.createElement('div');
        desc.className = 'td-tool-item-desc';
        desc.textContent = tool.description || '暂无描述';

        item.appendChild(nameRow);
        item.appendChild(desc);

        item.addEventListener('click', () => selectTool(tool));
        els.toolList.appendChild(item);
    });

    // 恢复后把选中项滚到可见区域
    const selected = els.toolList.querySelector('.td-tool-item.selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
    }
}

// ── 工具选择 ──────────────────────────────────────────
function selectTool(tool) {
    state.selectedTool = tool;
    saveStorage({ lastToolName: tool.name });

    // 更新列表高亮
    renderToolList();

    // 更新头部信息
    els.tdPlaceholder.style.display = 'none';
    els.tdToolInfo.style.display = 'block';
    els.tdToolName.textContent = tool.name;
    els.tdToolDesc.textContent = tool.description || '暂无描述';

    // 更新 Schema 面板
    const schema = tool.input_schema || {};
    els.schemaPanel.textContent = JSON.stringify(schema, null, 2);

    // 恢复该工具的历史参数
    const saved = getToolState(tool.name);
    els.paramsEditor.value = saved.params !== undefined ? saved.params : '{}';

    // 隐藏 schema（重置状态）
    if (state.schemaVisible) toggleSchema();

    // 启用执行按钮
    els.executeBtn.disabled = false;

    // 恢复该工具的历史结果，没有则清空
    if (saved.result) {
        try { showResult(JSON.parse(saved.result)); } catch (_) { clearResult(); }
    } else {
        clearResult();
    }
}

// ── Schema 切换 ───────────────────────────────────────
function toggleSchema() {
    state.schemaVisible = !state.schemaVisible;
    if (state.schemaVisible) {
        els.schemaPanel.style.display = 'block';
        els.paramsEditor.style.display = 'none';
        els.schemaToggleBtn.textContent = '编辑参数';
    } else {
        els.schemaPanel.style.display = 'none';
        els.paramsEditor.style.display = 'block';
        els.schemaToggleBtn.textContent = '查看 Schema';
    }
}

// ── 格式化 JSON ───────────────────────────────────────
function formatJson() {
    try {
        const parsed = JSON.parse(els.paramsEditor.value.trim() || '{}');
        els.paramsEditor.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
        flashStatus(`JSON 格式错误: ${e.message}`, 'error');
    }
}

// ── 填入骨架 ──────────────────────────────────────────
function fillDefaultSkeleton() {
    if (!state.selectedTool) return;
    const schema = state.selectedTool.input_schema || {};
    const props = schema.properties || {};
    const required = schema.required || [];

    const skeleton = {};
    // 填入所有字段，required 的给示例值，optional 的给 null
    for (const [key, def] of Object.entries(props)) {
        if (def.type === 'string') {
            skeleton[key] = required.includes(key) ? '' : null;
        } else if (def.type === 'integer' || def.type === 'number') {
            skeleton[key] = required.includes(key) ? 0 : null;
        } else if (def.type === 'boolean') {
            skeleton[key] = required.includes(key) ? false : null;
        } else if (def.type === 'array') {
            skeleton[key] = required.includes(key) ? [] : null;
        } else if (def.type === 'object') {
            skeleton[key] = required.includes(key) ? {} : null;
        } else {
            skeleton[key] = null;
        }
    }

    // 移除 null 的可选字段，保留 required 字段
    const result = {};
    for (const [k, v] of Object.entries(skeleton)) {
        if (required.includes(k) || v !== null) result[k] = v;
    }
    // 确保 required 的字段都在
    for (const k of required) {
        if (!(k in result)) result[k] = null;
    }

    els.paramsEditor.value = JSON.stringify(result, null, 2);
    // 确保编辑器可见
    if (state.schemaVisible) toggleSchema();
}

// ── 填入示例 ──────────────────────────────────────────
/** 递归为 properties 对象的每个字段生成示例值 */
function buildExampleObject(properties) {
    const result = {};
    for (const [k, d] of Object.entries(properties)) {
        result[k] = guessExampleValue(k, d);
    }
    return result;
}

/**
 * 根据字段名、描述和类型推断示例值。
 * 优先级：schema.examples[0] > schema.default > 按字段名/描述启发式推断
 */
function guessExampleValue(key, def) {
    // 优先使用 schema 自带的示例或默认值
    if (def.examples && def.examples.length > 0) return def.examples[0];
    if (def.default !== undefined) return def.default;

    const k = key.toLowerCase();
    const desc = (def.description || '').toLowerCase();
    const hint = k + ' ' + desc;

    switch (def.type) {
        case 'boolean':
            return true;
        case 'integer':
        case 'number':
            if (/limit|count|max|size|num|top_k/.test(hint)) return 10;
            if (/page/.test(hint)) return 1;
            if (/timeout/.test(hint)) return 30;
            if (/width|height/.test(hint)) return 512;
            return 1;
        case 'array': {
            const items = def.items || {};
            const itemType = items.type;
            if (itemType === 'string') return ['example_item'];
            if (itemType === 'integer' || itemType === 'number') return [1];
            if (itemType === 'boolean') return [true];
            if (itemType === 'object') {
                // 递归构建 object 示例
                return [buildExampleObject(items.properties || {})];
            }
            // 嵌套 array 或未知
            return [guessExampleValue('item', items)];
        }
        case 'object':
            return buildExampleObject(def.properties || {});
        default: // string
            if (/\bpath\b|file_path|filepath|dir/.test(hint)) return '/workspace/example.txt';
            if (/url/.test(hint)) return 'https://example.com';
            if (/query|keyword|search/.test(hint)) return '示例搜索词';
            if (/content|text|message|prompt/.test(hint)) return '示例内容';
            if (/name/.test(hint)) return 'example_name';
            if (/id\b/.test(hint)) return 'example_id';
            if (/command|cmd/.test(hint)) return 'echo hello';
            if (/code|script/.test(hint)) return 'print("hello")';
            if (/language|lang/.test(hint)) return 'python';
            if (/format/.test(hint)) return 'json';
            if (/mode/.test(hint)) return 'default';
            if (/pattern|regex/.test(hint)) return '.*\\.py$';
            if (/title/.test(hint)) return '示例标题';
            if (/description|desc/.test(hint)) return '示例描述';
            return 'example_value';
    }
}

function fillExample() {
    if (!state.selectedTool) return;
    const schema = state.selectedTool.input_schema || {};
    const result = buildExampleObject(schema.properties || {});
    els.paramsEditor.value = JSON.stringify(result, null, 2);
    if (state.schemaVisible) toggleSchema();
}

// ── 执行工具 ──────────────────────────────────────────
async function executeTool() {
    if (!state.selectedTool || state.executing) return;

    const contextId = getContextId();

    let params;
    try {
        params = JSON.parse(els.paramsEditor.value.trim() || '{}');
    } catch (e) {
        flashStatus(`参数 JSON 格式错误: ${e.message}`, 'error');
        return;
    }

    state.executing = true;
    els.executeBtn.disabled = true;
    setStatus('', '');
    showExecutingStatus();

    try {
        let result;
        if (contextId) {
            // 有 context_id，走正常接口
            result = await postJson('/api/sdk/tool/call', {
                tool_name: state.selectedTool.name,
                tool_params: params,
                agent_context_id: contextId,
            });
        } else {
            // 调试模式：临时创建隔离 context
            const body = {
                tool_name: state.selectedTool.name,
                tool_params: params,
            };
            const wp = getWorkspacePath();
            if (wp) body.workspace_path = wp;
            result = await postJson('/api/sdk/tool/debug-call', body);
        }

        showResult(result);
    } catch (e) {
        showError(e.message);
    } finally {
        state.executing = false;
        els.executeBtn.disabled = false;
        hideExecutingStatus();
    }
}

function showExecutingStatus() {
    els.executeStatus.innerHTML = '<span class="td-loading-dot"></span>执行中...';
    els.executeStatus.className = 'td-execute-status running';
}

function hideExecutingStatus() {
    els.executeStatus.textContent = '';
    els.executeStatus.className = 'td-execute-status';
}

function showResult(apiResponse) {
    const data = apiResponse.data || {};
    const ok = data.ok === true;
    if (state.selectedTool) {
        saveToolState(state.selectedTool.name, { result: JSON.stringify(apiResponse) });
    }

    // 构建展示内容
    const display = {
        ok: data.ok,
        execution_time: data.execution_time,
        tool_call_id: data.tool_call_id,
        name: data.name,
        content: data.content,
        data: data.data,
    };
    // 移除 undefined/null 字段
    Object.keys(display).forEach(k => {
        if (display[k] === undefined || display[k] === null) delete display[k];
    });

    els.resultEmpty.style.display = 'none';
    els.resultContent.style.display = 'block';
    els.resultContent.textContent = JSON.stringify(display, null, 2);
    els.resultContent.className = `td-result-content ${ok ? 'success' : 'error'}`;

    els.resultBadge.style.display = 'inline-block';
    if (ok) {
        els.resultBadge.textContent = `成功${data.execution_time != null ? '  ' + data.execution_time.toFixed(2) + 's' : ''}`;
        els.resultBadge.className = 'td-result-badge success';
    } else {
        els.resultBadge.textContent = '失败';
        els.resultBadge.className = 'td-result-badge error';
    }
}

function showError(msg) {
    els.resultEmpty.style.display = 'none';
    els.resultContent.style.display = 'block';
    els.resultContent.textContent = msg;
    els.resultContent.className = 'td-result-content error';

    els.resultBadge.style.display = 'inline-block';
    els.resultBadge.textContent = '请求失败';
    els.resultBadge.className = 'td-result-badge error';
}

function clearResult() {
    els.resultEmpty.style.display = 'block';
    els.resultContent.style.display = 'none';
    els.resultContent.textContent = '';
    els.resultContent.className = 'td-result-content';
    els.resultBadge.style.display = 'none';
}

// ── 状态提示 ─────────────────────────────────────────
function setStatus(msg, type) {
    els.executeStatus.textContent = msg;
    els.executeStatus.className = `td-execute-status${type ? ' ' + type : ''}`;
}

let _statusTimer = null;
function flashStatus(msg, type) {
    setStatus(msg, type);
    clearTimeout(_statusTimer);
    _statusTimer = setTimeout(() => setStatus('', ''), 3000);
}

// ── 复制结果 ─────────────────────────────────────────
async function copyResult() {
    const text = els.resultContent.textContent;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        const orig = els.copyResultBtn.textContent;
        els.copyResultBtn.textContent = '已复制';
        setTimeout(() => { els.copyResultBtn.textContent = orig; }, 1500);
    } catch (_) {
        /* 忽略 */
    }
}

// ── 侧边栏拖拽调整宽度 ────────────────────────────────
function initSidebarResizer() {
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    els.tdResizer.addEventListener('mousedown', e => {
        dragging = true;
        startX = e.clientX;
        startWidth = els.tdSidebar.offsetWidth;
        els.tdResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const delta = e.clientX - startX;
        const newWidth = Math.max(200, Math.min(560, startWidth + delta));
        els.tdSidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        els.tdResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

// ── 结果区域拖拽调整高度 ──────────────────────────────
function initResultResizer() {
    let dragging = false;
    let startY = 0;
    let startHeight = 0;

    els.tdResultResizer.addEventListener('mousedown', e => {
        dragging = true;
        startY = e.clientY;
        startHeight = els.tdResultPanel.offsetHeight;
        els.tdResultResizer.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const delta = startY - e.clientY;
        const newHeight = Math.max(80, Math.min(window.innerHeight * 0.7, startHeight + delta));
        els.tdResultPanel.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        els.tdResultResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

// ── 键盘快捷键 ────────────────────────────────────────
function initKeyboard() {
    els.paramsEditor.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeTool();
        }
    });
    els.paramsEditor.addEventListener('input', () => {
        if (state.selectedTool) {
            saveToolState(state.selectedTool.name, { params: els.paramsEditor.value });
        }
    });
}

// ── 事件绑定 ─────────────────────────────────────────
function bindEvents() {
    els.refreshAllBtn.addEventListener('click', refreshAll);
    els.toolSearch.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        renderToolList();
    });
    els.schemaToggleBtn.addEventListener('click', toggleSchema);
    els.formatBtn.addEventListener('click', formatJson);
    els.fillDefaultBtn.addEventListener('click', fillDefaultSkeleton);
    els.fillExampleBtn.addEventListener('click', fillExample);
    els.executeBtn.addEventListener('click', executeTool);
    els.copyResultBtn.addEventListener('click', copyResult);
    els.clearResultBtn.addEventListener('click', clearResult);

    // context select -> 同步到 input（便于感知）
    els.contextSelect.addEventListener('change', () => {
        if (els.contextSelect.value) {
            els.contextIdInput.value = '';
        }
        updateContextModeTag();
    });
    els.contextIdInput.addEventListener('input', () => {
        if (els.contextIdInput.value.trim()) {
            els.contextSelect.value = '';
        }
        updateContextModeTag();
    });

    // 服务器地址回车刷新
    els.serverUrl.addEventListener('keydown', e => {
        if (e.key === 'Enter') refreshAll();
    });
}

// ── 初始化 ────────────────────────────────────────────
function init() {
    bindEvents();
    initSidebarResizer();
    initResultResizer();
    initKeyboard();
    updateContextModeTag();
    // 自动加载
    refreshAll();
}

document.addEventListener('DOMContentLoaded', init);
