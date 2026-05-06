// 全局变量
let messageHistory = []; // 存储用户发送过的消息历史
let currentTaskMode = "plan"; // 当前任务模式，默认为 plan（保留兼容性）
let currentAgentMode = "magic"; // 当前Agent模式，默认为 magic
let currentLanguage = "zh_CN"; // 当前语言，默认中文
let currentMessageVersion = "v2"; // 消息版本，默认 v2
let currentFileName = ""; // 存储当前上传的文件名
let isAdvancedMode = false; // 高级模式开关，开启后直接发送原始 JSON
let isImMode = false; // IM 渠道模拟模式
let currentImChannel = "dingtalk"; // 当前 IM 渠道
let currentImUserId = ""; // 当前 IM 用户 ID

// 工作区挂载目录名，空字符串表示直接展示根目录
let mountDirName = localStorage.getItem('mountDirName') ?? '.workspace';
// 用户通过文件选择器选中的原始项目根目录 handle
let rootDirHandle = null;

// WebSocket相关变量
let websocket = null;
let isWebSocketConnected = false;
let wsOpenCallbacks = []; // 等待连接建立的 Promise 回调队列

// LLM token 流走 Magic Service 的 Socket.IO；HTTP WebSocket 只负责事件消息。
let socketIoClient = null;
let socketIoConfigKey = '';
let isSocketIoConnected = false;
let socketIoReconnectTimer = null;
let socketIoHeartbeatTimer = null;
let socketIoPingInterval = 25000;
let socketIoAuthContext = {};

// 确保 WebSocket 已连接，未连接则自动发起连接并等待
function ensureWebSocketConnected() {
    if (isWebSocketConnected) return Promise.resolve();

    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
        showSystemMessage("请先输入服务器地址");
        return Promise.reject(new Error('no server url'));
    }

    return new Promise((resolve, reject) => {
        wsOpenCallbacks.push({ resolve, reject });
        // 未在连接中则发起连接
        if (!websocket || websocket.readyState === WebSocket.CLOSED || websocket.readyState === WebSocket.CLOSING) {
            connectWebSocket();
        }
    });
}

// 对话消息持久化
const CHAT_LOG_KEY = 'chatMessageLog';
const CHAT_LOG_DB_NAME = 'httpClientChatLogDb';
const CHAT_LOG_DB_VERSION = 1;
const CHAT_LOG_STORE_NAME = 'chatLog';
const CHAT_LOG_STATE_KEY = 'entries';
const CHAT_LOG_SAVE_DEBOUNCE_MS = 120;
const CHAT_SCROLL_KEY = 'chatMessageScrollState';
const RAW_EVENTS_TOGGLE_KEY = 'httpClient.showRawEvents';
const PREVIEW_CHAT_WIDTH_KEY = 'httpClient.previewChatWidth';
const FILE_PREVIEW_STATE_KEY = 'httpClient.filePreviewState';
const FILE_PREVIEW_INITIALIZED_KEY = 'httpClient.filePreviewInitialized';
const WORKSPACE_ABSOLUTE_PATH_KEY = 'httpClient.workspaceAbsolutePath';
const MESSAGE_INPUT_DRAFT_KEY = 'httpClient.messageInputDraft';
const RAW_JSON_INPUT_DRAFT_KEY = 'httpClient.rawJsonInputDraft';
const TOOL_DETAIL_MODEL_RATIO_KEY = 'httpClient.toolDetailModelRatio';
const TOOL_DETAIL_MODEL_COLLAPSED_KEY = 'httpClient.toolDetailModelCollapsed';
const TOOL_DETAIL_PREVIEW_PATH = '__virtual__/tool-detail.md';
let chatLog = [];         // 消息数据列表
let isRestoring = false;  // 恢复阶段不触发二次保存
let chatLogDbPromise = null;
let chatLogSaveTimer = null;
let chatLogGeneration = 0;
let chatScrollSaveFrame = null;
const systemMessageRegistry = new Map();
let showRawEvents = localStorage.getItem(RAW_EVENTS_TOGGLE_KEY) === 'true';

function getSystemMessageKey(text) {
    if (text.startsWith('已切换到高级模式')) return 'mode-toggle';
    if (text.startsWith('已切换到普通模式')) return 'mode-toggle';
    if (text.startsWith('切换到 ')) return 'agent-mode-toggle';
    if (text.startsWith('语言已切换为:')) return 'language-toggle';
    if (text.startsWith('消息版本已切换为:')) return 'message-version-toggle';
    if (text.startsWith('挂载目录已切换为:')) return 'mount-dir';
    if (text.startsWith('模型列表已刷新')) return 'model-list-refresh';
    if (text.startsWith('请先选择项目根目录')) return 'workspace-directory';
    if (text.startsWith('工作区文件读取权限')) return 'workspace-permission';
    if (text.startsWith('点击上方按钮重新授权读取')) return 'workspace-permission';
    if (text.startsWith('已恢复工作区文件读取权限')) return 'workspace-permission';
    return '';
}

function saveTextDraft(storageKey, value) {
    const text = typeof value === 'string' ? value : '';
    if (text) {
        localStorage.setItem(storageKey, text);
    } else {
        localStorage.removeItem(storageKey);
    }
}

function restoreInputDrafts() {
    const messageDraft = localStorage.getItem(MESSAGE_INPUT_DRAFT_KEY);
    if (messageInput && messageDraft !== null && !messageInput.value) {
        messageInput.value = messageDraft;
    }

    const rawJsonDraft = localStorage.getItem(RAW_JSON_INPUT_DRAFT_KEY);
    if (rawJsonInput && rawJsonDraft !== null && !rawJsonInput.value) {
        rawJsonInput.value = rawJsonDraft;
    }
}

function clearMessageInputDraft() {
    localStorage.removeItem(MESSAGE_INPUT_DRAFT_KEY);
}

function upsertSystemLog(text, key) {
    if (!key) {
        pushLog({ type: 'system', text });
        return;
    }
    const existingIndex = chatLog.findIndex(entry => entry.type === 'system' && entry.key === key);
    if (existingIndex >= 0) {
        chatLog[existingIndex] = { type: 'system', key, text };
        saveChatLog();
        return;
    }
    pushLog({ type: 'system', key, text });
}

function openChatLogDB() {
    if (!('indexedDB' in window)) {
        return Promise.resolve(null);
    }
    if (!chatLogDbPromise) {
        chatLogDbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(CHAT_LOG_DB_NAME, CHAT_LOG_DB_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(CHAT_LOG_STORE_NAME)) {
                    req.result.createObjectStore(CHAT_LOG_STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }).catch((error) => {
            chatLogDbPromise = null;
            throw error;
        });
    }
    return chatLogDbPromise;
}

async function readChatLogFromDB() {
    const db = await openChatLogDB();
    if (!db) return null;
    const tx = db.transaction(CHAT_LOG_STORE_NAME, 'readonly');
    const store = tx.objectStore(CHAT_LOG_STORE_NAME);
    return await new Promise((resolve, reject) => {
        const req = store.get(CHAT_LOG_STATE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function writeChatLogToDB(entries, generation) {
    const db = await openChatLogDB();
    if (!db || generation !== chatLogGeneration) return;
    const tx = db.transaction(CHAT_LOG_STORE_NAME, 'readwrite');
    tx.objectStore(CHAT_LOG_STORE_NAME).put({ entries, updatedAt: Date.now() }, CHAT_LOG_STATE_KEY);
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
    if (generation === chatLogGeneration) {
        localStorage.removeItem(CHAT_LOG_KEY);
    }
}

async function clearChatLogStorage(generation) {
    try {
        const db = await openChatLogDB();
        if (!db || generation !== chatLogGeneration) return;
        const tx = db.transaction(CHAT_LOG_STORE_NAME, 'readwrite');
        tx.objectStore(CHAT_LOG_STORE_NAME).delete(CHAT_LOG_STATE_KEY);
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('清理 IndexedDB 对话记录失败:', e);
    }
}

function saveChatLog() {
    if (isRestoring) return;
    if (chatLogSaveTimer) {
        clearTimeout(chatLogSaveTimer);
    }
    const generation = chatLogGeneration;
    chatLogSaveTimer = setTimeout(() => {
        chatLogSaveTimer = null;
        writeChatLogToDB(chatLog, generation).catch((e) => {
            console.warn('保存 IndexedDB 对话记录失败:', e);
            try {
                localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(chatLog));
            } catch (storageError) {
                console.warn('保存 localStorage 对话记录失败:', storageError);
            }
        });
    }, CHAT_LOG_SAVE_DEBOUNCE_MS);
}

function pushLog(entry) {
    chatLog.push(entry);
    saveChatLog();
}

function clearChatLog() {
    chatLog = [];
    chatLogGeneration += 1;
    if (chatLogSaveTimer) {
        clearTimeout(chatLogSaveTimer);
        chatLogSaveTimer = null;
    }
    systemMessageRegistry.clear();
    eventTraceObjectSeen = new WeakSet();
    eventLogObjectSeen = new WeakSet();
    localStorage.removeItem(CHAT_LOG_KEY);
    localStorage.removeItem(CHAT_SCROLL_KEY);
    clearChatLogStorage(chatLogGeneration);
}

async function restoreChatLog() {
    try {
        const savedState = await readChatLogFromDB();
        if (savedState && Array.isArray(savedState.entries)) {
            chatLog = compactRestoredChatLog(savedState.entries);
        } else {
            const saved = localStorage.getItem(CHAT_LOG_KEY);
            if (!saved) return;
            chatLog = compactRestoredChatLog(JSON.parse(saved));
        }
    } catch (e) {
        console.warn('恢复对话记录失败:', e);
        chatLog = [];
        return;
    }
    isRestoring = true;
    for (const entry of chatLog) {
        renderLogEntry(entry);
    }
    isRestoring = false;
    saveChatLog();
    restoreChatScrollState();
}

function compactRestoredChatLog(entries) {
    if (!Array.isArray(entries)) return [];
    const result = [];
    const systemIndexByKey = new Map();
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.type !== 'system') {
            result.push(entry);
            continue;
        }
        const key = entry.key || getSystemMessageKey(entry.text || '');
        const nextEntry = key ? { ...entry, key } : entry;
        if (!key) {
            result.push(nextEntry);
            continue;
        }
        const existingIndex = systemIndexByKey.get(key);
        if (existingIndex === undefined) {
            systemIndexByKey.set(key, result.length);
            result.push(nextEntry);
        } else {
            result[existingIndex] = nextEntry;
        }
    }
    return result;
}

function renderLogEntry(entry) {
    switch (entry.type) {
        case 'client':    renderClientEntry(entry); break;
        case 'ai':        showAIMessage(entry.content, entry.timestamp, true); break;
        case 'thinking':  showThinkingMessage(entry.content, entry.timestamp, true); break;
        case 'tool_call': showToolCallMessage(entry.tool, entry.eventType, entry.timestamp, true); break;
        case 'event':     showEventLog(entry.data, true); break;
        case 'system':    showSystemMessage(entry.text, true, { key: entry.key }); break;
    }
}

function renderClientEntry(entry, options = {}) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message client';
    const header = document.createElement('div');
    header.className = 'message-header';
    let headerText;
    if (entry.imChannel) {
        const channelLabel = { dingtalk: '钉钉', wechat: '微信', wecom: '企业微信', lark: '飞书' }[entry.imChannel] || entry.imChannel;
        const userIdPart = entry.imUserId ? ` / user=${entry.imUserId}` : '';
        headerText = `客户端消息 (${entry.time}) - IM渠道: ${channelLabel}${userIdPart}`;
    } else {
        const agentMode = entry.agentMode ? entry.agentMode.toUpperCase() : 'N/A';
        const modelId = entry.modelId ? ` - Model: ${entry.modelId}` : '';
        headerText = `客户端消息 (${entry.time}) - Agent模式: ${agentMode}${modelId}`;
    }
    const headerLabel = document.createElement('span');
    headerLabel.textContent = headerText;
    header.appendChild(headerLabel);
    attachCopyButton(header, () => entry.prompt || '', { compact: true });
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = entry.prompt;
    messageDiv.appendChild(header);
    messageDiv.appendChild(content);
    appendMessageNode(messageDiv, options);
}

// DOM 元素
const serverUrlInput = document.getElementById('serverUrl');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const interruptBtn = document.getElementById('interruptBtn');
const messageList = document.getElementById('messageList');
const uploadConfigContent = document.getElementById('uploadConfigContent');
const configFileInput = document.getElementById('configFile');
const currentFileNameDisplay = document.getElementById('currentFileName');
const modeToggle = document.getElementById('modeToggle');
const agentModeSelect = document.getElementById('agentModeSelect');
const agentCodeInput = document.getElementById('agentCodeInput');
const agentCodeGroup = document.getElementById('agentCodeGroup');
const modelIdInput = document.getElementById('modelIdInput');
const modelIdSelect = document.getElementById('modelIdSelect');
const imageModelSelect = document.getElementById('imageModelSelect');
const advancedModeToggle = document.getElementById('advancedModeToggle');
const rawJsonInput = document.getElementById('rawJsonInput');
const languageSelect = document.getElementById('languageSelect');
const messageVersionSelect = document.getElementById('messageVersionSelect');
const imModeToggle = document.getElementById('imModeToggle');
const rawEventsToggle = document.getElementById('rawEventsToggle');
const imChannelSelect = document.getElementById('imChannelSelect');
const imUserIdInput = document.getElementById('imUserIdInput');
const messagesContainer = document.getElementById('messagesContainer');
const scrollToLatestBtn = document.getElementById('scrollToLatestBtn');
const messageInputPanel = document.getElementById('messageInputPanel');

const INIT_CONFIG_PANEL_OPEN_KEY = 'httpClient.initConfigPanelOpen';
const MCP_CONFIG_PANEL_OPEN_KEY = 'httpClient.mcpConfigPanelOpen';

function getStoredPanelOpen(storageKey, defaultOpen) {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return defaultOpen;
    return saved === 'true';
}

function setCompactPanelOpen(body, arrow, isOpen) {
    if (body) body.style.display = isOpen ? 'block' : 'none';
    if (arrow) arrow.classList.toggle('open', isOpen);
}

function initCompactPanelToggle(toggle, body, arrow, storageKey, defaultOpen) {
    if (!toggle || !body) return;
    setCompactPanelOpen(body, arrow, getStoredPanelOpen(storageKey, defaultOpen));
    toggle.addEventListener('click', () => {
        const nextOpen = body.style.display === 'none';
        setCompactPanelOpen(body, arrow, nextOpen);
        localStorage.setItem(storageKey, String(nextOpen));
    });
}

// 初始化配置折叠面板
const configPanelToggle = document.getElementById('configPanelToggle');
const configPanelBody = document.getElementById('configPanelBody');
const configPanelArrow = document.getElementById('configPanelArrow');
initCompactPanelToggle(configPanelToggle, configPanelBody, configPanelArrow, INIT_CONFIG_PANEL_OPEN_KEY, false);

// ── MCP 配置面板 ──────────────────────────────────────────────────────────────

/** 服务器配置表：{ [name]: configObj } */
let mcpServersConfig = {};
/** 启用状态表：{ [name]: boolean } */
let mcpEnabledStates = {};
/** 当前视图模式 */
let mcpViewMode = 'list';

/** 从 localStorage 加载 MCP 状态 */
function loadMcpState() {
    try {
        const raw = localStorage.getItem('mcpServersConfig');
        mcpServersConfig = raw ? JSON.parse(raw) : {};
    } catch (e) {
        mcpServersConfig = {};
    }
    try {
        const raw = localStorage.getItem('mcpEnabledStates');
        mcpEnabledStates = raw ? JSON.parse(raw) : {};
    } catch (e) {
        mcpEnabledStates = {};
    }
    // 补全缺失的 enabled 状态：默认启用
    for (const name of Object.keys(mcpServersConfig)) {
        if (mcpEnabledStates[name] === undefined) {
            mcpEnabledStates[name] = true;
        }
    }
}

/** 保存 MCP 状态到 localStorage */
function saveMcpState() {
    localStorage.setItem('mcpServersConfig', JSON.stringify(mcpServersConfig));
    localStorage.setItem('mcpEnabledStates', JSON.stringify(mcpEnabledStates));
}

/** 更新面板头部徽标 */
function updateMcpBadge() {
    const badge = document.getElementById('mcpPanelBadge');
    if (!badge) return;
    const total = Object.keys(mcpServersConfig).length;
    const enabled = Object.keys(mcpServersConfig).filter(n => mcpEnabledStates[n]).length;
    if (total === 0) {
        badge.textContent = '';
        badge.classList.remove('has-enabled');
    } else {
        badge.textContent = `启用 ${enabled} / 共 ${total}`;
        badge.classList.toggle('has-enabled', enabled > 0);
    }
}

/** 渲染列表视图 */
function renderMcpList() {
    const listEl = document.getElementById('mcpServerList');
    const emptyEl = document.getElementById('mcpListEmpty');
    if (!listEl) return;
    listEl.innerHTML = '';
    const names = Object.keys(mcpServersConfig);
    if (names.length === 0) {
        if (emptyEl) emptyEl.style.display = '';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    for (const name of names) {
        const cfg = mcpServersConfig[name];
        const enabled = !!mcpEnabledStates[name];
        const isHttp = (cfg.type || '').toLowerCase() === 'http';
        const meta = isHttp ? (cfg.url || '') : (cfg.command || '');
        const typeLabel = isHttp ? 'HTTP' : 'stdio';
        const typeClass = isHttp ? '' : 'stdio';

        const item = document.createElement('div');
        item.className = `mcp-server-item${enabled ? ' enabled' : ''}`;
        item.innerHTML = `
            <div class="mcp-server-item-header">
                <span class="mcp-server-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                <span class="mcp-server-type ${typeClass}">${typeLabel}</span>
                <label class="mcp-server-toggle" title="${enabled ? '点击禁用' : '点击启用'}">
                    <input type="checkbox" ${enabled ? 'checked' : ''} data-name="${escapeHtml(name)}">
                    <span class="mcp-toggle-slider"></span>
                </label>
            </div>
            <div class="mcp-server-meta" title="${escapeHtml(meta)}">${escapeHtml(meta)}</div>
        `;
        item.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
            const n = e.target.getAttribute('data-name');
            mcpEnabledStates[n] = e.target.checked;
            item.classList.toggle('enabled', e.target.checked);
            saveMcpState();
            updateMcpBadge();
        });
        listEl.appendChild(item);
    }
}

/** 将当前配置序列化到 JSON textarea */
function syncListToJson() {
    const el = document.getElementById('mcpJsonInput');
    if (!el) return;
    el.value = Object.keys(mcpServersConfig).length > 0
        ? JSON.stringify(mcpServersConfig, null, 2)
        : '';
}

/** 从 JSON textarea 解析配置并更新列表，返回是否成功 */
function syncJsonToList() {
    const el = document.getElementById('mcpJsonInput');
    if (!el) return true;
    const raw = el.value.trim();
    if (!raw) {
        mcpServersConfig = {};
        saveMcpState();
        return true;
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('顶层应为对象');
        }
        // 对每个服务器补全 name 字段
        for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'object' && v !== null) {
                parsed[k] = Object.assign({ name: k }, v);
            }
        }
        mcpServersConfig = parsed;
        // 补全缺失的 enabled 状态
        for (const name of Object.keys(mcpServersConfig)) {
            if (mcpEnabledStates[name] === undefined) {
                mcpEnabledStates[name] = true;
            }
        }
        saveMcpState();
        return true;
    } catch (e) {
        showSystemMessage(`MCP JSON 格式错误: ${e.message}`);
        return false;
    }
}

/** 构建发送用的 mcp_config（只包含启用的服务器），无启用服务器时返回 null */
function buildMcpConfig() {
    const enabledServers = {};
    for (const [name, cfg] of Object.entries(mcpServersConfig)) {
        if (mcpEnabledStates[name]) {
            enabledServers[name] = cfg;
        }
    }
    if (Object.keys(enabledServers).length === 0) return null;
    return { mcpServers: enabledServers };
}

/** 切换 MCP 视图模式 */
function switchMcpView(mode) {
    if (mode === mcpViewMode) return;
    if (mode === 'json') {
        // 列表 → JSON：先同步内容到 textarea
        syncListToJson();
    } else {
        // JSON → 列表：先解析 textarea
        if (!syncJsonToList()) return;
        renderMcpList();
        updateMcpBadge();
    }
    mcpViewMode = mode;
    document.getElementById('mcpListView').style.display = mode === 'list' ? '' : 'none';
    document.getElementById('mcpJsonView').style.display = mode === 'json' ? '' : 'none';
    document.getElementById('mcpListTab').classList.toggle('active', mode === 'list');
    document.getElementById('mcpJsonTab').classList.toggle('active', mode === 'json');
}

/** 简单 HTML 转义 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** 初始化 MCP 面板 */
function initMcpPanel() {
    loadMcpState();

    const toggle = document.getElementById('mcpPanelToggle');
    const body = document.getElementById('mcpPanelBody');
    const arrow = document.getElementById('mcpPanelArrow');
    initCompactPanelToggle(toggle, body, arrow, MCP_CONFIG_PANEL_OPEN_KEY, false);

    const listTab = document.getElementById('mcpListTab');
    const jsonTab = document.getElementById('mcpJsonTab');
    if (listTab) listTab.addEventListener('click', () => switchMcpView('list'));
    if (jsonTab) jsonTab.addEventListener('click', () => switchMcpView('json'));

    // JSON 输入框失焦时自动验证（不切换视图，只提示错误）
    const jsonInput = document.getElementById('mcpJsonInput');
    if (jsonInput) {
        jsonInput.addEventListener('blur', () => {
            const raw = jsonInput.value.trim();
            if (!raw) return;
            try {
                JSON.parse(raw);
            } catch (e) {
                showSystemMessage(`MCP JSON 格式错误: ${e.message}`);
            }
        });
    }

    // 全屏编辑弹窗
    const expandBtn = document.getElementById('mcpExpandBtn');
    const modal = document.getElementById('mcpJsonModal');
    const modalInput = document.getElementById('mcpModalJsonInput');
    const modalSaveBtn = document.getElementById('mcpModalSaveBtn');
    const modalCloseBtn = document.getElementById('mcpModalCloseBtn');

    if (expandBtn && modal && modalInput) {
        expandBtn.addEventListener('click', () => {
            // 将当前 textarea 内容同步到弹窗
            modalInput.value = jsonInput ? jsonInput.value : '';
            modal.style.display = 'flex';
            setTimeout(() => modalInput.focus(), 50);
        });

        const closeMcpModal = () => {
            modal.style.display = 'none';
        };

        modalSaveBtn.addEventListener('click', () => {
            const raw = modalInput.value.trim();
            // 验证 JSON
            if (raw) {
                try {
                    JSON.parse(raw);
                } catch (e) {
                    showSystemMessage(`MCP JSON 格式错误: ${e.message}`);
                    return;
                }
            }
            // 同步回小 textarea
            if (jsonInput) jsonInput.value = raw;
            closeMcpModal();
        });

        modalCloseBtn.addEventListener('click', closeMcpModal);

        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeMcpModal();
        });

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeMcpModal();
            }
        });
    }

    renderMcpList();
    updateMcpBadge();
}

// ── MCP 配置面板 end ──────────────────────────────────────────────────────────

// 消息类型枚举
const MessageType = {
    CHAT: "chat",
    INIT: "init"
};

// 上下文类型枚举
const ContextType = {
    NORMAL: "normal",
    INTERRUPT: "interrupt"
};

// 任务模式枚举（保留兼容性）
const TaskMode = {
    CHAT: "chat",
    PLAN: "plan"
};

// Agent模式枚举
const AgentMode = {
    GENERAL: "general",
    MAGIC: "magic",
    PPT: "ppt",
    DATA_ANALYSIS: "data_analysis",
    SUMMARY: "summary",
    SUMMARY_CHAT: "summary-chat",
    SUMMARY_VIDEO: "summary-video",
    DESIGN: "design",
    TEST: "test",
    SKILL: "skill",
    AGENT_MASTER: "agent-master"
};

// 根据操作系统显示快捷键提示
function initSendHint() {
    const hint = document.getElementById('sendHint');
    if (!hint) return;
    hint.innerHTML = 'Enter 发送<br>Shift+Enter 换行';
}

// 拖拽调整大小功能
function initResizers() {
    // 侧边栏拖拽
    const sidebar = document.querySelector('.sidebar');
    const sidebarResizer = document.getElementById('sidebarResizer');
    const mainContent = document.querySelector('.main-content');
    const chatContainer = document.querySelector('.chat-container');
    const previewChatResizer = document.getElementById('previewChatResizer');

    let isResizingSidebar = false;
    let isResizingPreviewChat = false;
    let startX;
    let startWidth;
    let startChatWidth;

    // 从 localStorage 恢复侧边栏宽度
    const savedSidebarWidth = localStorage.getItem('sidebarWidth');
    if (savedSidebarWidth) {
        sidebar.style.width = savedSidebarWidth + 'px';
    }
    const savedPreviewChatWidth = Number(localStorage.getItem(PREVIEW_CHAT_WIDTH_KEY));
    if (mainContent && Number.isFinite(savedPreviewChatWidth) && savedPreviewChatWidth > 0) {
        mainContent.style.setProperty('--preview-chat-width', `${savedPreviewChatWidth}px`);
    }

    sidebarResizer.addEventListener('mousedown', function(e) {
        isResizingSidebar = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);

        sidebarResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        // 防止拖拽时选中文本
        e.preventDefault();
    });

    if (previewChatResizer && chatContainer && mainContent) {
        previewChatResizer.addEventListener('mousedown', function(e) {
            if (!mainContent.classList.contains('main-content-preview-open')) return;
            isResizingPreviewChat = true;
            startX = e.clientX;
            startChatWidth = chatContainer.getBoundingClientRect().width;
            previewChatResizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
    }

    // 输入框拖拽
    const inputPanel = document.getElementById('messageInputPanel');
    const inputResizer = document.getElementById('inputResizer');
    const messagesContainer = document.getElementById('messagesContainer');

    let isResizingInput = false;
    let startY;
    let startHeight;

    // 从 localStorage 恢复输入框高度
    const savedInputHeight = localStorage.getItem('inputHeight');
    if (savedInputHeight) {
        inputPanel.style.height = savedInputHeight + 'px';
    }

    inputResizer.addEventListener('mousedown', function(e) {
        isResizingInput = true;
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(inputPanel).height, 10);

        inputResizer.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    // 全局鼠标移动和松开事件
    document.addEventListener('mousemove', function(e) {
        if (isResizingSidebar) {
            const newWidth = startWidth + (e.clientX - startX);
            // 限制最小和最大宽度
            if (newWidth > 200 && newWidth < 800) {
                sidebar.style.width = newWidth + 'px';
            }
        }

        if (isResizingPreviewChat && mainContent) {
            const mainRect = mainContent.getBoundingClientRect();
            const nextWidth = startChatWidth - (e.clientX - startX);
            const minWidth = 340;
            const maxWidth = Math.max(minWidth, Math.min(720, mainRect.width * 0.58));
            const clamped = Math.min(Math.max(nextWidth, minWidth), maxWidth);
            mainContent.style.setProperty('--preview-chat-width', `${Math.round(clamped)}px`);
            updateScrollButtonPosition();
        }

        if (isResizingInput) {
            // 向上拖拽是增加高度，所以是减去差值
            const newHeight = startHeight - (e.clientY - startY);
            // 限制最小和最大高度
            if (newHeight > 180 && newHeight < window.innerHeight * 0.8) {
                inputPanel.style.height = newHeight + 'px';
                updateScrollButtonPosition();
            }
        }
    });

    document.addEventListener('mouseup', function() {
        if (isResizingSidebar) {
            isResizingSidebar = false;
            sidebarResizer.classList.remove('resizing');
            document.body.style.cursor = '';
            // 保存到 localStorage
            localStorage.setItem('sidebarWidth', sidebar.style.width.replace('px', ''));
        }

        if (isResizingPreviewChat) {
            isResizingPreviewChat = false;
            if (previewChatResizer) previewChatResizer.classList.remove('resizing');
            document.body.style.cursor = '';
            const current = mainContent?.style.getPropertyValue('--preview-chat-width').replace('px', '').trim();
            if (current) localStorage.setItem(PREVIEW_CHAT_WIDTH_KEY, current);
        }

        if (isResizingInput) {
            isResizingInput = false;
            inputResizer.classList.remove('resizing');
            document.body.style.cursor = '';
            // 保存到 localStorage
            localStorage.setItem('inputHeight', inputPanel.style.height.replace('px', ''));
        }
    });
}

const customSelectRegistry = new Map();

function initCustomSelects() {
    document.querySelectorAll('.input-controls-row select.agent-mode-select').forEach(enhanceSelect);
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.custom-select') && !event.target.closest('.custom-select-panel')) {
            closeAllCustomSelects();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeAllCustomSelects();
    });
    window.addEventListener('resize', positionOpenCustomSelect);
    window.addEventListener('scroll', positionOpenCustomSelect, true);
}

function enhanceSelect(select) {
    if (!select || customSelectRegistry.has(select)) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    wrapper.dataset.selectId = select.id || '';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';

    const value = document.createElement('span');
    value.className = 'custom-select-value';
    const arrow = document.createElement('span');
    arrow.className = 'custom-select-arrow';
    arrow.textContent = '▾';
    trigger.append(value, arrow);

    const panel = document.createElement('div');
    panel.className = 'custom-select-panel';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'custom-select-search';
    search.placeholder = '搜索选项...';
    const list = document.createElement('div');
    list.className = 'custom-select-list';
    panel.append(search, list);

    select.classList.add('custom-select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.insertAdjacentElement('afterend', wrapper);
    document.body.appendChild(panel);
    wrapper.appendChild(trigger);

    const state = { select, wrapper, trigger, value, arrow, panel, search, list, observer: null };
    customSelectRegistry.set(select, state);

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCustomSelect(select);
    });
    search.addEventListener('input', () => renderCustomSelectOptions(state, search.value));
    select.addEventListener('change', () => refreshCustomSelect(select));

    state.observer = new MutationObserver(() => refreshCustomSelect(select));
    state.observer.observe(select, {
        attributes: true,
        attributeFilter: ['style', 'disabled'],
        childList: true,
        subtree: true,
    });

    refreshCustomSelect(select);
}

function toggleCustomSelect(select) {
    const state = customSelectRegistry.get(select);
    if (!state || select.disabled || select.style.display === 'none') return;

    if (state.wrapper.classList.contains('open')) {
        closeCustomSelect(state);
        return;
    }

    closeAllCustomSelects();
    state.wrapper.classList.add('open');
    state.panel.classList.add('open');
    state.search.value = '';
    renderCustomSelectOptions(state, '');
    positionCustomSelectPanel(state);

    if (select.options.length > 8) {
        state.search.style.display = '';
        state.search.focus({ preventScroll: true });
    } else {
        state.search.style.display = 'none';
        state.trigger.focus({ preventScroll: true });
    }
}

function refreshCustomSelect(select) {
    const state = customSelectRegistry.get(select);
    if (!state) return;

    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    state.value.textContent = selectedOption ? selectedOption.textContent : '';
    state.value.title = selectedOption ? selectedOption.textContent : '';
    state.wrapper.style.display = select.style.display === 'none' ? 'none' : '';
    state.wrapper.classList.toggle('disabled', select.disabled);
    if (select.style.display === 'none' || select.disabled) {
        closeCustomSelect(state);
    }
}

function renderCustomSelectOptions(state, keyword) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    state.list.innerHTML = '';

    const options = Array.from(state.select.options);
    const matchedOptions = options.filter(option => {
        if (!normalizedKeyword) return true;
        return option.textContent.toLowerCase().includes(normalizedKeyword) ||
            option.value.toLowerCase().includes(normalizedKeyword);
    });

    if (matchedOptions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'custom-select-empty';
        empty.textContent = '没有匹配选项';
        state.list.appendChild(empty);
        return;
    }

    matchedOptions.forEach(option => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-select-option';
        item.title = option.textContent;
        item.disabled = option.disabled;
        item.classList.toggle('selected', option.value === state.select.value);

        const { title, detail } = splitCustomSelectLabel(option.textContent);
        const titleEl = document.createElement('span');
        titleEl.className = 'custom-select-option-title';
        titleEl.textContent = title;
        item.appendChild(titleEl);
        if (detail) {
            const detailEl = document.createElement('span');
            detailEl.className = 'custom-select-option-detail';
            detailEl.textContent = detail;
            item.appendChild(detailEl);
        }

        item.addEventListener('click', () => {
            state.select.value = option.value;
            state.select.dispatchEvent(new Event('change', { bubbles: true }));
            refreshCustomSelect(state.select);
            closeCustomSelect(state);
        });
        state.list.appendChild(item);
    });
}

function splitCustomSelectLabel(label) {
    const match = label.match(/^(.*?)\s*\(([^()]*)\)$/);
    if (!match) return { title: label, detail: '' };
    return {
        title: match[1].trim() || label,
        detail: match[2].trim(),
    };
}

function positionOpenCustomSelect() {
    for (const state of customSelectRegistry.values()) {
        if (state.wrapper.classList.contains('open')) {
            positionCustomSelectPanel(state);
        }
    }
}

function positionCustomSelectPanel(state) {
    const rect = state.trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const preferWidth = state.select.id === 'modelIdSelect' ? 420 : 300;
    const width = Math.min(Math.max(rect.width, preferWidth), window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const belowSpace = viewportHeight - rect.bottom - 8;
    const aboveSpace = rect.top - 8;
    const openAbove = belowSpace < 240 && aboveSpace > belowSpace;
    const maxHeight = Math.min(340, Math.max(180, (openAbove ? aboveSpace : belowSpace) - 8));

    state.panel.style.width = `${width}px`;
    state.panel.style.left = `${left}px`;
    state.panel.style.maxHeight = `${maxHeight}px`;
    if (openAbove) {
        state.panel.style.top = '';
        state.panel.style.bottom = `${viewportHeight - rect.top + 6}px`;
    } else {
        state.panel.style.top = `${rect.bottom + 6}px`;
        state.panel.style.bottom = '';
    }
}

function closeAllCustomSelects() {
    customSelectRegistry.forEach(closeCustomSelect);
}

function closeCustomSelect(state) {
    state.wrapper.classList.remove('open');
    state.panel.classList.remove('open');
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
    // 初始化拖拽功能
    initResizers();

    // 初始化 MCP 配置面板
    initMcpPanel();

    // 初始化快捷键提示
    initSendHint();

    // 初始化消息滚动控制
    initMessageScrollControls();

    // 初始化输入栏自定义选择器
    initCustomSelects();

    restoreInputDrafts();

    // 原始事件默认隐藏，用户打开后才展示调试事件盒
    initRawEventsToggle();

    // 新用户首次进入时展示中间文件预览占位；老用户保留既有状态
    if (!restorePersistedVirtualToolDetailPreview()) {
        initFirstOpenFilePreviewPlaceholder();
    }

    // Enter 发送，Shift+Enter 换行
    // isComposing 用于屏蔽输入法合成过程中的 Enter（避免确认候选字时误触发发送）
    const messageInputEl = document.getElementById('messageInput');
    if (messageInputEl) {
        messageInputEl.addEventListener('keydown', function(e) {
            if (e.isComposing) return;
            if (handleMentionPickerKeydown(e)) return;
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(ContextType.NORMAL);
            }
        });
        messageInputEl.addEventListener('input', () => {
            saveTextDraft(MESSAGE_INPUT_DRAFT_KEY, messageInputEl.value);
            syncMentionPickerFromInput();
        });
        messageInputEl.addEventListener('click', () => {
            syncMentionPickerFromInput();
        });
        messageInputEl.addEventListener('keyup', () => {
            syncMentionPickerFromInput();
        });
        messageInputEl.addEventListener('blur', () => {
            setTimeout(() => {
                const ae = document.activeElement;
                if (ae && mentionPickerEl && mentionPickerEl.contains(ae)) return;
                closeMentionPicker();
            }, 180);
        });
    }

    const rawJsonInput = document.getElementById('rawJsonInput');
    if (rawJsonInput) {
        rawJsonInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                sendMessage(ContextType.NORMAL);
            }
        });
        rawJsonInput.addEventListener('input', () => {
            saveTextDraft(RAW_JSON_INPUT_DRAFT_KEY, rawJsonInput.value);
        });
    }

    // 先加载历史记录
    loadMessageHistory();
    console.log("DOM加载完成，已加载历史记录，数量:", messageHistory.length);

    // 恢复对话消息
    restoreChatLog();

    // 初始化消息按钮事件
    const sendInitBtn = document.getElementById('sendInitBtn');
    if (sendInitBtn) {
        sendInitBtn.addEventListener('click', sendInitMessage);
    }

    // 消息发送按钮事件
    sendBtn.addEventListener('click', () => sendMessage(ContextType.NORMAL));

    // 中断按钮事件
    interruptBtn.addEventListener('click', () => sendInterrupt());

    // 清除对话按钮事件
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            showConfirmDialog('确定要清除所有对话消息吗？', async () => {
                clearChatLog();
                clearToolDetailPreviewTab();
                messageList.innerHTML = '';
                resetConnectionStatusLog();
                const historyCleared = await clearRemoteChatHistory();
                if (historyCleared) {
                    showSystemMessage('对话、工具详情、历史文件和运行时状态已清除', true);
                } else {
                    showSystemMessage('本地对话已清除，但历史文件清理失败', true);
                }
            });
        });
    }

    // Agent模式切换事件
    if (agentModeSelect) {
        agentModeSelect.addEventListener('change', changeAgentMode);
    }

    // 高级模式切换事件
    if (advancedModeToggle) {
        advancedModeToggle.addEventListener('change', toggleAdvancedMode);
    }

    // IM 渠道模拟模式切换事件
    if (imModeToggle) {
        imModeToggle.addEventListener('change', toggleImMode);
    }
    if (imChannelSelect) {
        imChannelSelect.addEventListener('change', () => {
            currentImChannel = imChannelSelect.value;
        });
    }

    // 语言切换事件
    if (languageSelect) {
        // 从 localStorage 恢复上次选择的语言
        const savedLanguage = localStorage.getItem('selectedLanguage');
        if (savedLanguage) {
            currentLanguage = savedLanguage;
            languageSelect.value = savedLanguage;
        }
        currentLanguage = languageSelect.value || currentLanguage;
        refreshCustomSelect(languageSelect);
        languageSelect.addEventListener('change', changeLanguage);
    }

    // 消息版本切换事件
    if (messageVersionSelect) {
        const savedVersion = localStorage.getItem('selectedMessageVersion');
        if (savedVersion !== null) {
            currentMessageVersion = savedVersion;
            messageVersionSelect.value = savedVersion;
        }
        currentMessageVersion = messageVersionSelect.value;
        refreshCustomSelect(messageVersionSelect);
        messageVersionSelect.addEventListener('change', changeMessageVersion);
    }

    // 保留任务模式切换事件（兼容性）
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleTaskMode);

        // 初始化任务模式为 Plan 模式
        const toggleContainer = document.getElementById('modeToggle');
        const planOption = toggleContainer.querySelector('.toggle-option.plan');
        const chatOption = toggleContainer.querySelector('.toggle-option.chat');

        toggleContainer.classList.add('plan-active');
        planOption.classList.add('active');
        chatOption.classList.remove('active');
    }

    // 历史消息按钮事件
    const historyButton = document.getElementById('historyBtn');
    if (historyButton) {
        historyButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleHistoryDropdown(true);
            showMessageHistory();
            return false;
        });
    }

    // 配置文件上传事件
    configFileInput.addEventListener('change', handleConfigFileUpload);

    // 消息订阅按钮事件
    const subscribeBtn = document.getElementById('subscribeBtn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', toggleWebSocketConnection);
    }

    // 刷新模型列表按钮事件
    const refreshModelsBtn = document.getElementById('refreshModelsBtn');
    if (refreshModelsBtn) {
        refreshModelsBtn.addEventListener('click', refreshModelList);
    }

    // 清理模型列表按钮事件
    const clearModelsBtn = document.getElementById('clearModelsBtn');
    if (clearModelsBtn) {
        clearModelsBtn.addEventListener('click', clearModelList);
    }

    // 启用消息按钮（不再需要先测试连接）
    toggleMessageControls(true);

    // 从 localStorage 恢复上次加载的模型列表
    restoreModelSelects();

    // 设置默认配置
    setupDefaultConfigs();

    // 初始隐藏文件名显示
    currentFileNameDisplay.style.display = 'none';

    // 页面加载后自动尝试订阅 WebSocket
    autoConnectWebSocket();
    connectSocketIoStreamFromConfig();
});

// 清理模型列表：清除 localStorage 缓存并恢复文本输入框
function clearModelList() {
    localStorage.removeItem('availableModels');
    localStorage.removeItem('availableImageModels');
    localStorage.removeItem('selectedModelId');
    localStorage.removeItem('selectedImageModelId');

    if (modelIdSelect) {
        modelIdSelect.innerHTML = '<option value="">选择文本模型（留空默认）</option>';
        modelIdSelect.style.display = 'none';
    }
    if (modelIdInput) {
        modelIdInput.style.display = '';
        modelIdInput.value = '';
    }
    if (imageModelSelect) {
        imageModelSelect.innerHTML = '<option value="">不指定图片模型</option>';
        refreshCustomSelect(imageModelSelect);
    }
    const imageModelGroup = document.getElementById('imageModelGroup');
    if (imageModelGroup) imageModelGroup.style.display = 'none';
    refreshCustomSelect(modelIdSelect);

    showSystemMessage('模型列表已清理');
}

// 刷新模型列表：调用后端接口，将结果缓存到 localStorage 并填充下拉框
async function refreshModelList() {
    const btn = document.getElementById('refreshModelsBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '正在刷新...';
    }
    try {
        const serverUrl = serverUrlInput.value.trim() || 'http://127.0.0.1:8002';
        const resp = await fetch(`${serverUrl}/api/v1/models`);
        const json = await resp.json();
        if (!resp.ok || json.code !== 1000) {
            showSystemMessage(`刷新模型列表失败: ${json.message || resp.status}`);
            return;
        }
        const allModels = json.data && json.data.models ? json.data.models : [];
        const textModels = allModels.filter(m => m.object === 'model');
        const imageModels = allModels.filter(m => m.object === 'image');

        localStorage.setItem('availableModels', JSON.stringify(textModels));
        localStorage.setItem('availableImageModels', JSON.stringify(imageModels));

        populateModelSelects(textModels, imageModels);
        showSystemMessage(`模型列表已刷新：${textModels.length} 个文本模型，${imageModels.length} 个图片模型`);
    } catch (e) {
        showSystemMessage(`刷新模型列表异常: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '刷新模型列表';
        }
    }
}

// 从 localStorage 恢复模型下拉框（页面刷新后保持状态）
function restoreModelSelects() {
    const textModels = JSON.parse(localStorage.getItem('availableModels') || '[]');
    const imageModels = JSON.parse(localStorage.getItem('availableImageModels') || '[]');
    if (textModels.length > 0 || imageModels.length > 0) {
        populateModelSelects(textModels, imageModels);
    }
}

// 填充文本模型和图片模型下拉框
function populateModelSelects(textModels, imageModels) {
    // 文本模型：仅展示同时满足 chat、multi_modal、function_call 均为 true 的模型
    // 动态模型（id !== resolved_model_id）排在后面
    const filteredTextModels = textModels
        .filter(m => {
            const opts = m.info && m.info.options;
            return opts && opts.chat === true && opts.function_call === true;
        })
        .sort((a, b) => {
            const aResolved = (a.info && a.info.attributes && a.info.attributes.resolved_model_id) || a.id;
            const bResolved = (b.info && b.info.attributes && b.info.attributes.resolved_model_id) || b.id;
            const aIsDynamic = a.id !== aResolved ? 1 : 0;
            const bIsDynamic = b.id !== bResolved ? 1 : 0;
            return aIsDynamic - bIsDynamic;
        });

    if (modelIdSelect) {
        const prevValue = modelIdSelect.value;
        modelIdSelect.innerHTML = '<option value="">选择文本模型（留空默认）</option>';
        filteredTextModels.forEach(m => {
            const attrs = m.info && m.info.attributes;
            const label = attrs && attrs.label ? attrs.label.trim() : m.id;
            const resolvedId = attrs && attrs.resolved_model_id ? attrs.resolved_model_id : m.id;
            const idDisplay = resolvedId !== m.id ? `${resolvedId}|${m.id}` : m.id;
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${label} (${idDisplay})`;
            modelIdSelect.appendChild(opt);
        });
        // 恢复上次选择
        const savedTextModel = localStorage.getItem('selectedModelId');
        if (savedTextModel) modelIdSelect.value = savedTextModel;
        else if (prevValue) modelIdSelect.value = prevValue;

        // 切换显示：有模型时用 select，否则保留文本框
        if (filteredTextModels.length > 0) {
            modelIdSelect.style.display = '';
            modelIdInput.style.display = 'none';
        } else {
            modelIdSelect.style.display = 'none';
            modelIdInput.style.display = '';
        }

        // 记住选择变更
        modelIdSelect.onchange = () => {
            localStorage.setItem('selectedModelId', modelIdSelect.value);
        };
        refreshCustomSelect(modelIdSelect);
    }

    // 图片模型
    if (imageModelSelect) {
        const prevImageValue = imageModelSelect.value;
        imageModelSelect.innerHTML = '<option value="">不指定图片模型</option>';
        imageModels.forEach(m => {
            const attrs = m.info && m.info.attributes;
            const label = attrs && attrs.label ? attrs.label : m.id;
            const resolvedId = attrs && attrs.resolved_model_id ? attrs.resolved_model_id : m.id;
            const idDisplay = resolvedId !== m.id ? `${resolvedId}|${m.id}` : m.id;
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${label} (${idDisplay})`;
            imageModelSelect.appendChild(opt);
        });
        // 恢复上次选择
        const savedImageModel = localStorage.getItem('selectedImageModelId');
        if (savedImageModel) imageModelSelect.value = savedImageModel;
        else if (prevImageValue) imageModelSelect.value = prevImageValue;

        // 记住选择变更
        imageModelSelect.onchange = () => {
            localStorage.setItem('selectedImageModelId', imageModelSelect.value);
        };
        refreshCustomSelect(imageModelSelect);
    }

    // 图片模型组：非 IM 模式下显示
    const imageModelGroup = document.getElementById('imageModelGroup');
    if (imageModelGroup && !isImMode) {
        imageModelGroup.style.display = imageModels.length > 0 ? '' : 'none';
    }
}

// 设置默认配置
function setupDefaultConfigs() {
    // 尝试从 localStorage 加载保存的配置
    const savedConfig = localStorage.getItem('savedConfigContent');
    const savedFileName = localStorage.getItem('savedConfigFileName');

    if (savedConfig) {
        uploadConfigContent.value = savedConfig;
        if (savedFileName) {
            currentFileName = savedFileName;
            updateFileNameDisplay();
        }
    } else {
        uploadConfigContent.value = "请上传配置文件";
    }

    // 允许编辑，方便用户微调配置
    uploadConfigContent.readOnly = false;

    // 监听内容变化并保存
    uploadConfigContent.addEventListener('input', function() {
        if (this.value && this.value !== "请上传配置文件") {
            try {
                // 尝试解析验证 JSON
                JSON.parse(this.value);
                localStorage.setItem('savedConfigContent', this.value);
                scheduleSocketIoReconnectFromConfig();
            } catch (e) {
                // 如果格式不对，不保存，但也不报错，允许用户继续编辑
            }
        }
    });
}

// 发送HTTP请求到消息端点
async function sendHttpMessage(messageData) {
    // 直接从输入框获取服务器地址
    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
        showSystemMessage("请输入服务器地址后再发送消息");
        return null;
    }

    try {
        applyLocalDebugOptions(messageData);
        const response = await fetch(`${serverUrl}/api/v1/messages/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });

        // 根据响应结果更新连接状态
        if (response.ok) {
            // 连接成功，无需状态显示
        } else {
            showSystemMessage(`服务器响应错误: HTTP ${response.status}`);
        }

        const responseData = await response.json();

        // 用可展开日志展示 HTTP 响应
        const label = responseData.code === 1000
            ? `HTTP 响应: ${responseData.message}`
            : `HTTP 响应 (${responseData.code}): ${responseData.message || '未知'}`;
        showEventLog({ label, ...responseData });

        return responseData;
    } catch (error) {
        showSystemMessage(`连接失败: ${error.message}。请检查服务器地址是否正确。`);
        return null;
    }
}

async function clearRemoteChatHistory() {
    const serverUrl = (serverUrlInput.value.trim() || 'http://127.0.0.1:8002').replace(/\/+$/, '');

    try {
        const response = await fetch(`${serverUrl}/api/v1/debug/clear-chat-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.code !== 1000) {
            console.warn('清理历史文件失败:', json || response.status);
            return false;
        }
        showEventLog({
            label: 'debug clear-chat-history result',
            ...(json || {}),
        });
        return true;
    } catch (e) {
        console.warn('清理历史文件请求失败:', e);
        return false;
    }
}

function applyLocalDebugOptions(messageData) {
    if (!messageData || typeof messageData !== 'object') return;
    messageData.dynamic_config = Object.assign({}, messageData.dynamic_config, {
        enable_debug_tool_result_content: true,
    });
    if (currentMessageVersion) {
        messageData.dynamic_config.message_version = currentMessageVersion;
    } else {
        delete messageData.dynamic_config.message_version;
    }
}

// 发送消息
async function sendMessage(contextType = ContextType.NORMAL) {
    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
        showSystemMessage("请输入服务器地址");
        return;
    }

    try {
        await ensureWebSocketConnected();
    } catch (e) {
        return; // 连接失败时终止，错误已由 ensureWebSocketConnected 提示
    }

    // 高级模式：直接发送原始 JSON
    if (isAdvancedMode) {
        const rawJson = rawJsonInput.value.trim();
        if (!rawJson) {
            showSystemMessage("请输入消息 JSON");
            return;
        }

        let messageData;
        try {
            messageData = JSON.parse(rawJson);
        } catch (e) {
            showSystemMessage(`JSON 格式错误: ${e.message}`);
            return;
        }

        // 自动刷新 message_id，避免触发后端去重
        messageData.message_id = generateTimestampId();

        showClientMessage(messageData);
        showAssistantActivity('thinking');
        const responseData = await sendHttpMessage(messageData);
        if (!responseData || responseData.code !== 1000) {
            hideAssistantActivity();
        }
        return;
    }

    // 普通模式：从各字段组装消息
    const message = messageInput.value.trim();
    if (!message) {
        showSystemMessage("请输入消息内容");
        return;
    }

    // IM 渠道模拟模式：只发最小字段
    let chatMessage;
    if (isImMode) {
        chatMessage = createImChatMessage(message);
    } else {
        chatMessage = createChatMessage(message, contextType);
    }

    // 显示客户端消息
    showClientMessage(chatMessage);
    showAssistantActivity('thinking');

    // 清空输入框
    messageInput.value = '';
    clearMessageInputDraft();

    // 保存到历史记录
    saveMessageToHistory(message);

    // 发送HTTP请求
    const responseData = await sendHttpMessage(chatMessage);
    if (!responseData || responseData.code !== 1000) {
        hideAssistantActivity();
    }
}

// 发送中断消息
async function sendInterrupt() {
    const interruptMessage = createChatMessage("", ContextType.INTERRUPT, "User interrupted the task.");
    hideAssistantActivity();

    // 显示客户端消息
    showClientMessage({
        ...interruptMessage,
        prompt: "[中断任务]"
    });

    // 发送HTTP请求
    await sendHttpMessage(interruptMessage);
}

// 发送初始化消息
async function sendInitMessage() {
    // 检查是否已上传配置文件
    if (!uploadConfigContent.value.trim() || uploadConfigContent.value === "请上传配置文件") {
        showSystemMessage("请先上传配置文件");
        return;
    }

    try {
        await ensureWebSocketConnected();
    } catch (e) {
        return;
    }

    try {
        // 解析配置内容
        const configData = JSON.parse(uploadConfigContent.value);
        connectSocketIoStreamFromConfig(configData);

        // 显示客户端消息
        showClientMessage({
            type: MessageType.INIT,
            prompt: "[初始化工作区]"
        });
        showAssistantActivity('thinking');

        showSystemMessage("正在发送工作区初始化消息...");

        // 发送HTTP请求
        const responseData = await sendHttpMessage(configData);
        if (!responseData || responseData.code !== 1000) {
            hideAssistantActivity();
        }
    } catch (error) {
        hideAssistantActivity();
        showSystemMessage(`初始化失败: ${error.message}`);
    }
}

// 处理配置文件上传
function handleConfigFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    currentFileName = file.name;
    updateFileNameDisplay();

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            // 验证JSON格式
            const content = e.target.result;
            JSON.parse(content); // 验证是否为有效JSON

            uploadConfigContent.value = content;

            // 保存到 localStorage
            localStorage.setItem('savedConfigContent', content);
            localStorage.setItem('savedConfigFileName', currentFileName);
            connectSocketIoStreamFromConfig();

            showSystemMessage(`配置文件 "${file.name}" 上传成功并已保存`);
        } catch (error) {
            showSystemMessage(`文件格式错误: ${error.message}`);
            // 如果解析失败，不覆盖原有内容
        }
    };
    reader.readAsText(file);
}

// 更新文件名显示
function updateFileNameDisplay() {
    if (currentFileName) {
        currentFileNameDisplay.textContent = `当前文件: ${currentFileName}`;
        currentFileNameDisplay.style.display = 'block';
    } else {
        currentFileNameDisplay.style.display = 'none';
    }
}

// 创建聊天消息
// 切换 IM 渠道模拟模式
function toggleImMode() {
    isImMode = imModeToggle.checked;

    const imChannelGroup = document.getElementById('imChannelGroup');
    const imUserIdGroup = document.getElementById('imUserIdGroup');
    const agentModeGroup = document.getElementById('agentModeGroup');
    const modelIdGroup = document.getElementById('modelIdGroup');
    const languageGroup = document.getElementById('languageGroup');
    const imageModelGroup = document.getElementById('imageModelGroup');

    if (isImMode) {
        // 显示 IM 专属控件，隐藏普通模式控件
        imChannelGroup.style.display = '';
        imUserIdGroup.style.display = '';
        agentModeGroup.style.display = 'none';
        if (agentCodeGroup) agentCodeGroup.style.display = 'none';
        modelIdGroup.style.display = 'none';
        languageGroup.style.display = 'none';
        if (imageModelGroup) imageModelGroup.style.display = 'none';
        // IM 模式与高级模式互斥
        if (isAdvancedMode) {
            advancedModeToggle.checked = false;
            toggleAdvancedMode();
        }
    } else {
        imChannelGroup.style.display = 'none';
        imUserIdGroup.style.display = 'none';
        agentModeGroup.style.display = '';
        modelIdGroup.style.display = '';
        languageGroup.style.display = '';
        // agentCodeGroup 的显示由 agent mode 决定，重新同步一次
        changeAgentMode();
        // 若模型列表已加载则恢复图片模型选择器
        if (imageModelGroup && localStorage.getItem('availableImageModels')) {
            imageModelGroup.style.display = '';
        }
    }
}

// 生成 IM 渠道风格的 message_id
function generateImMessageId(channel, userId) {
    const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    const id = hex() + hex();
    if (channel === 'wechat') {
        return `wechat-${userId || 'user'}-${id.slice(0, 16)}`;
    }
    return `${channel}_${id.slice(0, 16)}`;
}

// 构造最小 IM 渠道消息
function createImChatMessage(prompt) {
    const userId = (imUserIdInput ? imUserIdInput.value.trim() : '') || `${currentImChannel}_user`;
    const msg = {
        message_id: generateImMessageId(currentImChannel, userId),
        type: MessageType.CHAT,
        prompt: prompt,
        metadata: {
            agent_user_id: userId,
        },
    };
    const mentions = parsePromptMentions(prompt);
    if (mentions.length > 0) {
        msg.mentions = mentions;
        msg.mcp_config = { mcpServers: [] };
    }
    // MCP 面板配置优先级高于 mentions 的空配置
    const mcpCfg = buildMcpConfig();
    if (mcpCfg) {
        msg.mcp_config = mcpCfg;
    }
    return msg;
}

function createChatMessage(prompt, contextType = ContextType.NORMAL, remark = null) {
    const message = {
        message_id: generateTimestampId(),
        type: MessageType.CHAT,
        prompt: prompt,
        context_type: contextType,
        task_mode: currentTaskMode, // 保留兼容性
        agent_mode: currentAgentMode, // 新的 agent 模式
        attachments: [],
        metadata: {
            language: currentLanguage
        }
    };

    // 优先从模型下拉框读取，否则从文本输入框读取
    const modelIdFromSelect = modelIdSelect && modelIdSelect.style.display !== 'none';
    const modelId = modelIdFromSelect
        ? modelIdSelect.value.trim()
        : modelIdInput.value.trim();
    if (modelId) {
        message.model_id = modelId;
    }

    // 从下拉框选中模型时注入 dynamic_config.models
    if (modelIdFromSelect && modelId) {
        const textModels = JSON.parse(localStorage.getItem('availableModels') || '[]');
        const modelInfo = textModels.find(m => m.id === modelId);
        const opts = modelInfo && modelInfo.info && modelInfo.info.options;
        const temperature = opts
            ? (opts.fixed_temperature != null ? opts.fixed_temperature : (opts.default_temperature != null ? opts.default_temperature : 1.0))
            : 1.0;
        const supportsToolUse = opts ? opts.function_call === true : true;
        message.dynamic_config = Object.assign({}, message.dynamic_config, {
            models: {
                [modelId]: {
                    api_key: '${MAGIC_API_KEY}',
                    api_base_url: '${MAGIC_API_BASE_URL}',
                    name: modelId,
                    type: 'llm',
                    provider: 'openai',
                    supports_tool_use: supportsToolUse,
                    temperature,
                },
            },
        });
    }

    // 若选中了图片模型，注入 dynamic_config.image_model
    const selectedImageModelId = imageModelSelect ? imageModelSelect.value.trim() : '';
    if (selectedImageModelId) {
        const imageModels = JSON.parse(localStorage.getItem('availableImageModels') || '[]');
        const imageModelInfo = imageModels.find(m => m.id === selectedImageModelId);
        const sizes = imageModelInfo && imageModelInfo.info && imageModelInfo.info.image_size_config
            ? (imageModelInfo.info.image_size_config.sizes || [])
            : [];
        message.dynamic_config = Object.assign({}, message.dynamic_config, {
            image_model: { model_id: selectedImageModelId, sizes },
        });
    }

    // magiclaw 模式下从输入框读取 agent_code 注入 dynamic_config
    if (currentAgentMode === 'magiclaw' && agentCodeInput) {
        const agentCode = agentCodeInput.value.trim();
        if (agentCode) {
            message.dynamic_config = Object.assign({}, message.dynamic_config, { agent_code: agentCode });
        }
    }

    // 注入消息版本到 dynamic_config（为空时不传该字段）
    if (currentMessageVersion) {
        message.dynamic_config = Object.assign({}, message.dynamic_config, {
            message_version: currentMessageVersion,
        });
    }

    // Add remark field if provided
    if (remark !== null) {
        message.remark = remark;
    }

    const mentions = parsePromptMentions(prompt);
    if (mentions.length > 0) {
        message.mentions = mentions;
        message.mcp_config = { mcpServers: [] };
    }
    // MCP 面板配置优先级高于 mentions 的空配置
    const mcpCfg = buildMcpConfig();
    if (mcpCfg) {
        message.mcp_config = mcpCfg;
    }

    return message;
}

// 生成基于时间戳的简单消息ID
function generateTimestampId() {
    // 直接使用毫秒级时间戳，简单可靠
    return Date.now().toString();
}

// 切换消息控件状态
function toggleMessageControls(enabled) {
    if (!enabled) closeMentionPicker();
    sendBtn.disabled = !enabled;
    interruptBtn.disabled = !enabled;
    messageInput.disabled = !enabled;

    const sendInitBtn = document.getElementById('sendInitBtn');
    if (sendInitBtn) {
        sendInitBtn.disabled = !enabled;
    }
}

// 显示客户端消息
function showClientMessage(message) {
    const time = new Date().toLocaleTimeString();
    const imChannel = message.metadata && !message.agent_mode ? currentImChannel : '';
    const imUserId = imChannel && message.metadata ? (message.metadata.agent_user_id || '') : '';
    pushLog({
        type: 'client',
        prompt: message.prompt || '',
        agentMode: message.agent_mode || '',
        modelId: message.model_id || '',
        imChannel,
        imUserId,
        time,
    });
    renderClientEntry({
        type: 'client',
        prompt: message.prompt || '',
        agentMode: message.agent_mode || '',
        modelId: message.model_id || '',
        imChannel,
        imUserId,
        time,
    }, { forceScroll: true });
}

// 显示服务器消息
function showServerMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message server';

    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    messageHeader.textContent = `服务器响应 (${new Date().toLocaleTimeString()})`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = JSON.stringify(message, null, 2);
    attachCopyButton(messageHeader, () => messageContent.textContent, { compact: true });

    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(messageContent);
    appendMessageNode(messageDiv);
}

// 显示系统消息
function showSystemMessage(text, _noLog = false, options = {}) {
    const key = options.key || getSystemMessageKey(text);
    if (!_noLog) upsertSystemLog(text, key);

    let messageDiv = key ? systemMessageRegistry.get(key) : null;
    let label = messageDiv ? messageDiv.querySelector('.system-message-label') : null;
    if (!messageDiv || !messageList.contains(messageDiv) || !label) {
        messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        label = document.createElement('span');
        label.className = 'system-message-label';
        messageDiv.appendChild(label);
        attachCopyButton(messageDiv, () => messageDiv.dataset.copyText || '', { compact: true });
        if (key) systemMessageRegistry.set(key, messageDiv);
        appendMessageNode(messageDiv);
    } else {
        messageList.appendChild(messageDiv);
        syncScrollAfterMessageChange(isMessageViewportAtBottom());
    }

    messageDiv.dataset.copyText = text;
    label.textContent = `[系统] ${text} (${new Date().toLocaleTimeString()})`;
}

function attachCopyButton(container, getText, options = {}) {
    if (!container) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `copy-action${options.compact ? ' copy-action-compact' : ''}`;
    button.title = '复制';
    button.setAttribute('aria-label', '复制内容');
    button.textContent = '复制';
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = typeof getText === 'function' ? getText() : '';
        if (!text) return;
        const ok = await copyTextToClipboard(text);
        const originalText = button.textContent;
        button.textContent = ok ? '已复制' : '复制失败';
        button.classList.toggle('copied', ok);
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 1200);
    });
    container.appendChild(button);
    return button;
}

async function copyTextToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        console.warn('clipboard API failed, falling back:', e);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch (e) {
        ok = false;
    }
    textarea.remove();
    return ok;
}

const assistantActivityLabels = {
    thinking: 'AI 正在思考中...',
    writing: 'AI 正在输出中...',
    tool: 'AI 正在调用工具...',
};

const assistantActivityState = {
    wrapper: null,
    label: null,
    status: '',
};

function showAssistantActivity(status = 'thinking') {
    if (isRestoring) return;
    const label = assistantActivityLabels[status] || assistantActivityLabels.thinking;
    const shouldStickToBottom = isMessageViewportAtBottom();

    if (!assistantActivityState.wrapper || !messageList.contains(assistantActivityState.wrapper)) {
        const wrapper = document.createElement('div');
        wrapper.className = 'assistant-activity';

        const dot = document.createElement('span');
        dot.className = 'assistant-activity-dot';

        const text = document.createElement('span');
        text.className = 'assistant-activity-label';

        wrapper.appendChild(dot);
        wrapper.appendChild(text);
        assistantActivityState.wrapper = wrapper;
        assistantActivityState.label = text;
    }

    assistantActivityState.status = status;
    assistantActivityState.wrapper.className = `assistant-activity assistant-activity-${status}`;
    assistantActivityState.label.textContent = label;
    messageList.appendChild(assistantActivityState.wrapper);
    syncScrollAfterMessageChange(shouldStickToBottom);
}

function keepAssistantActivityLast(exceptNode = null) {
    const wrapper = assistantActivityState.wrapper;
    if (!wrapper || wrapper === exceptNode || wrapper.parentNode !== messageList) return;
    messageList.appendChild(wrapper);
}

function closeActiveEventTraceLog() {
    eventTraceLog = null;
}

function hideAssistantActivity() {
    const wrapper = assistantActivityState.wrapper;
    if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
    }
    assistantActivityState.status = '';
}

const MESSAGE_BOTTOM_THRESHOLD_PX = 56;
let connectionStatusLog = null;
let connectionStatusItems = [];
let eventTraceLog = null;
let eventTraceObjectSeen = new WeakSet();
let eventLogObjectSeen = new WeakSet();
const streamMessageRegistry = new Map();
const rawStreamRegistry = new Map();
const toolCallRegistry = new Map();
const superMagicChunkSeenKeys = new Set();
const superMagicChunkSeenQueue = [];
const SUPER_MAGIC_CHUNK_SEEN_LIMIT = 3000;

function initMessageScrollControls() {
    if (!messagesContainer || !scrollToLatestBtn) return;

    updateScrollButtonPosition();
    window.addEventListener('resize', updateScrollButtonPosition);

    messagesContainer.addEventListener('scroll', () => {
        if (isMessageViewportAtBottom()) {
            hideScrollToLatestButton();
        }
        saveChatScrollState();
    });

    scrollToLatestBtn.addEventListener('click', () => {
        scrollToBottom({ behavior: 'smooth' });
    });
}

function saveChatScrollState() {
    if (isRestoring || !messagesContainer) return;
    if (chatScrollSaveFrame) return;

    chatScrollSaveFrame = requestAnimationFrame(() => {
        chatScrollSaveFrame = null;
        try {
            localStorage.setItem(CHAT_SCROLL_KEY, JSON.stringify({
                top: messagesContainer.scrollTop,
                wasAtBottom: isMessageViewportAtBottom(),
                scrollHeight: messagesContainer.scrollHeight,
                savedAt: Date.now(),
            }));
        } catch (e) {
            console.warn('保存对话滚动位置失败:', e);
        }
    });
}

function readChatScrollState() {
    try {
        const saved = localStorage.getItem(CHAT_SCROLL_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
}

function restoreChatScrollState() {
    const saved = readChatScrollState();
    if (!saved) {
        scrollToBottom();
        return;
    }

    const applyScroll = () => {
        if (!messagesContainer) return;
        if (saved.wasAtBottom) {
            scrollToBottom();
            return;
        }
        const top = Number.isFinite(Number(saved.top)) ? Number(saved.top) : 0;
        const maxTop = Math.max(0, messagesContainer.scrollHeight - messagesContainer.clientHeight);
        messagesContainer.scrollTop = Math.min(Math.max(0, top), maxTop);
        hideScrollToLatestButton();
    };

    applyScroll();
    requestAnimationFrame(applyScroll);
    setTimeout(applyScroll, 120);
}

function updateScrollButtonPosition() {
    if (!messageInputPanel || !scrollToLatestBtn) return;
    const panelHeight = Math.ceil(messageInputPanel.getBoundingClientRect().height);
    scrollToLatestBtn.style.setProperty('--message-input-panel-height', `${panelHeight}px`);
}

function isMessageViewportAtBottom() {
    if (!messagesContainer) return true;
    const distanceToBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
    return distanceToBottom <= MESSAGE_BOTTOM_THRESHOLD_PX;
}

function appendMessageNode(node, options = {}) {
    const shouldStickToBottom = options.forceScroll || isRestoring || isMessageViewportAtBottom();
    if (!eventTraceLog || node !== eventTraceLog.wrapper) {
        closeActiveEventTraceLog();
    }
    messageList.appendChild(node);
    keepAssistantActivityLast(node);
    syncScrollAfterMessageChange(shouldStickToBottom, { showLatestButton: options.showLatestButton !== false });
}

function syncScrollAfterMessageChange(shouldStickToBottom, options = {}) {
    if (isRestoring) return;
    if (shouldStickToBottom) {
        scrollToBottom();
    } else if (options.showLatestButton !== false) {
        showScrollToLatestButton();
    }
}

// 滚动到底部
function scrollToBottom(options = {}) {
    if (!messagesContainer) return;
    const behavior = options.behavior || 'auto';
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior });
    hideScrollToLatestButton();
}

function showScrollToLatestButton() {
    if (scrollToLatestBtn) scrollToLatestBtn.classList.add('visible');
}

function hideScrollToLatestButton() {
    if (scrollToLatestBtn) scrollToLatestBtn.classList.remove('visible');
}

function resetConnectionStatusLog() {
    connectionStatusLog = null;
    connectionStatusItems = [];
    eventTraceLog = null;
    eventTraceObjectSeen = new WeakSet();
    eventLogObjectSeen = new WeakSet();
    hideAssistantActivity();
    rawStreamRegistry.forEach(state => {
        if (state.timer) clearTimeout(state.timer);
    });
    rawStreamRegistry.clear();
    streamMessageRegistry.clear();
    toolCallRegistry.clear();
    superMagicChunkSeenKeys.clear();
    superMagicChunkSeenQueue.length = 0;
}

function showConnectionStatusMessage(text) {
    const timeStr = new Date().toLocaleTimeString();
    const shouldStickToBottom = isMessageViewportAtBottom();
    connectionStatusItems.push(`[${timeStr}] ${text}`);
    if (connectionStatusItems.length > 30) {
        connectionStatusItems = connectionStatusItems.slice(-30);
    }

    if (!connectionStatusLog || !messageList.contains(connectionStatusLog.wrapper)) {
        connectionStatusLog = createConnectionStatusLog();
        appendMessageNode(connectionStatusLog.wrapper, { showLatestButton: false });
    }

    connectionStatusLog.summary.textContent = `${connectionStatusLog.expanded ? '▼' : '▶'} [系统] ${text} (${timeStr})`;
    connectionStatusLog.detail.textContent = connectionStatusItems.join('\n');
    syncScrollAfterMessageChange(shouldStickToBottom, { showLatestButton: false });
}

function createConnectionStatusLog() {
    const wrapper = document.createElement('div');
    wrapper.className = 'connection-status-log';

    const summary = document.createElement('div');
    summary.className = 'connection-status-summary';

    const detail = document.createElement('div');
    detail.className = 'connection-status-detail';

    const state = { wrapper, summary, detail, expanded: false };
    summary.addEventListener('click', () => {
        state.expanded = !state.expanded;
        detail.style.display = state.expanded ? 'block' : 'none';
        const summaryText = summary.textContent.replace(/^[▶▼]\s*/, '');
        summary.textContent = `${state.expanded ? '▼' : '▶'} ${summaryText}`;
    });

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    return state;
}

// 切换高级模式
function toggleAdvancedMode() {
    isAdvancedMode = advancedModeToggle.checked;
    const normalFields = document.getElementById('normalModeFields');
    const advancedFields = document.getElementById('advancedModeFields');

    if (isAdvancedMode) {
        closeMentionPicker();
        // 高级模式与 IM 模式互斥
        if (isImMode) {
            imModeToggle.checked = false;
            toggleImMode();
        }
        normalFields.style.display = 'none';
        advancedFields.style.display = '';
        showSystemMessage("已切换到高级模式：粘贴完整 JSON 后点击「发送消息」");
    } else {
        normalFields.style.display = '';
        advancedFields.style.display = 'none';
        showSystemMessage("已切换到普通模式");
    }
    updateScrollButtonPosition();
}

function initRawEventsToggle() {
    showRawEvents = localStorage.getItem(RAW_EVENTS_TOGGLE_KEY) === 'true';
    if (!rawEventsToggle) return;
    rawEventsToggle.checked = showRawEvents;
    rawEventsToggle.addEventListener('change', () => {
        showRawEvents = rawEventsToggle.checked;
        localStorage.setItem(RAW_EVENTS_TOGGLE_KEY, String(showRawEvents));
        rerenderChatLog();
    });
}

function rerenderChatLog() {
    const shouldStickToBottom = isMessageViewportAtBottom();
    const previousScrollTop = messagesContainer ? messagesContainer.scrollTop : 0;
    hideAssistantActivity();
    closeActiveEventTraceLog();
    connectionStatusLog = null;
    connectionStatusItems = [];
    eventTraceLog = null;
    eventTraceObjectSeen = new WeakSet();
    eventLogObjectSeen = new WeakSet();
    systemMessageRegistry.clear();
    streamMessageRegistry.clear();
    toolCallRegistry.clear();
    rawStreamRegistry.forEach(state => {
        if (state.timer) clearTimeout(state.timer);
    });
    rawStreamRegistry.clear();
    if (messageList) messageList.innerHTML = '';

    isRestoring = true;
    for (const entry of chatLog) {
        renderLogEntry(entry);
    }
    isRestoring = false;

    requestAnimationFrame(() => {
        if (!messagesContainer) return;
        if (shouldStickToBottom) {
            scrollToBottom({ force: true });
        } else {
            messagesContainer.scrollTop = previousScrollTop;
            updateScrollButtonPosition();
        }
    });
}

// 切换语言
function changeLanguage() {
    currentLanguage = languageSelect.value;
    localStorage.setItem('selectedLanguage', currentLanguage);
    const displayName = languageSelect.options[languageSelect.selectedIndex].text;
    showSystemMessage(`语言已切换为: ${displayName}`);
}

// 切换消息版本
function changeMessageVersion() {
    currentMessageVersion = messageVersionSelect.value;
    localStorage.setItem('selectedMessageVersion', currentMessageVersion);
    const versionLabel = currentMessageVersion || '不传版本';
    showSystemMessage(`消息版本已切换为: ${versionLabel}`);
}

// 切换Agent模式
function changeAgentMode() {
    const selectedMode = agentModeSelect.value;
    currentAgentMode = selectedMode;

    if (agentCodeGroup) {
        agentCodeGroup.style.display = selectedMode === 'magiclaw' ? '' : 'none';
    }

    const modeNames = {
        'magic': 'Magic模式',
        'general': 'General模式',
        'ppt': 'PPT模式',
        'data_analysis': '数据分析模式',
        'summary': '总结模式',
        'magiclaw': 'MagicLaw模式'
    };

    showSystemMessage(`切换到 ${modeNames[selectedMode] || selectedMode}`);
}

// 切换任务模式（保留兼容性）
function toggleTaskMode() {
    const toggleContainer = document.getElementById('modeToggle');
    const planOption = toggleContainer.querySelector('.toggle-option.plan');
    const chatOption = toggleContainer.querySelector('.toggle-option.chat');

    if (currentTaskMode === TaskMode.PLAN) {
        currentTaskMode = TaskMode.CHAT;
        toggleContainer.classList.remove('plan-active');
        toggleContainer.classList.add('chat-active');
        planOption.classList.remove('active');
        chatOption.classList.add('active');
    } else {
        currentTaskMode = TaskMode.PLAN;
        toggleContainer.classList.remove('chat-active');
        toggleContainer.classList.add('plan-active');
        chatOption.classList.remove('active');
        planOption.classList.add('active');
    }

    showSystemMessage(`切换到 ${currentTaskMode.toUpperCase()} 模式`);
}

// 从localStorage加载历史记录
function loadMessageHistory() {
    console.log("尝试从localStorage加载历史记录");
    const savedHistory = localStorage.getItem('messageHistory');
    if (savedHistory) {
        try {
            messageHistory = JSON.parse(savedHistory);
            console.log("成功加载历史记录，数量:", messageHistory.length);
        } catch (err) {
            console.error('解析历史记录失败:', err);
            messageHistory = [];
        }
    } else {
        console.log("localStorage中没有保存的历史记录");
        messageHistory = [];
    }
}

// 保存消息到历史记录
function saveMessageToHistory(message) {
    if (!message.trim()) return;

    // 检查是否已存在相同消息，避免重复
    if (messageHistory.includes(message)) {
        // 如果存在，将其移到最前面
        messageHistory = messageHistory.filter(item => item !== message);
    }

    // 添加到数组开头
    messageHistory.unshift(message);

    // 限制历史记录数量
    if (messageHistory.length > 50) {
        messageHistory = messageHistory.slice(0, 50);
    }

    // 保存到localStorage
    try {
        localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
    } catch (err) {
        console.error('保存历史记录失败:', err);
    }
}

function createHistoryModalHeader(title, subtitle, options = {}) {
    const header = document.createElement('div');
    header.className = 'history-modal-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'history-modal-title';

    const titleEl = document.createElement('strong');
    titleEl.textContent = title;

    const subtitleEl = document.createElement('span');
    subtitleEl.textContent = subtitle;

    titleBox.appendChild(titleEl);
    titleBox.appendChild(subtitleEl);

    const actions = document.createElement('div');
    actions.className = 'history-modal-actions';

    if (options.showClear) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'history-action-btn danger';
        clearButton.textContent = '清空';
        clearButton.addEventListener('click', function (e) {
            e.stopPropagation();
            showConfirmDialog('确定要清空所有历史消息吗？', function () {
                clearMessageHistory();
                toggleHistoryDropdown(false);
                showSystemMessage('历史消息已清空');
            });
        });
        actions.appendChild(clearButton);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'history-close-btn';
    closeButton.setAttribute('aria-label', '关闭历史消息');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleHistoryDropdown(false);
    });
    actions.appendChild(closeButton);

    header.appendChild(titleBox);
    header.appendChild(actions);
    return header;
}

// 显示历史消息
function showMessageHistory() {
    const dropdown = document.getElementById('messageHistoryDropdown');

    dropdown.innerHTML = '';

    const dialog = document.createElement('div');
    dialog.className = 'history-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '历史消息');

    const subtitle = messageHistory.length > 0
        ? `保留最近 ${messageHistory.length} 条消息，点击卡片可填入输入框`
        : '发送过的消息会保存在这里';

    dialog.appendChild(createHistoryModalHeader('历史消息', subtitle, {
        showClear: messageHistory.length > 0,
    }));

    const list = document.createElement('div');
    list.className = 'history-list';

    if (messageHistory.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'history-item empty';
        emptyItem.textContent = '暂无历史消息';
        list.appendChild(emptyItem);
    } else {
        messageHistory.forEach((historyMessage, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const messageDiv = document.createElement('div');
            messageDiv.className = 'history-message';
            messageDiv.textContent = historyMessage;

            const actions = document.createElement('div');
            actions.className = 'history-actions';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'history-btn edit';
            editBtn.textContent = '编辑';
            editBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                editHistoryItem(index);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'history-btn delete';
            deleteBtn.textContent = '删除';
            deleteBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                showConfirmDialog('确定要删除这条历史消息吗？', function () {
                    deleteHistoryItem(index);
                    showMessageHistory();
                    showSystemMessage('历史消息已删除');
                });
            });

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            historyItem.appendChild(messageDiv);
            historyItem.appendChild(actions);
            historyItem.addEventListener('click', function () {
                messageInput.value = historyMessage;
                toggleHistoryDropdown(false);
                showSystemMessage('已加载历史消息');
            });

            list.appendChild(historyItem);
        });
    }

    dialog.appendChild(list);
    dropdown.appendChild(dialog);
}

// 清空历史记录
function clearMessageHistory() {
    messageHistory = [];
    localStorage.removeItem('messageHistory');
}

// 删除历史记录项
function deleteHistoryItem(index) {
    if (index >= 0 && index < messageHistory.length) {
        messageHistory.splice(index, 1);
        localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
    }
}

// 编辑历史记录项
function editHistoryItem(index) {
    if (index < 0 || index >= messageHistory.length) return;

    const originalMessage = messageHistory[index];
    const dropdown = document.getElementById('messageHistoryDropdown');

    dropdown.innerHTML = '';

    const dialog = document.createElement('div');
    dialog.className = 'history-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '编辑历史消息');
    dialog.appendChild(createHistoryModalHeader('编辑历史消息', '保存后会更新这条历史记录'));

    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = originalMessage;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'edit-buttons';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'btn primary small';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'btn secondary small';

    function saveEdit() {
        const newMessage = textarea.value.trim();
        if (newMessage && newMessage !== originalMessage) {
            messageHistory[index] = newMessage;
            localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
            showSystemMessage('历史消息已更新');
        }
        showMessageHistory(); // 刷新显示
    }

    function cancelEdit() {
        showMessageHistory(); // 刷新显示
    }

    saveBtn.addEventListener('click', saveEdit);
    cancelBtn.addEventListener('click', cancelEdit);

    // 回车保存，Esc取消
    textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    editContainer.appendChild(textarea);
    editContainer.appendChild(buttonContainer);

    dialog.appendChild(editContainer);
    dropdown.appendChild(dialog);

    // 聚焦到textarea并选中文本
    textarea.focus();
    textarea.select();
}

// 切换历史下拉框显示
function toggleHistoryDropdown(show) {
    const dropdown = document.getElementById('messageHistoryDropdown');

    if (show) {
        dropdown.classList.add('show');
        setTimeout(() => {
            document.addEventListener('click', closeHistoryDropdownOnClickOutside);
            document.addEventListener('keydown', handleHistoryModalKeydown);
        }, 100);
    } else {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeHistoryDropdownOnClickOutside);
        document.removeEventListener('keydown', handleHistoryModalKeydown);
    }
}

// 点击外部关闭历史下拉框
function closeHistoryDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('messageHistoryDropdown');
    const historyBtn = document.getElementById('historyBtn');
    const dialog = dropdown.querySelector('.history-modal-dialog');

    if (event.target.closest('.confirm-overlay')) {
        return;
    }

    if (dialog && !dialog.contains(event.target) && event.target !== historyBtn) {
        return;
    }

    if (event.target === historyBtn) {
        toggleHistoryDropdown(false);
    }
}

function handleHistoryModalKeydown(event) {
    if (event.key === 'Escape') {
        toggleHistoryDropdown(false);
    }
}

// 显示确认对话框
function showConfirmDialog(message, confirmCallback, cancelCallback = null) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-message">${message}</div>
            <div class="confirm-buttons">
                <button id="confirmYes" class="btn primary">确定</button>
                <button id="confirmNo" class="btn secondary">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const yesBtn = overlay.querySelector('#confirmYes');
    const noBtn = overlay.querySelector('#confirmNo');

    yesBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (confirmCallback) confirmCallback();
    });

    noBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (cancelCallback) cancelCallback();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
            if (cancelCallback) cancelCallback();
        }
    });
}

// WebSocket连接管理函数
function toggleWebSocketConnection() {
    if (isWebSocketConnected) {
        disconnectWebSocket();
    } else {
        // 手动点击恢复自动重连
        wsAutoReconnect = true;
        wsReconnectAttempt = 0;
        connectWebSocket();
    }
}

function connectWebSocket() {
    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
        showSystemMessage("请先输入服务器地址");
        return;
    }

    // 构建WebSocket URL
    const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/v1/messages/subscribe';

    try {
        updateSubscribeButtonState('connecting');
        showConnectionStatusMessage("正在建立WebSocket连接...");

        websocket = new WebSocket(wsUrl);

        websocket.onopen = handleWebSocketOpen;
        websocket.onmessage = handleWebSocketMessage;
        websocket.onclose = handleWebSocketClose;
        websocket.onerror = handleWebSocketError;

    } catch (error) {
        showConnectionStatusMessage(`WebSocket连接失败: ${error.message}`);
        updateSubscribeButtonState('disconnected');
    }
}

function disconnectWebSocket() {
    wsAutoReconnect = false;
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    isWebSocketConnected = false;
    updateSubscribeButtonState('disconnected');
    showConnectionStatusMessage("WebSocket连接已断开");
}

function handleWebSocketOpen(event) {
    isWebSocketConnected = true;
    wsReconnectAttempt = 0;
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    updateSubscribeButtonState('connected');
    showConnectionStatusMessage("WebSocket连接已建立，开始接收消息");
    wsOpenCallbacks.splice(0).forEach(cb => cb.resolve());
}

function scheduleSocketIoReconnectFromConfig() {
    if (socketIoReconnectTimer) clearTimeout(socketIoReconnectTimer);
    socketIoReconnectTimer = setTimeout(() => {
        socketIoReconnectTimer = null;
        connectSocketIoStreamFromConfig();
    }, 500);
}

function connectSocketIoStreamFromConfig(configData = null) {
    const streamConfig = buildSocketIoStreamConfig(configData);
    if (!streamConfig) return;

    const nextKey = `${streamConfig.baseUrl}|${streamConfig.socketioPath}`;
    if (socketIoClient && socketIoConfigKey === nextKey) return;

    disconnectSocketIoStream();
    socketIoConfigKey = nextKey;
    socketIoAuthContext = streamConfig.authContext || {};

    try {
        const socketUrl = buildSocketIoWebSocketUrl(streamConfig);
        socketIoClient = new WebSocket(socketUrl);

        socketIoClient.onopen = () => {
            isSocketIoConnected = true;
            showConnectionStatusMessage("Socket.IO 流式通道已连接");
        };
        socketIoClient.onclose = () => {
            isSocketIoConnected = false;
            stopSocketIoHeartbeat();
            hideAssistantActivity();
            showConnectionStatusMessage("Socket.IO 流式通道已断开");
        };
        socketIoClient.onerror = () => {
            isSocketIoConnected = false;
            hideAssistantActivity();
            showConnectionStatusMessage("Socket.IO 流式通道连接失败");
        };
        socketIoClient.onmessage = handleSocketIoPacketMessage;
    } catch (error) {
        showConnectionStatusMessage(`Socket.IO 流式通道初始化失败: ${error.message}`);
    }
}

function disconnectSocketIoStream() {
    if (!socketIoClient) return;
    stopSocketIoHeartbeat();
    socketIoClient.onopen = null;
    socketIoClient.onclose = null;
    socketIoClient.onerror = null;
    socketIoClient.onmessage = null;
    socketIoClient.close();
    socketIoClient = null;
    isSocketIoConnected = false;
}

function buildSocketIoWebSocketUrl(streamConfig) {
    const path = streamConfig.socketioPath.endsWith('/')
        ? streamConfig.socketioPath
        : `${streamConfig.socketioPath}/`;
    return `${streamConfig.baseUrl}${path}?EIO=3&transport=websocket&timestamp=${Date.now()}`;
}

function startSocketIoHeartbeat() {
    stopSocketIoHeartbeat();
    socketIoHeartbeatTimer = setInterval(() => {
        if (socketIoClient && socketIoClient.readyState === WebSocket.OPEN) {
            socketIoClient.send('2');
        }
    }, socketIoPingInterval);
}

function stopSocketIoHeartbeat() {
    if (socketIoHeartbeatTimer) {
        clearInterval(socketIoHeartbeatTimer);
        socketIoHeartbeatTimer = null;
    }
}

function connectSocketIoNamespace() {
    if (socketIoClient && socketIoClient.readyState === WebSocket.OPEN) {
        socketIoClient.send('40/im');
    }
}

function sendSocketIoLoginMessage() {
    if (!socketIoClient || socketIoClient.readyState !== WebSocket.OPEN) return;

    const payload = {
        context: {
            timestamp: Date.now(),
            authorization: '',
            organization_code: '',
            language: 'zh_CN',
            signature: '',
            ...socketIoAuthContext,
        },
        data: {
            message: {
                type: 'text',
                text: { content: '登录' },
                app_message_id: `debug-login-${Date.now()}`,
            },
            conversation_id: '',
        },
    };
    socketIoClient.send(`42/im,0${JSON.stringify(['login', payload])}`);
}

function buildSocketIoStreamConfig(configData = null) {
    const config = configData || getUploadedConfig();
    if (!config) return null;

    const wsHost = config.magic_service_ws_host || '';
    const httpHost = config.magic_service_host || '';
    const authContext = buildSocketIoAuthContext(config);
    if (wsHost) {
        const streamConfig = buildSocketIoConfigFromHost(wsHost, false);
        return streamConfig ? { ...streamConfig, authContext } : null;
    }
    if (httpHost) {
        const streamConfig = buildSocketIoConfigFromHost(httpHost, true);
        return streamConfig ? { ...streamConfig, authContext } : null;
    }
    return null;
}

function buildSocketIoAuthContext(config) {
    const metadata = config.metadata || {};
    const authorization = config.authorization || metadata.authorization || '';
    return {
        authorization,
        'user-authorization': authorization,
        organization_code: metadata.organization_code || metadata.magicOrganizationCode || '',
        language: metadata.language || config.language || 'zh_CN',
        super_magic_agent_user_id: metadata.agent_user_id || '',
        topic_id: metadata.chat_topic_id || '',
    };
}

function getUploadedConfig() {
    const rawConfig = uploadConfigContent && uploadConfigContent.value;
    if (!rawConfig || rawConfig === "请上传配置文件") return null;
    try {
        return JSON.parse(rawConfig);
    } catch (e) {
        return null;
    }
}

function buildSocketIoConfigFromHost(host, convertHttpToWs) {
    try {
        const parsed = new URL(host);
        let protocol = parsed.protocol.replace(':', '');
        if (convertHttpToWs) {
            if (protocol === 'https') protocol = 'wss';
            else if (protocol === 'http') protocol = 'ws';
        } else if (protocol === 'https') {
            protocol = 'wss';
        } else if (protocol === 'http') {
            protocol = 'ws';
        }
        if (!['ws', 'wss'].includes(protocol)) return null;

        let port = parsed.port;
        if (convertHttpToWs && port === '9501') port = '9502';
        const portPart = port ? `:${port}` : '';
        const baseUrl = `${protocol}://${parsed.hostname}${portPart}`;
        const normalizedPath = parsed.pathname.replace(/\/$/, '');
        const socketioPath = normalizedPath ? `${normalizedPath}/socket.io/` : '/socket.io/';
        return { baseUrl, socketioPath };
    } catch (e) {
        return null;
    }
}

function handleSocketIoPacketMessage(event) {
    const data = event && event.data;
    if (typeof data !== 'string' || !data) return;

    const engineIoPacketType = data.slice(0, 1);
    if (engineIoPacketType === '0') {
        handleSocketIoOpenPacket(data);
        return;
    }
    if (engineIoPacketType === '3') {
        return;
    }
    if (engineIoPacketType !== '4') {
        return;
    }

    const packet = decodeSocketIoPacket(data.slice(1));
    if (!packet) return;
    if (packet.type === '0' || packet.type === '3') return;

    const packetData = packet.data;
    if (Array.isArray(packetData) && packetData.length >= 2) {
        const [eventName, payload] = packetData;
        if (eventName === 'intermediate') {
            handleSocketIoIntermediateMessage(payload);
            return;
        }
        showEventLog({ socketio_event: eventName, payload });
        return;
    }

    showEventLog({ socketio_packet: packet });
}

function handleSocketIoOpenPacket(data) {
    try {
        const openPayload = JSON.parse(data.slice(1));
        if (Number.isFinite(openPayload.pingInterval)) {
            socketIoPingInterval = openPayload.pingInterval;
        }
    } catch (e) {
        socketIoPingInterval = 25000;
    }
    startSocketIoHeartbeat();
    connectSocketIoNamespace();
    sendSocketIoLoginMessage();
}

function decodeSocketIoPacket(packetText) {
    if (!packetText) return null;

    const packetType = packetText.slice(0, 1);
    let payloadText = packetText.slice(1);
    let namespace = '';
    if (payloadText.startsWith('/')) {
        const namespaceEnd = payloadText.indexOf(',');
        if (namespaceEnd === -1) return { type: packetType, namespace: payloadText, id: null, data: null };
        namespace = payloadText.slice(0, namespaceEnd);
        payloadText = payloadText.slice(namespaceEnd + 1);
    }

    let ackId = null;
    const payloadStart = payloadText.search(/[\[{]/);
    if (payloadStart > 0) {
        const ackText = payloadText.slice(0, payloadStart);
        ackId = /^\d+$/.test(ackText) ? Number(ackText) : null;
        payloadText = payloadText.slice(payloadStart);
    }

    if (!payloadText) return { type: packetType, namespace, id: ackId, data: null };
    try {
        return {
            type: packetType,
            namespace,
            id: ackId,
            data: JSON.parse(payloadText),
        };
    } catch (e) {
        console.warn('Socket.IO packet parse failed:', e, packetText);
        return null;
    }
}

function handleSocketIoIntermediateMessage(message) {
    const decoded = decodeSocketIoPayload(message);
    if (!decoded) return;
    showEventLog(decoded);
    if (handleSuperMagicChunkMessage(decoded)) return;
    if (handleRawStreamMessage(decoded)) return;
    showEventLog({ socketio_intermediate_unhandled: decoded });
}

function decodeSocketIoPayload(message) {
    let payload = message;
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            return null;
        }
    }

    const shadowText =
        (payload && payload.shadow) ||
        (payload && payload.obfuscated && typeof payload.data === 'string' ? payload.data : '');
    if (shadowText) {
        try {
            return JSON.parse(unshadowText(shadowText));
        } catch (e) {
            console.warn('Socket.IO shadow payload decode failed:', e);
            return null;
        }
    }

    return payload;
}

const SHADOW_PREFIX = 'SHADOWED_';
const UNSHUFFLE_MAP = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    62, 116, 33, 102, 126, 59, 119, 114, 44, 79, 100, 88, 67, 34, 103, 89, 46, 87, 53, 38, 41, 85, 65, 108, 97, 71, 74, 72, 36, 92, 81, 49, 40, 117,
    55, 109, 42, 78, 110, 93, 95, 54, 80, 106, 61, 51, 123, 58, 124, 99, 90, 98, 73, 111, 35, 63, 121, 105, 45, 43, 104, 70, 77, 84, 64, 57,
    52, 82, 91, 68, 60, 37, 115, 83, 125, 122, 75, 101, 48, 66, 107, 56, 39, 86, 69, 113, 112, 96, 76, 118, 32, 120, 50, 94, 47, 127,
    129, 128, 131, 130, 133, 132, 135, 134, 137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155, 154, 157, 156, 159, 158,
    161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172, 175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190,
    193, 192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210, 213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222,
    225, 224, 227, 226, 229, 228, 231, 230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248, 251, 250, 253, 252, 255, 254
];

function unshadowText(value) {
    if (!value || !value.startsWith(SHADOW_PREFIX)) return value;
    const obfuscatedPart = value.slice(SHADOW_PREFIX.length);
    const inputBytes = new TextEncoder().encode(obfuscatedPart);
    const resultBytes = new Uint8Array(inputBytes.length);
    for (let i = 0; i < inputBytes.length; i++) {
        const byteValue = inputBytes[i];
        resultBytes[i] = byteValue < UNSHUFFLE_MAP.length ? UNSHUFFLE_MAP[byteValue] : byteValue;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(resultBytes);
}

function handleWebSocketMessage(event) {
    try {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (parseError) {
            showEventLog({ error: "无法解析JSON", raw_data: event.data });
            return;
        }
        showEventLog(data);

        if (handleSuperMagicChunkMessage(data)) {
            return;
        }

        const payload = data && data.payload;
        const eventType = payload && payload.event;
        const contentType = payload && payload.content_type;
        const content = payload && payload.content;

        // v2 消息格式：type=super_magic_message，内容在 raw_content.super_magic_message 里
        if (payload && payload.type === 'super_magic_message' && payload.raw_content) {
            const smsg = payload.raw_content.super_magic_message;
            if (smsg) {
                const hasVisibleContent = handleSuperMagicMessage(smsg, payload);
                if (!hasVisibleContent) {
                    // 既无工具也无内容，折叠为事件日志
                    showEventLog(data);
                }
            } else {
                showEventLog(data);
            }
        } else if (eventType === 'after_agent_reply' && content) {
            // v1 消息格式
            const messageKey = payload.app_message_id || payload.correlation_id || '';
            const renderOptions = messageKey ? { key: messageKey, replace: true } : {};
            if (contentType === 'content') {
                if (queueRawStreamFinal(messageKey, 'content', content, payload.send_timestamp)) return;
                // v1 流式已按 correlation_id 创建气泡，最终消息只做原地校准。
                showAIMessage(content, payload.send_timestamp, false, renderOptions);
                hideAssistantActivity();
            } else if (contentType === 'reasoning') {
                if (queueRawStreamFinal(messageKey, 'reasoning', content, payload.send_timestamp)) return;
                showThinkingMessage(content, payload.send_timestamp, false, renderOptions);
                hideAssistantActivity();
            } else {
                showEventLog(data);
            }
        } else if (eventType === 'before_tool_call' || eventType === 'after_tool_call') {
            // 工具调用事件 → 紧凑的工具调用块，detail 默认折叠
            const tool = payload && payload.tool;
            if (tool) {
                showToolCallMessage(tool, eventType, payload.send_timestamp, false, {
                    correlationId: payload.correlation_id,
                    toolCallId: tool.id,
                });
                if (eventType === 'before_tool_call') {
                    showAssistantActivity('tool');
                } else if (isFinalTaskTool(tool)) {
                    hideAssistantActivity();
                } else {
                    showAssistantActivity('thinking');
                }
            } else {
                showEventLog(data);
            }
        } else if (eventType === 'before_agent_reply') {
            showAssistantActivity('thinking');
            showEventLog(data);
        } else {
            // 其余所有事件 → 折叠日志条目
            showEventLog(data);
        }
    } catch (error) {
        hideAssistantActivity();
        showSystemMessage(`处理WebSocket消息时出错: ${error.message}`);
    }
}

function handleSuperMagicChunkMessage(data) {
    const envelope = extractSuperMagicChunkEnvelope(data);
    if (!envelope || !envelope.chunk) return false;

    const chunk = envelope.chunk;
    const messageKey = envelope.appMessageId || chunk.id || chunk.correlation_id || '';
    const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
    for (const choice of choices) {
        const delta = choice && choice.delta ? choice.delta : {};
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            if (isDuplicateSuperMagicChunkDelta(envelope, choice, 'reasoning')) continue;
            showAssistantActivity('thinking');
            showThinkingMessage(delta.reasoning_content, Math.floor((envelope.timestampMs || Date.now()) / 1000), true, {
                key: messageKey || `reasoning-${chunk.correlation_id || chunk.i || Date.now()}`,
                append: true,
            });
        }
        if (typeof delta.content === 'string' && delta.content) {
            if (isDuplicateSuperMagicChunkDelta(envelope, choice, 'content')) continue;
            showAssistantActivity('writing');
            showAIMessage(delta.content, Math.floor((envelope.timestampMs || Date.now()) / 1000), true, {
                key: messageKey || `content-${chunk.correlation_id || chunk.i || Date.now()}`,
                append: true,
            });
        }
    }
    if (isSuperMagicChunkFinished(choices)) {
        hideAssistantActivity();
    }

    return true;
}

function isSuperMagicChunkFinished(choices) {
    return choices.some(choice => choice && choice.finish_reason === 'stop');
}

function isDuplicateSuperMagicChunkDelta(envelope, choice, deltaType) {
    const chunk = envelope && envelope.chunk;
    if (!chunk) return false;

    const chunkIndex = chunk.i ?? chunk.chunk_id ?? chunk.index;
    if (chunkIndex === undefined || chunkIndex === null) return false;

    const messageKey =
        envelope.appMessageId ||
        chunk.id ||
        chunk.correlation_id ||
        chunk.app_message_id ||
        'unknown';
    const choiceIndex = choice && choice.index !== undefined ? choice.index : 0;
    const dedupeKey = `${messageKey}:${choiceIndex}:${deltaType}:${chunkIndex}`;

    if (superMagicChunkSeenKeys.has(dedupeKey)) return true;

    superMagicChunkSeenKeys.add(dedupeKey);
    superMagicChunkSeenQueue.push(dedupeKey);
    while (superMagicChunkSeenQueue.length > SUPER_MAGIC_CHUNK_SEEN_LIMIT) {
        const oldKey = superMagicChunkSeenQueue.shift();
        if (oldKey) superMagicChunkSeenKeys.delete(oldKey);
    }
    return false;
}

function handleRawStreamMessage(data) {
    const message =
        (data && data.seq && data.seq.message) ||
        (data && data.data && data.data.message);
    const rawData = message && message.raw && message.raw.raw_data;
    if (!rawData) return false;

    const content = rawData.content || '';
    if (!content) return true;

    const streamStatus = Number(rawData.stream_status);
    const isFinal = streamStatus === 2;
    const key = message.app_message_id || rawData.correlation_id || '';
    const timestamp = rawData.send_timestamp
        ? Math.floor(rawData.send_timestamp / 1000)
        : Math.floor(Date.now() / 1000);

    showAssistantActivity(rawData.content_type === 'reasoning' ? 'thinking' : 'writing');
    queueRawStreamChunk({
        key,
        content,
        contentType: rawData.content_type === 'reasoning' ? 'reasoning' : 'content',
        streamStatus,
        timestamp,
        isFinal,
        chunkId: rawData.chunk_id,
    });
    return true;
}

function queueRawStreamChunk({ key, content, contentType, streamStatus, timestamp, isFinal, chunkId }) {
    const streamKey = `${contentType}:${key || 'default'}`;
    let state = rawStreamRegistry.get(streamKey);
    if (!state) {
        const renderedContent = getRenderedStreamContent(contentType, key || streamKey);
        state = {
            key: key || streamKey,
            contentType,
            timestamp,
            targetContent: renderedContent,
            renderedContent,
            timer: null,
            isFinal: false,
            seenChunkIds: new Set(),
            loggedFinal: false,
        };
        rawStreamRegistry.set(streamKey, state);
    }

    if (chunkId !== undefined && chunkId !== null) {
        if (state.seenChunkIds.has(chunkId)) return;
        state.seenChunkIds.add(chunkId);
    }

    state.timestamp = timestamp || state.timestamp;
    if (state.isFinal && !isFinal) {
        return;
    }
    state.isFinal = state.isFinal || isFinal;
    if (streamStatus === 0) {
        state.targetContent = content;
        state.renderedContent = '';
    } else if (isFinal) {
        // V1 end chunks carry the full text. Use it as the authoritative target
        // and let the paced renderer consume the remaining suffix.
        state.targetContent = mergeRawStreamContent(state.targetContent, content);
    } else {
        state.targetContent = mergeRawStreamContent(state.targetContent, content);
    }

    scheduleRawStreamRender(state, streamKey);
}

function mergeRawStreamContent(currentContent, nextContent) {
    if (!nextContent) return currentContent;
    if (!currentContent) return nextContent;
    if (nextContent.startsWith(currentContent)) return nextContent;
    if (currentContent.endsWith(nextContent)) return currentContent;

    const maxOverlap = Math.min(currentContent.length, nextContent.length);
    for (let overlap = maxOverlap; overlap > 0; overlap--) {
        if (currentContent.endsWith(nextContent.slice(0, overlap))) {
            return currentContent + nextContent.slice(overlap);
        }
    }

    return currentContent + nextContent;
}

function queueRawStreamFinal(key, contentType, content, timestamp) {
    if (!key) return false;
    const streamKey = `${contentType}:${key}`;
    const state = rawStreamRegistry.get(streamKey);
    if (!state) return false;

    state.timestamp = timestamp || state.timestamp;
    state.targetContent = mergeRawStreamContent(state.targetContent, content);
    state.isFinal = true;
    scheduleRawStreamRender(state, streamKey);
    return true;
}

function getRenderedStreamContent(contentType, key) {
    if (!key) return '';
    const registryKey = `${contentType === 'reasoning' ? 'reasoning' : 'content'}:${key}`;
    const messageState = streamMessageRegistry.get(registryKey);
    return messageState && typeof messageState.content === 'string' ? messageState.content : '';
}

function scheduleRawStreamRender(state, streamKey) {
    if (state.timer) return;
    state.timer = setTimeout(() => {
        state.timer = null;
        renderRawStreamStep(state, streamKey);
    }, 12);
}

function renderRawStreamStep(state, streamKey) {
    if (state.renderedContent.length >= state.targetContent.length) {
        if (state.isFinal) {
            persistRawStreamFinal(state, streamKey);
            rawStreamRegistry.delete(streamKey);
        }
        return;
    }

    const remaining = state.targetContent.length - state.renderedContent.length;
    const step = state.targetContent.length > 120 ? 5 : 2;
    const nextLength = state.renderedContent.length + Math.min(step, remaining);
    const nextContent = state.targetContent.slice(0, nextLength);
    state.renderedContent = nextContent;

    const options = {
        key: state.key,
        replace: true,
    };
    if (state.contentType === 'reasoning') {
        showThinkingMessage(nextContent, state.timestamp, true, options);
    } else {
        showAIMessage(nextContent, state.timestamp, true, options);
    }

    scheduleRawStreamRender(state, streamKey);
}

function persistRawStreamFinal(state, streamKey) {
    if (state.loggedFinal || !state.renderedContent) return;
    state.loggedFinal = true;
    hideAssistantActivity();
    const entry = {
        type: state.contentType === 'reasoning' ? 'thinking' : 'ai',
        content: state.renderedContent,
        timestamp: state.timestamp,
        rawStreamKey: streamKey,
    };

    const existingIndex = chatLog.findIndex(item => item.rawStreamKey === streamKey);
    if (existingIndex >= 0) {
        chatLog[existingIndex] = entry;
        saveChatLog();
        return;
    }

    const sameContentExists = chatLog.some(item =>
        item.type === entry.type &&
        item.content === entry.content &&
        Math.abs((item.timestamp || 0) - (entry.timestamp || 0)) <= 1
    );
    if (!sameContentExists) {
        pushLog(entry);
    }
}

function extractSuperMagicChunkEnvelope(data) {
    const payload = data && data.payload;
    const seqMessage = data && data.seq && data.seq.message;
    const directMessage = data && data.data && data.data.message;
    const message = directMessage || data.message || data;
    const streamMessage = seqMessage || message;
    const rawContent = payload && payload.raw_content;
    const chunk =
        (rawContent && rawContent.super_magic_chunk) ||
        (streamMessage && streamMessage.super_magic_chunk) ||
        (data && data.super_magic_chunk);

    if (!chunk) return null;
    return {
        chunk,
        appMessageId:
            (streamMessage && streamMessage.app_message_id) ||
            (payload && payload.message_id) ||
            (chunk && chunk.app_message_id) ||
            '',
        timestampMs:
            (data && data.context && data.context.timestamp) ||
            (streamMessage && streamMessage.send_time ? streamMessage.send_time * 1000 : 0) ||
            (payload && payload.send_timestamp ? payload.send_timestamp * 1000 : 0),
    };
}

function handleSuperMagicMessage(smsg, payload) {
    const messageKey = smsg.message_id || payload.message_id || smsg.correlation_id || payload.correlation_id || '';
    const isToolRole = smsg.role === 'tool';
    let hasVisibleContent = false;
    let hasReplyContent = false;

    // 最终消息是权威全文；如果已有流式气泡，则原地校准，不再新增一条。
    if (!isToolRole && smsg.reasoning_content) {
        showThinkingMessage(smsg.reasoning_content, payload.send_timestamp, false, {
            key: messageKey,
            replace: true,
        });
        hasVisibleContent = true;
        hasReplyContent = true;
    }
    if (!isToolRole && smsg.content) {
        showAIMessage(smsg.content, payload.send_timestamp, false, {
            key: messageKey,
            replace: true,
        });
        hasVisibleContent = true;
        hasReplyContent = true;
    }

    const tools = collectToolsFromSuperMagicMessage(smsg, payload);
    for (const item of tools) {
        showToolCallMessage(item.tool, payload.event, payload.send_timestamp, false, {
            correlationId: smsg.correlation_id || payload.correlation_id,
            toolCallId: item.toolCallId,
            modelContent: item.modelContent,
        });
        if (payload.event === 'before_tool_call') {
            showAssistantActivity('tool');
        } else if (isFinalTaskTool(item.tool)) {
            hideAssistantActivity();
        } else if (payload.event === 'after_tool_call') {
            showAssistantActivity('thinking');
        }
        hasVisibleContent = true;
    }

    if (hasReplyContent && tools.length === 0) {
        showAssistantActivity('thinking');
    }
    if (isMainAgentFinished(payload)) {
        hideAssistantActivity();
    }
    return hasVisibleContent;
}

function isMainAgentFinished(payload) {
    if (!payload || typeof payload !== 'object') return false;
    return payload.event === 'after_main_agent_run' && payload.status === 'finished';
}

function collectToolsFromSuperMagicMessage(smsg, payload) {
    const tools = [];
    if (smsg.tool) {
        tools.push({ tool: smsg.tool, toolCallId: smsg.tool_call_id || smsg.tool.id, modelContent: smsg.content || '' });
    }
    if (Array.isArray(smsg.tool_calls)) {
        for (const toolCall of smsg.tool_calls) {
            if (toolCall && toolCall.tool) {
                tools.push({ tool: toolCall.tool, toolCallId: toolCall.id || toolCall.tool.id, modelContent: toolCall.content || '' });
            }
        }
    }
    if (payload && payload.tool) {
        tools.push({ tool: payload.tool, toolCallId: payload.tool.id, modelContent: smsg.content || '' });
    }
    return tools;
}

// 将文本片段用 marked 渲染为 markdown，marked 不可用时降级为纯文本
function renderMarkdown(text) {
    const div = document.createElement('div');
    div.className = 'ai-markdown';
    try {
        div.innerHTML = (typeof marked !== 'undefined')
            ? marked.parse(text, { breaks: true })
            : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } catch (e) {
        div.textContent = text;
    }
    return div;
}

function renderMarkdownContent(text) {
    if (typeof marked !== 'undefined') {
        return marked.parse(text || '', { breaks: true });
    }
    return escapeHtml(text || '');
}

// 将内容按 ```html / ```qrcode 块拆分，返回渲染好的 DOM 片段数组
function buildRenderedView(content) {
    const fragment = document.createDocumentFragment();
    const codeBlockRegex = /```(html|HTML|qrcode)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const before = content.slice(lastIndex, match.index);
        if (before.trim()) fragment.appendChild(renderMarkdown(before));

        const lang = match[1].toLowerCase();
        const blockContent = match[2];

        if (lang === 'html') {
            const wrapper = document.createElement('div');
            wrapper.className = 'ai-iframe-wrapper';
            const iframe = document.createElement('iframe');
            iframe.className = 'ai-iframe';
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            iframe.srcdoc = blockContent;
            iframe.onload = () => {
                try {
                    const h = iframe.contentDocument.body.scrollHeight;
                    if (h > 0) iframe.style.height = Math.min(h + 20, 600) + 'px';
                } catch (e) {}
            };
            wrapper.appendChild(iframe);
            fragment.appendChild(wrapper);
        } else if (lang === 'qrcode') {
            const url = blockContent.trim();
            const wrapper = document.createElement('div');
            wrapper.className = 'ai-qrcode-wrapper';
            const qrTarget = document.createElement('div');
            wrapper.appendChild(qrTarget);
            fragment.appendChild(wrapper);
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrTarget, { text: url, width: 256, height: 256, colorDark: '#111', colorLight: '#fff' });
            } else {
                qrTarget.textContent = url;
            }
        }

        lastIndex = match.index + match[0].length;
    }

    const remaining = content.slice(lastIndex);
    if (remaining.trim()) fragment.appendChild(renderMarkdown(remaining));
    return fragment;
}

// 显示 AI 回复消息气泡，支持 markdown 渲染、原文切换和流式更新。
function showAIMessage(content, timestamp, _noLog = false, options = {}) {
    if (!_noLog) pushLog({ type: 'ai', content, timestamp });

    const registryKey = options.key ? `content:${options.key}` : '';
    let messageState = registryKey ? streamMessageRegistry.get(registryKey) : null;
    if (messageState) {
        updateAIMessageState(messageState, content, options);
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';

    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    // 标题栏 + 切换按钮
    const header = document.createElement('div');
    header.className = 'message-header ai-header';

    const headerText = document.createElement('span');
    headerText.textContent = `AI 回复 (${timeStr})`;

    const titleGroup = document.createElement('div');
    titleGroup.className = 'ai-title-group';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ai-toggle-btn';
    toggleBtn.textContent = '原文';

    const actions = document.createElement('div');
    actions.className = 'message-actions';

    titleGroup.appendChild(headerText);
    actions.appendChild(toggleBtn);
    header.appendChild(titleGroup);
    header.appendChild(actions);
    messageDiv.appendChild(header);

    // 渲染视图（默认显示）
    const renderedView = document.createElement('div');
    renderedView.className = 'ai-rendered-view';
    renderedView.appendChild(buildRenderedView(content));

    // 原文视图（隐藏）
    const rawView = document.createElement('div');
    rawView.className = 'ai-raw-view';
    rawView.style.display = 'none';

    messageDiv.appendChild(renderedView);
    messageDiv.appendChild(rawView);

    // 切换逻辑
    let showingRaw = false;
    toggleBtn.addEventListener('click', () => {
        showingRaw = !showingRaw;
        renderedView.style.display = showingRaw ? 'none' : 'block';
        rawView.style.display = showingRaw ? 'block' : 'none';
        toggleBtn.textContent = showingRaw ? 'MD' : '原文';
    });

    messageState = { messageDiv, renderedView, rawView, content: '' };
    attachCopyButton(actions, () => messageState.content);
    updateAIMessageState(messageState, content, options);
    if (registryKey) {
        streamMessageRegistry.set(registryKey, messageState);
    }
    appendMessageNode(messageDiv);
}

function updateAIMessageState(messageState, content, options = {}) {
    const nextContent = options.append ? messageState.content + content : content;
    messageState.content = nextContent;
    messageState.renderedView.replaceChildren(buildRenderedView(nextContent));
    messageState.rawView.textContent = nextContent;
    syncScrollAfterMessageChange(isMessageViewportAtBottom());
}

// 显示思考过程（折叠展示）
function showThinkingMessage(content, timestamp, _noLog = false, options = {}) {
    if (!_noLog) pushLog({ type: 'thinking', content, timestamp });

    const registryKey = options.key ? `reasoning:${options.key}` : '';
    let thinkingState = registryKey ? streamMessageRegistry.get(registryKey) : null;
    if (thinkingState) {
        updateThinkingMessageState(thinkingState, content, options);
        return;
    }

    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    const wrapper = document.createElement('div');
    wrapper.className = 'thinking-block';

    const summary = document.createElement('div');
    summary.className = 'thinking-summary';
    const summaryLabel = document.createElement('span');
    summaryLabel.textContent = `▼ 思考过程 (${timeStr})`;
    summary.appendChild(summaryLabel);
    summary.addEventListener('click', () => {
        const isHidden = detail.style.display === 'none';
        detail.style.display = isHidden ? 'block' : 'none';
        summaryLabel.textContent = (isHidden ? '▼' : '▶') + ` 思考过程 (${timeStr})`;
    });

    const detail = document.createElement('div');
    detail.className = 'thinking-detail';

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    thinkingState = { wrapper, detail, content: '' };
    attachCopyButton(summary, () => thinkingState.content, { compact: true });
    updateThinkingMessageState(thinkingState, content, options);
    if (registryKey) {
        streamMessageRegistry.set(registryKey, thinkingState);
    }
    appendMessageNode(wrapper);
}

function updateThinkingMessageState(thinkingState, content, options = {}) {
    thinkingState.content = options.append ? thinkingState.content + content : content;
    thinkingState.detail.textContent = thinkingState.content;
    syncScrollAfterMessageChange(isMessageViewportAtBottom());
}

// ─── ask_user 交互卡片 ───────────────────────────────────────────────────────

// question_id → wrapper 元素，用于 after_tool_call 时更新已有卡片，避免重复渲染
const askUserCardRegistry = new Map();

/**
 * 将 wrapper 里的 ask_user 卡片更新为最终状态（answered/skipped/timeout/cancelled）。
 * 由 after_tool_call 事件调用。
 */
function finalizeAskUserCard(wrapper, data) {
    wrapper.className = 'tool-call-block tool-call-finished';
    const card = wrapper.querySelector('.ask-user-card');
    if (!card) return;

    // 停止倒计时（清 interval 通过 dataset 存储的 id）
    if (card._countdownTimer) {
        clearInterval(card._countdownTimer);
    }

    // 禁用所有输入和按钮
    card.querySelectorAll('input, button').forEach(el => { el.disabled = true; });

    // 移除旧结果标签（如果提交后已存在）
    card.querySelectorAll('.ask-user-result').forEach(el => el.remove());

    const status = data.status || 'cancelled';
    const statusLabel = { answered: '✅ 已回答', skipped: '⏭ 已跳过', timeout: '⏰ 已超时', cancelled: '🚫 已取消' };

    // 如果有答案内容，展示一下
    if (status === 'answered' && data.answers) {
        const answersEl = document.createElement('div');
        answersEl.className = 'ask-user-result';
        const parts = Object.entries(data.answers).map(([k, v]) => {
            const q = (data.questions || []).find(q => q.sub_id === k);
            const label = q ? q.question : k;
            const val = Array.isArray(v) ? v.join('、') : v;
            return `${label}：${val}`;
        });
        answersEl.textContent = '✅ ' + parts.join('；');
        card.appendChild(answersEl);
    } else {
        const resultEl = document.createElement('div');
        resultEl.className = 'ask-user-result' + (status !== 'answered' ? ' skipped' : '');
        resultEl.textContent = statusLabel[status] || `状态: ${status}`;
        card.appendChild(resultEl);
    }

    card.classList.remove('ask-user-card');
    card.classList.add('ask-user-card', status === 'answered' ? 'answered' : 'expired');

    // 移除操作按钮区（可能已禁用，彻底隐藏更干净）
    card.querySelectorAll('.ask-user-actions').forEach(el => el.remove());
    card.querySelectorAll('.ask-user-countdown').forEach(el => { el.textContent = statusLabel[status] || status; el.className = 'ask-user-countdown'; });

    askUserCardRegistry.delete(data.question_id);
}

/**
 * 渲染 ask_user 交互卡片并挂到 container 上。
 * data: { question_id, questions[], expires_at, status }
 */
function renderAskUserCard(data, container) {
    const { question_id, questions = [], expires_at, status } = data;
    const alreadyDone = status && status !== 'pending';

    const card = document.createElement('div');
    card.className = 'ask-user-card' + (alreadyDone ? ' answered' : '');

    // 通用禁用函数（仅操作 DOM，不依赖闭包变量顺序）
    function disableCard() {
        if (card._countdownTimer) clearInterval(card._countdownTimer);
        card.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    }

    // 倒计时
    if (!alreadyDone && expires_at) {
        const countdownEl = document.createElement('div');
        countdownEl.className = 'ask-user-countdown';
        card.appendChild(countdownEl);

        function updateCountdown() {
            const remaining = Math.max(0, Math.floor(expires_at - Date.now() / 1000));
            if (remaining <= 0) {
                clearInterval(card._countdownTimer);
                countdownEl.textContent = '⏰ 已超时';
                card.classList.add('expired');
                disableCard();
                return;
            }
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            countdownEl.textContent = `⏳ 剩余 ${m}:${String(s).padStart(2, '0')}`;
            countdownEl.className = 'ask-user-countdown' + (remaining <= 30 ? ' urgent' : '');
        }
        updateCountdown();
        card._countdownTimer = setInterval(updateCountdown, 1000);
    }

    // 每道问题的输入控件
    const questionBlocks = [];
    questions.forEach((q, idx) => {
        const block = document.createElement('div');
        block.className = 'ask-user-question-block';

        const qText = document.createElement('div');
        qText.className = 'ask-user-question-text';
        qText.textContent = (questions.length > 1 ? `${idx + 1}. ` : '') + q.question;
        block.appendChild(qText);

        let getValue = () => '';

        if (q.interaction_type === 'confirm') {
            const btnWrap = document.createElement('div');
            btnWrap.className = 'ask-user-confirm-buttons';
            let selected = q.default_value || null;

            const options = q.options && q.options.length ? q.options : ['是', '否'];
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'ask-user-confirm-btn' + (selected === opt ? ' selected' : '');
                btn.textContent = opt;
                btn.addEventListener('click', () => {
                    selected = opt;
                    btnWrap.querySelectorAll('.ask-user-confirm-btn').forEach(b => {
                        b.classList.toggle('selected', b.textContent === opt);
                    });
                });
                btnWrap.appendChild(btn);
            });
            block.appendChild(btnWrap);
            getValue = () => selected;

        } else if (q.interaction_type === 'select') {
            const optWrap = document.createElement('div');
            optWrap.className = 'ask-user-options';
            const opts = q.options || [];

            // 后端会在有 options 时自动追加 "Other"，检测到后做特殊渲染
            const hasOther = opts.length > 0 && opts[opts.length - 1].toLowerCase() === 'other';
            const renderOpts = hasOther ? opts.slice(0, -1) : opts;

            const otherInput = document.createElement('input');
            otherInput.type = 'text';
            otherInput.className = 'ask-user-input';
            otherInput.placeholder = '请输入自定义内容…';
            otherInput.style.display = 'none';
            otherInput.style.marginTop = '4px';

            renderOpts.forEach(opt => {
                const label = document.createElement('label');
                label.className = 'ask-user-option';
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `ask_user_${question_id}_${q.sub_id}`;
                radio.value = opt;
                if (opt === q.default_value) radio.checked = true;
                radio.addEventListener('change', () => { otherInput.style.display = 'none'; });
                label.appendChild(radio);
                label.appendChild(document.createTextNode(opt));
                optWrap.appendChild(label);
            });

            if (hasOther) {
                const otherLabel = document.createElement('label');
                otherLabel.className = 'ask-user-option';
                const otherRadio = document.createElement('input');
                otherRadio.type = 'radio';
                otherRadio.name = `ask_user_${question_id}_${q.sub_id}`;
                otherRadio.value = '__other__';
                otherRadio.addEventListener('change', () => {
                    otherInput.style.display = 'block';
                    otherInput.focus();
                });
                otherLabel.appendChild(otherRadio);
                otherLabel.appendChild(document.createTextNode('其他…'));
                optWrap.appendChild(otherLabel);
                block.appendChild(optWrap);
                block.appendChild(otherInput);
            } else {
                block.appendChild(optWrap);
            }

            getValue = () => {
                const checked = optWrap.querySelector('input[type=radio]:checked');
                if (!checked) return '';
                return checked.value === '__other__' ? (otherInput.value || 'Other') : checked.value;
            };

        } else if (q.interaction_type === 'multi_select') {
            const optWrap = document.createElement('div');
            optWrap.className = 'ask-user-options';
            const opts = q.options || [];
            const defaults = Array.isArray(q.default_value) ? q.default_value : [];

            const hasOther = opts.length > 0 && opts[opts.length - 1].toLowerCase() === 'other';
            const renderOpts = hasOther ? opts.slice(0, -1) : opts;

            const otherInput = document.createElement('input');
            otherInput.type = 'text';
            otherInput.className = 'ask-user-input';
            otherInput.placeholder = '请输入自定义内容…';
            otherInput.style.display = 'none';
            otherInput.style.marginTop = '4px';

            renderOpts.forEach(opt => {
                const label = document.createElement('label');
                label.className = 'ask-user-option';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = opt;
                cb.checked = defaults.includes(opt);
                label.appendChild(cb);
                label.appendChild(document.createTextNode(opt));
                optWrap.appendChild(label);
            });

            if (hasOther) {
                const otherLabel = document.createElement('label');
                otherLabel.className = 'ask-user-option';
                const otherCb = document.createElement('input');
                otherCb.type = 'checkbox';
                otherCb.value = '__other__';
                otherCb.addEventListener('change', () => {
                    otherInput.style.display = otherCb.checked ? 'block' : 'none';
                    if (otherCb.checked) otherInput.focus();
                });
                otherLabel.appendChild(otherCb);
                otherLabel.appendChild(document.createTextNode('其他…'));
                optWrap.appendChild(otherLabel);
                block.appendChild(optWrap);
                block.appendChild(otherInput);
            } else {
                block.appendChild(optWrap);
            }

            getValue = () => {
                const vals = Array.from(optWrap.querySelectorAll('input[type=checkbox]:checked'))
                    .map(c => c.value === '__other__' ? (otherInput.value || 'Other') : c.value)
                    .filter(v => v !== '');
                return vals;
            };

        } else {
            // input (default)
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'ask-user-input';
            input.placeholder = q.placeholder || '';
            input.value = q.default_value || '';
            block.appendChild(input);
            getValue = () => input.value;
        }

        card.appendChild(block);
        questionBlocks.push({ q, getValue });
    });

    // 如果已有结果（after_tool_call 时 re-render），只展示结果
    if (alreadyDone) {
        const resultEl = document.createElement('div');
        resultEl.className = 'ask-user-result' + (status !== 'answered' ? ' skipped' : '');
        const statusLabel = { answered: '✅ 已回答', skipped: '⏭ 已跳过', timeout: '⏰ 已超时', cancelled: '🚫 已取消' };
        if (status === 'answered' && data.answers) {
            const parts = Object.entries(data.answers).map(([k, v]) => {
                const q = (questions).find(q => q.sub_id === k);
                const label = q ? q.question : k;
                const val = Array.isArray(v) ? v.join('、') : v;
                return `${label}：${val}`;
            });
            resultEl.textContent = '✅ ' + parts.join('；');
        } else {
            resultEl.textContent = statusLabel[status] || `状态: ${status}`;
        }
        card.appendChild(resultEl);
        container.appendChild(card);
        return;
    }

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'ask-user-actions';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'ask-user-submit-btn';
    submitBtn.textContent = '提交';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'ask-user-skip-btn';
    skipBtn.textContent = '跳过';

    actions.appendChild(submitBtn);
    actions.appendChild(skipBtn);
    card.appendChild(actions);

    async function doSubmit(response_status) {
        disableCard();
        const answers = {};
        if (response_status === 'answered') {
            questionBlocks.forEach(({ q, getValue }) => {
                answers[q.sub_id] = getValue();
            });
        }

        const serverUrl = serverUrlInput.value.trim();
        try {
            const resp = await fetch(`${serverUrl}/api/v1/messages/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message_id: generateTimestampId(),
                    type: 'user_tool_call',
                    user_tool_call: {
                        name: 'ask_user',
                        tool_call_id: question_id,
                        detail: {
                            response_status,
                            answer: JSON.stringify(answers)
                        }
                    }
                })
            });
            const json = await resp.json();

            const resultEl = document.createElement('div');
            resultEl.className = 'ask-user-result' + (response_status === 'skipped' ? ' skipped' : '');
            resultEl.textContent = response_status === 'answered' ? '✅ 已提交' : '⏭ 已跳过';
            card.appendChild(resultEl);
            card.classList.add('answered');

            showEventLog({ label: `ask_user 响应: ${json.message || response_status}`, ...json });
        } catch (e) {
            showSystemMessage(`ask_user 提交失败: ${e.message}`);
            // 重新启用按钮允许重试
            submitBtn.disabled = false;
            skipBtn.disabled = false;
        }
    }

    submitBtn.addEventListener('click', () => doSubmit('answered'));
    skipBtn.addEventListener('click', () => doSubmit('skipped'));

    // 单问题 confirm 卡片：点选项直接提交，隐藏底部操作栏
    const isSingleConfirm = questions.length === 1 && questions[0].interaction_type === 'confirm';
    if (isSingleConfirm) {
        actions.style.display = 'none';
        card.querySelectorAll('.ask-user-confirm-btn').forEach(btn => {
            btn.addEventListener('click', () => doSubmit('answered'));
        });
    }

    container.appendChild(card);

    // 注册卡片，供 after_tool_call 事件更新状态用
    if (question_id) {
        askUserCardRegistry.set(question_id, container);
    }
}

// 显示工具调用消息块（before_tool_call / after_tool_call）
function showToolCallMessage(tool, eventType, timestamp, _noLog = false, options = {}) {
    if (isCodeModeToolMessage(tool)) return;
    if (!_noLog) pushLog({ type: 'tool_call', tool, eventType, timestamp });

    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    const toolKey = getToolCallKey(tool, options);
    let toolState = toolKey ? toolCallRegistry.get(toolKey) : null;
    if (toolState) {
        updateToolCallState(toolState, tool, eventType, timeStr, options);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tool-call-block';

    const header = document.createElement('div');
    header.className = 'tool-call-header';

    const statusDot = document.createElement('span');
    statusDot.className = 'tool-call-status-dot';

    const actionSpan = document.createElement('span');
    actionSpan.className = 'tool-call-action';

    header.appendChild(statusDot);
    header.appendChild(actionSpan);

    const remarkSpan = document.createElement('span');
    remarkSpan.className = 'tool-call-remark';
    header.appendChild(remarkSpan);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'tool-call-time';
    header.appendChild(timeSpan);

    const arrow = document.createElement('span');
    arrow.className = 'tool-call-arrow';
    arrow.textContent = '▶';
    header.appendChild(arrow);

    const copyBtn = shouldShowToolCopyButton(tool)
        ? attachCopyButton(header, () => {
            return toolState.detailEl.textContent ||
                [toolState.actionSpan.textContent, toolState.remarkSpan.textContent].filter(Boolean).join('\n');
        }, { compact: true })
        : null;

    const detailEl = document.createElement('pre');
    detailEl.className = 'tool-call-detail';
    detailEl.style.display = 'none';

    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
        if (toolState.openDetailPreview) {
            toolState.openDetailPreview();
            return;
        }
        if (!detailEl.textContent) return;
        const isHidden = detailEl.style.display === 'none';
        detailEl.style.display = isHidden ? 'block' : 'none';
        arrow.textContent = isHidden ? '▼' : '▶';
    });

    wrapper.appendChild(header);
    wrapper.appendChild(detailEl);

    toolState = { wrapper, header, actionSpan, remarkSpan, timeSpan, arrow, detailEl, copyBtn, openDetailPreview: null, modelContent: '' };
    updateToolCallState(toolState, tool, eventType, timeStr, options);
    if (toolKey) {
        toolCallRegistry.set(toolKey, toolState);
    }
    appendMessageNode(wrapper);
}

function isCodeModeToolMessage(tool) {
    if (!tool || typeof tool !== 'object') return false;
    const name = String(tool.name || '').toLowerCase();
    const action = String(tool.action || '');
    return name === 'run_sdk_snippet' || action.includes('代码模式');
}

function shouldShowToolCopyButton(tool) {
    if (!tool || typeof tool !== 'object') return false;
    const name = String(tool.name || '').toLowerCase();
    const action = String(tool.action || '');
    return name !== 'init_virtual_machine' && !isFinalTaskTool(tool);
}

function isFinalTaskTool(tool) {
    if (!tool || typeof tool !== 'object') return false;
    const name = String(tool.name || '').toLowerCase();
    const action = String(tool.action || '');
    return action === '任务完成' || name === 'task_complete' || name === 'finish_task';
}

function getToolCallKey(tool, options = {}) {
    return (
        options.toolCallId ||
        tool.id ||
        tool.tool_call_id ||
        tool.call_id ||
        (options.correlationId ? `${options.correlationId}:${tool.name || tool.action || 'tool'}` : '')
    );
}

function updateToolCallState(toolState, tool, eventType, timeStr, options = {}) {
    const status = normalizeToolStatus(tool.status, eventType);
    const action = tool.action || tool.name || '工具调用';
    const remark = tool.remark || tool.error || tool.message || '';
    const detail = extractToolDetail(tool, status, remark);
    const shouldStickToBottom = isMessageViewportAtBottom();
    if (typeof options.modelContent === 'string' && options.modelContent) {
        toolState.modelContent = options.modelContent;
    }

    toolState.wrapper.className = `tool-call-block tool-call-${status}`;
    toolState.actionSpan.textContent = action;
    toolState.actionSpan.title = action;
    toolState.remarkSpan.textContent = remark;
    toolState.remarkSpan.title = remark;
    toolState.remarkSpan.style.display = remark ? '' : 'none';
    toolState.timeSpan.textContent = timeStr;

    updateToolDetailView(toolState, detail, tool, eventType);
    syncScrollAfterMessageChange(shouldStickToBottom);
}

function normalizeToolStatus(status, eventType) {
    if (status === 'error' || status === 'failed' || status === 'failure') return 'error';
    if (status === 'running' || eventType === 'before_tool_call' || eventType === 'pending_tool_call') return 'running';
    return 'finished';
}

function extractToolDetail(tool, status, remark) {
    const explicitDetail = tool.detail || tool.details || tool.tool_detail || tool.toolDetails;
    if (explicitDetail) return explicitDetail;
    if (status === 'error') {
        return {
            type: 'text',
            data: {
                message: remark || '工具调用失败，但后端没有返回详细错误信息。',
                tool: {
                    id: tool.id,
                    name: tool.name,
                    status: tool.status,
                },
            },
        };
    }
    return null;
}

function updateToolDetailView(toolState, detail, tool, eventType) {
    if (detail && detail.type === 'ask_user' && detail.data) {
        const qid = detail.data.question_id;
        if (eventType === 'after_tool_call' && qid && askUserCardRegistry.has(qid)) {
            finalizeAskUserCard(askUserCardRegistry.get(qid), detail.data);
        } else if (!toolState.wrapper.querySelector('.ask-user-card')) {
            renderAskUserCard(detail.data, toolState.wrapper);
        }
        toolState.detailEl.style.display = 'none';
        toolState.detailEl.textContent = '';
        toolState.arrow.style.display = 'none';
        toolState.openDetailPreview = null;
        return;
    }

    if (!detail && toolState.detailEl.textContent) {
        toolState.arrow.style.display = '';
        return;
    }

    const detailText = detail ? formatToolDetail(detail) : '';
    toolState.detailEl.textContent = detailText;
    toolState.arrow.style.display = detailText || toolState.modelContent ? '' : 'none';
    toolState.openDetailPreview = detailText || toolState.modelContent
        ? () => openToolDetailPreview(tool, detail, detailText, toolState.modelContent || '')
        : null;
    if (!detailText) {
        toolState.detailEl.style.display = 'none';
        toolState.arrow.textContent = '▶';
    }
}

function formatToolDetail(detail) {
    if (typeof detail === 'string') return detail;
    if (!detail || typeof detail !== 'object') return '';
    if (detail.type === 'md' && detail.data && detail.data.content) return detail.data.content;
    if (detail.type === 'text' && detail.data && detail.data.content) return detail.data.content;
    if (detail.type === 'text' && detail.data && detail.data.message) return detail.data.message;
    if (detail.type === 'terminal' && detail.data) {
        return [
            detail.data.command ? `$ ${detail.data.command}` : '',
            detail.data.stdout || '',
            detail.data.stderr || '',
            typeof detail.data.exit_code === 'number' ? `exit_code: ${detail.data.exit_code}` : '',
        ].filter(Boolean).join('\n');
    }
    return JSON.stringify(detail, null, 2);
}

function openToolDetailPreview(tool, detail, detailText, modelContent = '') {
    if (!detailText && !modelContent) return;
    const toolName = tool.action || tool.name || '工具详情';
    const markdown = buildToolDetailMarkdown(detail, detailText);
    filePreviewTabs.set(TOOL_DETAIL_PREVIEW_PATH, {
        path: TOOL_DETAIL_PREVIEW_PATH,
        type: 'tool-detail',
        title: '工具详情',
        detailTitle: toolName,
        content: markdown,
        modelContent,
        updatedAt: Date.now(),
    });
    filePreviewScrollPositions[TOOL_DETAIL_PREVIEW_PATH] = 0;
    activateFilePreviewTab(TOOL_DETAIL_PREVIEW_PATH, { resetScroll: true });
}

function buildToolDetailMarkdown(detail, detailText) {
    if (detail && typeof detail === 'object' && detail.type === 'md') {
        return detailText;
    }
    if (detail && typeof detail === 'object' && detail.type === 'terminal') {
        return createMarkdownFence(detailText, 'shell');
    }
    if (detail && typeof detail === 'object' && !detail.type) {
        return createMarkdownFence(detailText, 'json');
    }
    return detailText;
}

function createMarkdownFence(content, language = '') {
    const text = String(content || '');
    const fences = text.match(/`{3,}/g) || [];
    const maxFenceLength = fences.reduce((max, fence) => Math.max(max, fence.length), 2);
    const fence = '`'.repeat(maxFenceLength + 1);
    return `${fence}${language}\n${text}\n${fence}`;
}

// 显示折叠的事件日志条目
function showEventLog(data, _noLog = false) {
    if (!_noLog && data && typeof data === 'object') {
        if (eventLogObjectSeen.has(data)) return;
        eventLogObjectSeen.add(data);
    }
    if (!_noLog) pushLog({ type: 'event', data });
    if (!showRawEvents) return;
    if (data && typeof data === 'object') {
        if (eventTraceObjectSeen.has(data)) return;
        eventTraceObjectSeen.add(data);
    }
    const eventLabel = getEventTraceLabel(data);
    const timeStr = getEventTraceTime(data);
    const shouldStickToBottom = isMessageViewportAtBottom();

    const trace = ensureEventTraceLog();
    trace.countValue += 1;
    trace.latest.textContent = `[${timeStr}] ${eventLabel} 等 ${trace.countValue} 个事件`;

    const wrapper = document.createElement('div');
    wrapper.className = 'event-log';

    const summary = document.createElement('div');
    summary.className = 'event-log-summary';
    const summaryLabel = document.createElement('span');
    summaryLabel.textContent = `▶ [${timeStr}] ${eventLabel}`;
    summary.appendChild(summaryLabel);
    summary.addEventListener('click', () => {
        detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
        summaryLabel.textContent = (detail.style.display === 'none' ? '▶' : '▼') + ` [${timeStr}] ${eventLabel}`;
    });

    const detail = document.createElement('pre');
    detail.className = 'event-log-detail';
    detail.style.display = 'none';
    detail.textContent = JSON.stringify(data, null, 2);
    trace.rawTexts.push(detail.textContent);
    attachCopyButton(summary, () => detail.textContent, { compact: true });

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    trace.body.appendChild(wrapper);
    trace.body.scrollTop = trace.body.scrollHeight;
    keepAssistantActivityLast();
    syncScrollAfterMessageChange(shouldStickToBottom, { showLatestButton: true });
}

function ensureEventTraceLog() {
    if (eventTraceLog && messageList.contains(eventTraceLog.wrapper)) return eventTraceLog;

    const wrapper = document.createElement('div');
    wrapper.className = 'event-trace-box';

    const header = document.createElement('div');
    header.className = 'event-trace-header';
    header.title = '点击展开/收起原始事件';

    const title = document.createElement('span');
    title.className = 'event-trace-title';
    title.textContent = '原始事件';

    const latest = document.createElement('span');
    latest.className = 'event-trace-latest';
    latest.textContent = '等待事件';

    const body = document.createElement('div');
    body.className = 'event-trace-body';
    body.style.display = 'none';

    const traceState = { wrapper, header, title, latest, copyAll: null, body, countValue: 0, rawTexts: [] };

    header.appendChild(title);
    header.appendChild(latest);
    const copyAll = attachCopyButton(header, () => traceState.rawTexts.join('\n\n'), { compact: true });
    copyAll.classList.add('event-trace-copy-all');
    traceState.copyAll = copyAll;
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    header.addEventListener('click', (event) => {
        if (event.target.closest('.copy-action')) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        wrapper.classList.toggle('expanded', isHidden);
    });

    eventTraceLog = traceState;
    appendMessageNode(wrapper, { showLatestButton: false });
    return eventTraceLog;
}

function getEventTraceLabel(data) {
    if (!data || typeof data !== 'object') return '未知事件';
    const payload = data.payload || {};
    const seqMessage = data.seq && data.seq.message;
    const dataMessage = data.data && data.data.message;
    const message = seqMessage || dataMessage || data.message || {};
    if (data.label) return data.label;
    if (payload.event) return payload.event;
    if (payload.type) return payload.type;
    if (message.type === 'raw' && message.raw && message.raw.raw_data) {
        const raw = message.raw.raw_data;
        return `raw.${raw.content_type || 'content'}#${raw.chunk_id ?? '?'}`;
    }
    if (message.type) return message.type;
    if (data.type) return data.type;
    if (data.socketio_intermediate_unhandled) return 'socketio_intermediate_unhandled';
    if (data.error) return 'error';
    return '未知事件';
}

function getEventTraceTime(data) {
    const payload = data && data.payload;
    const seqMessage = data && data.seq && data.seq.message;
    const dataMessage = data && data.data && data.data.message;
    const message = seqMessage || dataMessage || {};
    const timestamp =
        (payload && payload.send_timestamp) ||
        (message && message.send_time) ||
        (data && data.context && data.context.timestamp ? data.context.timestamp / 1000 : 0);
    return timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();
}

// ── 自动订阅 & 断线重连 ──
let wsAutoReconnect = true;  // 手动断开时设为 false，阻止自动重连
let wsReconnectAttempt = 0;
let wsReconnectTimer = null;
const WS_RECONNECT_BASE_MS = 2000;
const WS_RECONNECT_MAX_MS = 30000;

function autoConnectWebSocket() {
    wsAutoReconnect = true;
    wsReconnectAttempt = 0;
    connectWebSocket();
}

function scheduleReconnect() {
    if (!wsAutoReconnect) return;
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectAttempt++;
    // 指数退避：2s → 4s → 8s → 16s → 30s（封顶）
    const delay = Math.min(WS_RECONNECT_BASE_MS * Math.pow(2, wsReconnectAttempt - 1), WS_RECONNECT_MAX_MS);
    showConnectionStatusMessage(`将在 ${(delay / 1000).toFixed(0)} 秒后自动重连（第 ${wsReconnectAttempt} 次）…`);
    wsReconnectTimer = setTimeout(() => connectWebSocket(), delay);
}

function handleWebSocketClose(event) {
    isWebSocketConnected = false;
    updateSubscribeButtonState('disconnected');
    hideAssistantActivity();

    if (event.wasClean) {
        showConnectionStatusMessage("WebSocket连接正常关闭");
    } else {
        showConnectionStatusMessage(`WebSocket连接意外断开 (code: ${event.code})`);
        scheduleReconnect();
    }
}

function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    wsOpenCallbacks.splice(0).forEach(cb => cb.reject(new Error('WebSocket连接失败')));
    hideAssistantActivity();

    let errorMessage = "WebSocket连接发生错误";
    let suggestions = "";

    if (error.type === 'error') {
        errorMessage = "无法建立WebSocket连接";
        suggestions = "请检查服务器地址是否正确，服务器是否运行正常";
    }

    showConnectionStatusMessage(`${errorMessage}。${suggestions}`);
    updateSubscribeButtonState('error');
    scheduleReconnect();
}

function updateSubscribeButtonState(state, additionalInfo = '') {
    const subscribeBtn = document.getElementById('subscribeBtn');
    if (!subscribeBtn) return;

    switch (state) {
        case 'disconnected':
            subscribeBtn.textContent = '建立消息订阅';
            subscribeBtn.disabled = false;
            subscribeBtn.className = 'btn secondary';
            break;
        case 'connecting':
            subscribeBtn.textContent = '连接中...';
            subscribeBtn.disabled = true;
            subscribeBtn.className = 'btn secondary';
            break;
        case 'connected':
            subscribeBtn.textContent = '断开订阅';
            subscribeBtn.disabled = false;
            subscribeBtn.className = 'btn danger';
            break;
        case 'error':
            subscribeBtn.textContent = '连接失败，点击重试';
            subscribeBtn.disabled = false;
            subscribeBtn.className = 'btn secondary';
            break;
    }
}

// ── 消息 @ 引用（对齐 ProjectFileMention / DirectoryMention 与后端 mention 处理器）────────

/** 与产品端一致：mention 与后续正文之间使用 NBSP */
const MENTION_PROMPT_SEPARATOR = '\u00A0';

function normalizeMentionPathSlashes(p) {
    return String(p || '').trim().replace(/\\/g, '/');
}

/** 目录路径：正斜杠、尾部 / */
function normalizeMentionDirectoryPath(raw) {
    let p = normalizeMentionPathSlashes(raw).replace(/^\.+\//, '');
    if (!p) return '';
    p = p.replace(/\/+/g, '/');
    if (!p.endsWith('/')) p += '/';
    return p;
}

/** 文件路径：正斜杠、无多余前导 */
function normalizeMentionFilePath(raw) {
    let p = normalizeMentionPathSlashes(raw).replace(/^\.+\//, '');
    return p.replace(/\/+/g, '/');
}

/**
 * 从 prompt 解析 [@directory_path:…] / [@file_path:…]，生成 mentions 数组（按出现顺序，按路径去重）。
 * project_file 在本地客户端无服务端 file_id，file_id 置空串，file_key 为 null。
 */
function parsePromptMentions(prompt) {
    if (!prompt || typeof prompt !== 'string') return [];
    const found = [];
    const dirRe = /\[@directory_path:([^\]]+)\]/g;
    const fileRe = /\[@file_path:([^\]]+)\]/g;
    let m;
    while ((m = dirRe.exec(prompt)) !== null) {
        const directory_path = normalizeMentionDirectoryPath(m[1]);
        if (directory_path) {
            found.push({ index: m.index, mention: { type: 'project_directory', directory_path } });
        }
    }
    while ((m = fileRe.exec(prompt)) !== null) {
        const file_path = normalizeMentionFilePath(m[1]);
        if (file_path) {
            const file_name = getWorkspaceFileBaseName(file_path);
            found.push({
                index: m.index,
                mention: {
                    type: 'project_file',
                    file_id: '',
                    file_key: null,
                    file_path,
                    file_name,
                },
            });
        }
    }
    found.sort((a, b) => a.index - b.index);
    const seen = new Set();
    const mentions = [];
    for (const { mention } of found) {
        const key = mention.type === 'project_directory'
            ? `d:${mention.directory_path}`
            : `f:${mention.file_path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mentions.push(mention);
    }
    return mentions;
}

let activeFiletreeContextMenu = null;

function closeFiletreeContextMenu() {
    if (activeFiletreeContextMenu) {
        activeFiletreeContextMenu.remove();
        activeFiletreeContextMenu = null;
    }
}

function openFiletreeContextMenu(clientX, clientY, items) {
    closeFiletreeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'ft-context-menu';
    menu.setAttribute('role', 'menu');
    for (const item of items) {
        const row = document.createElement('div');
        row.className = 'ft-context-menu-item';
        row.textContent = item.label;
        row.setAttribute('role', 'menuitem');
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFiletreeContextMenu();
            item.onSelect();
        });
        menu.appendChild(row);
    }
    document.body.appendChild(menu);
    activeFiletreeContextMenu = menu;
    const rect = menu.getBoundingClientRect();
    let x = clientX;
    let y = clientY;
    if (x + rect.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - rect.width - 8);
    if (y + rect.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - rect.height - 8);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    setTimeout(() => {
        document.addEventListener('click', closeFiletreeContextMenu, { once: true });
        document.addEventListener('contextmenu', closeFiletreeContextMenu, { once: true });
    }, 0);
}

function insertMentionAtCursor(snippet) {
    const ta = messageInput;
    if (!ta || ta.disabled) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + snippet + after;
    const pos = start + snippet.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
}

/** 工作区路径索引，供输入框 @ 联想（全量递归，与文件树展开状态无关） */
let workspaceMentionIndex = [];

const MENTION_PICKER_MAX = 50;

/** 输入框内 @ 触发的联想状态 */
const mentionPickerState = {
    open: false,
    start: 0,
    query: '',
    activeIndex: 0,
    filtered: [],
};

async function collectWorkspaceMentionPaths(dirHandle, pathPrefix, out) {
    const entries = [];
    for await (const entry of dirHandle.values()) {
        entries.push(entry);
    }
    entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
        const fullPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
        if (entry.kind === 'directory') {
            out.push({ kind: 'directory', path: fullPath });
            await collectWorkspaceMentionPaths(entry, fullPath, out);
        } else {
            out.push({ kind: 'file', path: fullPath });
        }
    }
}

async function refreshWorkspaceMentionIndex() {
    workspaceMentionIndex = [];
    if (!workspaceDirHandle) return;
    const out = [];
    try {
        await collectWorkspaceMentionPaths(workspaceDirHandle, '', out);
        workspaceMentionIndex = out;
    } catch (e) {
        console.warn('构建 @ 路径索引失败', e);
    }
}

/**
 * 判断光标是否处于「@ + 过滤片段」编辑态（排除正在键入 [@file_path:…] 等括号形式）
 */
function findActiveMentionQuery(value, cursor) {
    if (cursor < 0 || !value) return null;
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf('@');
    if (at < 0) return null;
    if (at > 0) {
        const ch = value[at - 1];
        if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r' && ch !== MENTION_PROMPT_SEPARATOR) {
            return null;
        }
    }
    const query = value.slice(at + 1, cursor);
    if (/[\[\]\n\r]/.test(query)) return null;
    return { start: at, query };
}

function filterMentionIndex(query) {
    const q = (query || '').trim().toLowerCase();
    const list = workspaceMentionIndex;
    if (!q) {
        return list.slice(0, MENTION_PICKER_MAX);
    }
    const scored = [];
    for (const item of list) {
        const pathLower = item.path.toLowerCase();
        const base = getWorkspaceFileBaseName(item.path).toLowerCase();
        if (pathLower.includes(q) || base.includes(q)) {
            const pri = pathLower.startsWith(q) ? 0 : base.startsWith(q) ? 1 : 2;
            const kindPri = item.kind === 'directory' ? 0 : 1;
            scored.push({ item, pri, kindPri, path: pathLower });
        }
    }
    scored.sort((a, b) => {
        if (a.pri !== b.pri) return a.pri - b.pri;
        if (a.kindPri !== b.kindPri) return a.kindPri - b.kindPri;
        return a.path.localeCompare(b.path);
    });
    return scored.slice(0, MENTION_PICKER_MAX).map(s => s.item);
}

let mentionPickerEl = null;

function ensureMentionPickerEl() {
    if (mentionPickerEl) return mentionPickerEl;
    const wrap = document.getElementById('normalModeFields');
    if (!wrap) return null;
    mentionPickerEl = document.createElement('div');
    mentionPickerEl.id = 'mentionPicker';
    mentionPickerEl.className = 'mention-picker';
    mentionPickerEl.setAttribute('role', 'listbox');
    mentionPickerEl.style.display = 'none';
    wrap.appendChild(mentionPickerEl);
    return mentionPickerEl;
}

function closeMentionPicker() {
    mentionPickerState.open = false;
    mentionPickerState.filtered = [];
    if (mentionPickerEl) {
        mentionPickerEl.classList.remove('visible');
        mentionPickerEl.style.display = 'none';
        mentionPickerEl.innerHTML = '';
    }
}

function renderMentionPickerRows(items) {
    const el = ensureMentionPickerEl();
    if (!el) return;
    el.innerHTML = '';
    if (!workspaceDirHandle) {
        const hint = document.createElement('div');
        hint.className = 'mention-picker-hint';
        hint.textContent = '请先在工作区选择项目根目录，再使用 @';
        el.appendChild(hint);
        return;
    }
    if (workspaceMentionIndex.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'mention-picker-hint';
        hint.textContent = '路径索引为空，请点击右栏「刷新」或稍候再试';
        el.appendChild(hint);
        return;
    }
    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'mention-picker-empty';
        empty.textContent = '没有匹配的工作区路径';
        el.appendChild(empty);
        return;
    }
    items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'mention-picker-item' + (idx === mentionPickerState.activeIndex ? ' active' : '');
        row.setAttribute('role', 'option');
        const kind = document.createElement('span');
        kind.className = 'mention-picker-kind';
        kind.textContent = item.kind === 'directory' ? '目录' : '文件';
        const path = document.createElement('span');
        path.className = 'mention-picker-path';
        path.textContent = item.kind === 'directory'
            ? normalizeMentionDirectoryPath(item.path)
            : normalizeMentionFilePath(item.path);
        row.appendChild(kind);
        row.appendChild(path);
        row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            applyMentionPickerChoice(item);
        });
        el.appendChild(row);
    });
}

function applyMentionPickerChoice(item) {
    const ta = messageInput;
    if (!ta || !mentionPickerState.open) return;
    const end = ta.selectionStart ?? ta.value.length;
    const start = mentionPickerState.start;
    const snippet = item.kind === 'directory'
        ? `[@directory_path:${normalizeMentionDirectoryPath(item.path)}]${MENTION_PROMPT_SEPARATOR}`
        : `[@file_path:${normalizeMentionFilePath(item.path)}]${MENTION_PROMPT_SEPARATOR}`;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + snippet + after;
    const pos = start + snippet.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    closeMentionPicker();
}

function syncMentionPickerFromInput() {
    if (isAdvancedMode || !messageInput || messageInput.disabled) {
        closeMentionPicker();
        return;
    }
    const ta = messageInput;
    const cursor = ta.selectionStart ?? 0;
    const hit = findActiveMentionQuery(ta.value, cursor);
    if (!hit) {
        closeMentionPicker();
        return;
    }
    const prevStart = mentionPickerState.start;
    const prevQuery = mentionPickerState.query;
    mentionPickerState.open = true;
    mentionPickerState.start = hit.start;
    mentionPickerState.query = hit.query;
    mentionPickerState.filtered = filterMentionIndex(hit.query);
    if (prevStart !== hit.start || prevQuery !== hit.query) {
        mentionPickerState.activeIndex = 0;
    }
    if (mentionPickerState.activeIndex >= mentionPickerState.filtered.length) {
        mentionPickerState.activeIndex = 0;
    }
    const el = ensureMentionPickerEl();
    if (!el) return;
    renderMentionPickerRows(mentionPickerState.filtered);
    el.style.display = 'block';
    el.classList.add('visible');
}

function handleMentionPickerKeydown(e) {
    if (!mentionPickerState.open) return false;
    const items = mentionPickerState.filtered;
    if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionPicker();
        return true;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length) {
            mentionPickerState.activeIndex = (mentionPickerState.activeIndex + 1) % items.length;
            renderMentionPickerRows(items);
        }
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length) {
            mentionPickerState.activeIndex = (mentionPickerState.activeIndex - 1 + items.length) % items.length;
            renderMentionPickerRows(items);
        }
        return true;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
        if (items.length && items[mentionPickerState.activeIndex]) {
            e.preventDefault();
            applyMentionPickerChoice(items[mentionPickerState.activeIndex]);
            return true;
        }
    }
    if (e.key === 'Tab' && !e.shiftKey && items.length && items[mentionPickerState.activeIndex]) {
        e.preventDefault();
        applyMentionPickerChoice(items[mentionPickerState.activeIndex]);
        return true;
    }
    return false;
}

// ── 工作区文件树 ──────────────────────────────────────────────────────────────

const filetreeContainer = document.getElementById('filetreeContainer');
const selectWorkspaceBtn = document.getElementById('selectWorkspaceBtn');
const refreshTreeBtn = document.getElementById('refreshTreeBtn');
const mountDirInput = document.getElementById('mountDirInput');
const applyMountDirBtn = document.getElementById('applyMountDirBtn');
const filePreviewWorkbench = document.getElementById('filePreviewWorkbench');
const filePreviewTabsEl = document.getElementById('filePreviewTabs');
const filePreviewMain = filePreviewWorkbench?.querySelector('.file-preview-main') || null;
const filePreviewBody = document.getElementById('filePreviewBody');
const filePreviewMeta = document.getElementById('filePreviewMeta');
const filePreviewClose = document.getElementById('filePreviewClose');
const filePreviewOpenBtn = document.getElementById('filePreviewOpenBtn');
const filePreviewRenderBtn = document.getElementById('filePreviewRenderBtn');

/** 媒体/PDF 预览用的 blob URL，关闭或切换预览时需 revoke */
let filePreviewObjectUrl = null;

/** 当前正在预览的文件，供"新窗口打开/渲染预览"按钮使用 */
let currentPreviewFile = null;
let currentPreviewPath = '';
let currentPreviewCopyText = '';
const filePreviewTabs = new Map();
let activeFilePreviewPath = '';
let filePreviewScrollPositions = {};
let filePreviewScrollSaveFrame = null;
let isRestoringFilePreviewState = false;

const UNSUPPORTED_REMOTE_IMAGE_EXT_RE = /\.(heic|heif|tif|tiff)(?:[?#]|$)/i;

function normalizeRemoteImageUrl(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    try {
        const normalized = value.startsWith('//') ? `https:${value}` : value;
        const url = new URL(normalized);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (e) {
        return '';
    }
}

function buildPreviewImageProxyUrl(remoteUrl) {
    const base = (serverUrlInput?.value?.trim() || 'http://127.0.0.1:8002').replace(/\/+$/, '');
    return `${base}/api/v1/media/image-preview?url=${encodeURIComponent(remoteUrl)}`;
}

function usePreviewImageProxy(img, originalSrc) {
    const remoteUrl = normalizeRemoteImageUrl(originalSrc);
    if (!remoteUrl) return false;
    img.dataset.originalSrc = remoteUrl;
    img.src = buildPreviewImageProxyUrl(remoteUrl);
    return true;
}

function enhanceFilePreviewMarkdownImages(root) {
    if (!root) return;
    root.querySelectorAll('img[src]').forEach((img) => {
        const originalSrc = normalizeRemoteImageUrl(img.getAttribute('src'));
        if (!originalSrc) return;

        img.dataset.originalSrc = originalSrc;
        img.decoding = 'async';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
            if (img.dataset.previewProxyTried === 'true') return;
            img.dataset.previewProxyTried = 'true';
            usePreviewImageProxy(img, img.dataset.originalSrc || originalSrc);
        });

        if (UNSUPPORTED_REMOTE_IMAGE_EXT_RE.test(originalSrc)) {
            img.dataset.previewProxyTried = 'true';
            usePreviewImageProxy(img, originalSrc);
        }
    });
}

/**
 * 后端返回的 workspace 绝对路径（如 /Users/.../super-magic/.workspace），
 * 用于拼接 file:// URL。启动时自动从后端获取。
 */
let workspaceAbsolutePath = localStorage.getItem(WORKSPACE_ABSOLUTE_PATH_KEY) || '';

let wsPathRetryTimer = null;
let wsPathRetryAttempt = 0;
const WS_PATH_RETRY_BASE_MS = 3000;
const WS_PATH_RETRY_MAX_MS = 30000;
const WS_PATH_MAX_RETRIES = 10;

async function fetchWorkspaceAbsolutePath() {
    try {
        const base = document.getElementById('serverUrl')?.value || 'http://127.0.0.1:8002';
        const resp = await fetch(`${base}/api/v1/workspace/info`);
        const json = await resp.json();
        if (json?.data?.workspace_path) {
            workspaceAbsolutePath = json.data.workspace_path.replace(/\/+$/, '');
            localStorage.setItem(WORKSPACE_ABSOLUTE_PATH_KEY, workspaceAbsolutePath);
            wsPathRetryAttempt = 0;
            if (wsPathRetryTimer) { clearTimeout(wsPathRetryTimer); wsPathRetryTimer = null; }
            return;
        }
    } catch (_) { /* ignore */ }
    // 失败时自动重试
    if (wsPathRetryAttempt < WS_PATH_MAX_RETRIES) {
        wsPathRetryAttempt++;
        const delay = Math.min(WS_PATH_RETRY_BASE_MS * Math.pow(2, wsPathRetryAttempt - 1), WS_PATH_RETRY_MAX_MS);
        wsPathRetryTimer = setTimeout(fetchWorkspaceAbsolutePath, delay);
    }
}

// 页面加载后立即尝试获取
fetchWorkspaceAbsolutePath();

function isHtmlPreviewable(filePath, file) {
    const ext = getWorkspaceFileExt(filePath);
    if (ext === 'html' || ext === 'htm' || ext === 'svg') return true;
    const mime = (file && file.type) || '';
    return mime === 'text/html' || mime === 'image/svg+xml';
}

/**
 * 构造当前预览文件的 file:// URL。
 * 能拿到 workspace 绝对路径时返回 file:// URL，否则返回 null 降级为 blob。
 */
function buildFileUrl(filePath) {
    if (!workspaceAbsolutePath || !filePath) return null;
    // filePath 是工作区内的相对路径（如 hello-world/index.html）
    return `file://${workspaceAbsolutePath}/${filePath}`;
}

/**
 * 在新窗口打开当前预览文件。
 * 优先用 file:// URL（需要后端返回过 workspace 路径），否则降级 blob URL。
 */
function openCurrentPreviewInNewTab() {
    if (!currentPreviewFile) return;
    const fileUrl = buildFileUrl(currentPreviewPath);
    if (fileUrl) {
        window.open(fileUrl, '_blank');
    } else {
        // 降级：blob URL
        const type = currentPreviewFile.type || 'application/octet-stream';
        const blob = currentPreviewFile.slice(0, currentPreviewFile.size, type);
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) alert('浏览器拦截了新窗口，请允许本站点的弹出窗口后重试。');
    }
}

/** 画布预览加载的图片/视频 blob URL 列表，关闭或切换视图时统一 revoke */
let canvasBlobUrls = [];

function revokeFilePreviewObjectUrl() {
    if (filePreviewObjectUrl) {
        URL.revokeObjectURL(filePreviewObjectUrl);
        filePreviewObjectUrl = null;
    }
}

function revokeCanvasBlobUrls() {
    for (const url of canvasBlobUrls) URL.revokeObjectURL(url);
    canvasBlobUrls = [];
}

function hideFilePreview() {
    persistActiveFilePreviewScroll();
    resetActivePreviewSurface();
    setFilePreviewWorkbenchVisible(false);
    saveFilePreviewState();
}

function getWorkspaceFileBaseName(filePath) {
    const i = filePath.lastIndexOf('/');
    return i >= 0 ? filePath.slice(i + 1) : filePath;
}

function getWorkspaceFileExt(filePath) {
    const base = getWorkspaceFileBaseName(filePath);
    const dot = base.lastIndexOf('.');
    if (dot <= 0) return '';
    return base.slice(dot + 1).toLowerCase();
}

/** 无合适浏览器内预览方式的扩展名（压缩包、办公二进制、可执行文件等） */
const WORKSPACE_PREVIEW_UNSUPPORTED_EXT = new Set([
    'zip', 'rar', '7z', 'gz', 'tgz', 'xz', 'bz2', 'tar', 'lz4', 'zst', 'cab',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    'exe', 'dll', 'so', 'dylib', 'bin', 'dmg', 'iso', 'img', 'msi', 'apk', 'ipa',
    'otf', 'ttf', 'eot', 'woff', 'woff2',
    'sqlite', 'db',
    'psd', 'ai',
    'heic', 'heif',
    'class', 'jar', 'war', 'ear',
    'pyc', 'pyo', 'o', 'obj', 'lib', 'a',
    'wasm', 'wat',
    'epub', 'mobi',
]);

const WORKSPACE_PREVIEW_IMAGE_EXT = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'jxl',
]);

const WORKSPACE_PREVIEW_VIDEO_EXT = new Set([
    'mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv', 'avi',
]);

const WORKSPACE_PREVIEW_AUDIO_EXT = new Set([
    'mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'weba',
]);

/** 按扩展名视为可文本预览（UTF-8 读取；过大仍截断） */
const WORKSPACE_PREVIEW_TEXT_EXT = new Set([
    'md', 'mdx', 'txt', 'log', 'json', 'jsonc', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
    'mts', 'cts', 'vue', 'svelte', 'astro',
    'py', 'pyi', 'pyw', 'rb', 'php', 'phtml', 'java', 'kt', 'kts', 'go', 'rs',
    'c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'cs', 'fs', 'fsx', 'swift', 'scala', 'sc',
    'html', 'htm', 'xhtml', 'xml',
    'css', 'scss', 'sass', 'less', 'styl',
    'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'nu',
    'sql', 'graphql', 'gql',
    'csv', 'tsv', 'tab',
    'rtf', 'tex', 'bib',
    'gradle', 'plist', 'vm', 'ejs', 'hbs', 'pug', 'jade', 'mustache',
    'dockerignore', 'gitattributes', 'editorconfig',
    'lock', 'mod', 'sum', 'nix',
    'dart', 'lua', 'ex', 'exs', 'erl', 'hrl', 'clj', 'cljs', 'edn', 'nim', 'zig', 'v',
    'r', 'jl', 'pl', 'pm', 'pas', 'pp', 'lpr', 'cr', 'sv', 'svh', 'vhd', 'vhdl',
]);

function isWorkspaceTextBasename(filePath) {
    const base = getWorkspaceFileBaseName(filePath);
    const lower = base.toLowerCase();
    if (lower === 'dockerfile' || lower === 'makefile' || lower === 'jenkinsfile' ||
        lower === 'vagrantfile' || lower === 'gemfile' || lower === 'rakefile' ||
        lower === 'procfile' || lower === 'cargo.toml' || lower === 'cargo.lock') {
        return true;
    }
    if (lower === '.gitignore' || lower === '.dockerignore' || lower === '.editorconfig' ||
        lower === '.npmrc' || lower === '.yarnrc' || lower === '.prettierrc' ||
        lower === '.babelrc' || lower === '.eslintrc') {
        return true;
    }
    if (lower.startsWith('.env')) return true;
    if (/^readme(\.|$)/i.test(base) || /^license(\.|$)/i.test(base) ||
        /^changelog(\.|$)/i.test(base) || /^contributing(\.|$)/i.test(base)) {
        return true;
    }
    return false;
}

function isMarkdownPreviewFile(filePath) {
    const ext = getWorkspaceFileExt(filePath);
    return ext === 'md' || ext === 'mdx';
}

/**
 * @returns {'image'|'video'|'audio'|'pdf'|'text'|'unsupported'}
 */
function getWorkspacePreviewKind(filePath, file) {
    const mime = (file && file.type) || '';
    const ext = getWorkspaceFileExt(filePath);

    if (isWorkspaceTextBasename(filePath)) return 'text';

    if (WORKSPACE_PREVIEW_UNSUPPORTED_EXT.has(ext)) return 'unsupported';

    // 扩展名先于含糊 MIME（例如 SVG 常被标为 application/xml）
    if (WORKSPACE_PREVIEW_IMAGE_EXT.has(ext)) return 'image';
    if (WORKSPACE_PREVIEW_VIDEO_EXT.has(ext)) return 'video';
    if (WORKSPACE_PREVIEW_AUDIO_EXT.has(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';

    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf') return 'pdf';

    if (mime.startsWith('text/')) return 'text';
    if (mime === 'application/json' || mime === 'application/xml' ||
        mime === 'application/javascript' || mime === 'application/x-javascript' ||
        mime === 'application/sql' || mime === 'application/x-sh' ||
        mime === 'application/xhtml+xml' || mime === 'application/rtf' ||
        mime === 'application/x-yaml' || mime === 'application/toml') {
        return 'text';
    }

    if (WORKSPACE_PREVIEW_TEXT_EXT.has(ext)) return 'text';

    if (mime === 'application/octet-stream' || mime === '') {
        return 'unsupported';
    }

    return 'unsupported';
}

function appendPreviewMessage(bodyEl, message) {
    const pre = document.createElement('pre');
    pre.className = 'file-preview-content file-preview-message';
    pre.textContent = message;
    bodyEl.appendChild(pre);
}

const PREVIEW_KIND_LABEL = {
    html: 'HTML',
    image: '图片',
    video: '视频',
    audio: '音频',
    pdf: 'PDF',
    text: '文本',
    canvas: '画布',
    unsupported: '不可预览',
};

function formatFileSizeBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const n = bytes / Math.pow(k, i);
    const digits = i === 0 ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2;
    return `${n.toFixed(digits)} ${sizes[i]}`;
}

function formatFileModifiedTime(ms) {
    if (ms == null || !Number.isFinite(ms)) return '—';
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return '—';
    }
}

/** 将秒转为 mm:ss 或 h:mm:ss */
function formatMediaDurationSeconds(sec) {
    if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

function buildBasePreviewMetaRows(file, filePath, kind) {
    const mime = file.type && file.type.length ? file.type : '（未知）';
    const ext = getWorkspaceFileExt(filePath);
    return [
        { label: '文件名', value: getWorkspaceFileBaseName(filePath) },
        { label: '路径', value: filePath },
        { label: '扩展名', value: ext ? `.${ext}` : '（无）' },
        { label: '预览类型', value: PREVIEW_KIND_LABEL[kind] || String(kind) },
        { label: '大小', value: formatFileSizeBytes(file.size) },
        { label: 'MIME', value: mime },
        { label: '修改时间', value: formatFileModifiedTime(file.lastModified) },
    ];
}

function renderFilePreviewMetaRows(metaEl, rows) {
    if (!metaEl) return;
    metaEl.innerHTML = '';
    const fileNameRow = rows.find(row => row.label === '文件名');
    const pathRow = rows.find(row => row.label === '路径');
    const chipRows = rows.filter(row => row && row.label !== '文件名' && row.label !== '路径' && row.value !== '（未知）');

    const main = document.createElement('div');
    main.className = 'file-preview-meta-main';

    const title = document.createElement('div');
    title.className = 'file-preview-meta-title';
    title.textContent = fileNameRow?.value || '未选择文件';

    const path = document.createElement('div');
    path.className = 'file-preview-meta-path';
    path.textContent = pathRow?.value || '';
    path.title = pathRow?.value || '';

    main.appendChild(title);
    main.appendChild(path);
    metaEl.appendChild(main);

    const chips = document.createElement('div');
    chips.className = 'file-preview-meta-chips';
    for (const row of rows) {
        if (!row || !chipRows.includes(row)) continue;
        const wrap = document.createElement('div');
        wrap.className = 'file-preview-meta-chip';
        const lab = document.createElement('span');
        lab.className = 'file-preview-meta-label';
        lab.textContent = `${row.label}:`;
        const val = document.createElement('span');
        val.className = 'file-preview-meta-value';
        val.textContent = row.value;
        wrap.appendChild(lab);
        wrap.appendChild(val);
        chips.appendChild(wrap);
    }
    renderFilePreviewCopyButton(chips);
    metaEl.appendChild(chips);
}

function renderFilePreviewCopyButton(metaEl) {
    if (!metaEl || !currentPreviewCopyText) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-preview-action-btn file-preview-copy-btn';
    button.title = '复制当前预览内容';
    button.textContent = '复制';
    button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const ok = await copyTextToClipboard(currentPreviewCopyText);
        const originalText = button.textContent;
        button.textContent = ok ? '已复制' : '复制失败';
        button.classList.toggle('copied', ok);
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 1400);
    });
    metaEl.appendChild(button);
}

function setFilePreviewMeta(file, filePath, kind, extraRows) {
    if (!filePreviewMeta) return;
    const base = buildBasePreviewMetaRows(file, filePath, kind);
    const rows = extraRows && extraRows.length ? base.concat(extraRows) : base;
    renderFilePreviewMetaRows(filePreviewMeta, rows);
}

function setFilePreviewWorkbenchVisible(visible) {
    if (!filePreviewWorkbench) return;
    filePreviewWorkbench.hidden = !visible;
    filePreviewWorkbench.closest('.main-content')?.classList.toggle('main-content-preview-open', visible);
    updateScrollButtonPosition();
}

function isToolDetailPreviewPath(filePath) {
    return filePath === TOOL_DETAIL_PREVIEW_PATH;
}

function createToolDetailPreviewTab(toolDetail) {
    if (!toolDetail || (
        (typeof toolDetail.content !== 'string' || !toolDetail.content) &&
        (typeof toolDetail.modelContent !== 'string' || !toolDetail.modelContent)
    )) return null;
    return {
        path: TOOL_DETAIL_PREVIEW_PATH,
        type: 'tool-detail',
        title: '工具详情',
        detailTitle: typeof toolDetail.title === 'string' && toolDetail.title ? toolDetail.title : '最近一次工具详情',
        content: typeof toolDetail.content === 'string' ? toolDetail.content : '',
        modelContent: typeof toolDetail.modelContent === 'string' ? toolDetail.modelContent : '',
        updatedAt: Number.isFinite(Number(toolDetail.updatedAt)) ? Number(toolDetail.updatedAt) : Date.now(),
    };
}

function normalizeToolDetailPreviewState(value) {
    if (!value || typeof value !== 'object') return null;
    if ((typeof value.content !== 'string' || !value.content) &&
        (typeof value.modelContent !== 'string' || !value.modelContent)) return null;
    return {
        title: typeof value.title === 'string' ? value.title : '',
        content: typeof value.content === 'string' ? value.content : '',
        modelContent: typeof value.modelContent === 'string' ? value.modelContent : '',
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : Date.now(),
    };
}

function readFilePreviewState() {
    try {
        const raw = localStorage.getItem(FILE_PREVIEW_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.tabs)) return null;
        return {
            tabs: parsed.tabs.filter(path => typeof path === 'string' && path.length > 0),
            activePath: typeof parsed.activePath === 'string' ? parsed.activePath : '',
            visible: parsed.visible !== false,
            scrollPositions: parsed.scrollPositions && typeof parsed.scrollPositions === 'object'
                ? parsed.scrollPositions
                : {},
            toolDetail: normalizeToolDetailPreviewState(parsed.toolDetail),
        };
    } catch (e) {
        return null;
    }
}

function restorePersistedVirtualToolDetailPreview() {
    const saved = readFilePreviewState();
    if (!saved) return false;
    const shouldRestore = saved.tabs.includes(TOOL_DETAIL_PREVIEW_PATH) && saved.toolDetail;
    if (!shouldRestore) return false;

    const tab = createToolDetailPreviewTab(saved.toolDetail);
    if (!tab) return false;
    filePreviewTabs.set(TOOL_DETAIL_PREVIEW_PATH, tab);
    filePreviewScrollPositions = saved.scrollPositions || {};

    const shouldShowVirtualTab = saved.visible && (
        saved.activePath === TOOL_DETAIL_PREVIEW_PATH ||
        saved.tabs.length === 1
    );
    if (shouldShowVirtualTab) {
        activeFilePreviewPath = TOOL_DETAIL_PREVIEW_PATH;
        renderFilePreviewTabs();
        setFilePreviewWorkbenchVisible(true);
        renderToolDetailPreviewTab(tab);
        restoreFilePreviewScroll(TOOL_DETAIL_PREVIEW_PATH);
    }
    return true;
}

function initFirstOpenFilePreviewPlaceholder() {
    if (localStorage.getItem(FILE_PREVIEW_INITIALIZED_KEY) === 'true') return;
    localStorage.setItem(FILE_PREVIEW_INITIALIZED_KEY, 'true');
    if (localStorage.getItem(FILE_PREVIEW_STATE_KEY)) return;
    renderEmptyFilePreviewPlaceholder();
}

function saveFilePreviewState() {
    if (isRestoringFilePreviewState) return;
    const tabs = [...filePreviewTabs.keys()];
    const visible = filePreviewWorkbench ? !filePreviewWorkbench.hidden : false;
    if (!tabs.length && !visible) {
        localStorage.removeItem(FILE_PREVIEW_STATE_KEY);
        return;
    }
    const toolDetailTab = filePreviewTabs.get(TOOL_DETAIL_PREVIEW_PATH);
    const state = {
        tabs,
        activePath: activeFilePreviewPath,
        visible,
        scrollPositions: filePreviewScrollPositions,
    };
    if (toolDetailTab && toolDetailTab.type === 'tool-detail' && toolDetailTab.content) {
        state.toolDetail = {
            title: toolDetailTab.detailTitle || '最近一次工具详情',
            content: toolDetailTab.content,
            modelContent: toolDetailTab.modelContent || '',
            updatedAt: toolDetailTab.updatedAt || Date.now(),
        };
    }
    localStorage.setItem(FILE_PREVIEW_STATE_KEY, JSON.stringify(state));
}

function persistActiveFilePreviewScroll() {
    if (!activeFilePreviewPath || !filePreviewBody) return;
    filePreviewScrollPositions[activeFilePreviewPath] = filePreviewBody.scrollTop;
}

function scheduleFilePreviewScrollSave() {
    if (!activeFilePreviewPath || !filePreviewBody || isRestoringFilePreviewState) return;
    if (filePreviewScrollSaveFrame) return;
    filePreviewScrollSaveFrame = requestAnimationFrame(() => {
        filePreviewScrollSaveFrame = null;
        persistActiveFilePreviewScroll();
        saveFilePreviewState();
    });
}

function restoreFilePreviewScroll(filePath) {
    const savedTop = Number(filePreviewScrollPositions[filePath]);
    if (!filePreviewBody || !Number.isFinite(savedTop)) return;
    const apply = () => {
        filePreviewBody.scrollTop = Math.max(0, savedTop);
    };
    requestAnimationFrame(apply);
    setTimeout(apply, 80);
}

if (filePreviewBody) {
    filePreviewBody.addEventListener('scroll', scheduleFilePreviewScrollSave);
}

function renderEmptyFilePreviewPlaceholder() {
    resetActivePreviewSurface();
    activeFilePreviewPath = '';
    currentPreviewFile = null;
    currentPreviewPath = '';
    renderFilePreviewTabs();
    setFilePreviewWorkbenchVisible(true);
    if (filePreviewMeta) {
        filePreviewMeta.innerHTML = '';
        const main = document.createElement('div');
        main.className = 'file-preview-meta-main';
        const title = document.createElement('div');
        title.className = 'file-preview-meta-title';
        title.textContent = '当前没有打开的标签页';
        const path = document.createElement('div');
        path.className = 'file-preview-meta-path';
        path.textContent = '从左侧文件列表选择文件，或右键标签页管理已打开文件';
        main.appendChild(title);
        main.appendChild(path);
        filePreviewMeta.appendChild(main);
    }
    if (filePreviewBody) {
        const empty = document.createElement('div');
        empty.className = 'file-preview-empty';
        empty.innerHTML = '<div class="file-preview-empty-title">没有打开的文件</div><div class="file-preview-empty-text">点击左侧文件列表中的文件即可在这里预览。</div>';
        filePreviewBody.appendChild(empty);
    }
    saveFilePreviewState();
}

function renderFilePreviewTabs() {
    if (!filePreviewTabsEl) return;
    filePreviewTabsEl.innerHTML = '';
    for (const tab of filePreviewTabs.values()) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `file-preview-tab${tab.path === activeFilePreviewPath ? ' active' : ''}`;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(tab.path === activeFilePreviewPath));
        btn.title = tab.path;

        const title = document.createElement('span');
        title.className = 'file-preview-tab-title';
        title.textContent = tab.title || getWorkspaceFileBaseName(tab.path);

        const close = document.createElement('span');
        close.className = 'file-preview-tab-close';
        close.textContent = '×';
        close.title = '关闭';

        btn.appendChild(title);
        btn.appendChild(close);
        btn.addEventListener('click', async (event) => {
            if (event.target.closest('.file-preview-tab-close')) {
                event.stopPropagation();
                closeFilePreviewTab(tab.path);
                return;
            }
            await activateFilePreviewTab(tab.path);
        });
        btn.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openFilePreviewTabContextMenu(event.clientX, event.clientY, tab.path);
        });
        filePreviewTabsEl.appendChild(btn);
    }
}

function resetActivePreviewSurface() {
    revokeFilePreviewObjectUrl();
    revokeCanvasBlobUrls();
    const canvasPanel = document.getElementById('canvasRightPanel');
    if (canvasPanel) canvasPanel.remove();
    const canvasModal = document.getElementById('canvasMediaModal');
    if (canvasModal) canvasModal.remove();
    filePreviewMain?.classList.remove('has-canvas-panel');
    if (filePreviewBody) {
        filePreviewBody.innerHTML = '';
        filePreviewBody.classList.remove('file-preview-body-markdown', 'file-preview-body-tool-detail');
    }
    if (filePreviewMeta) filePreviewMeta.innerHTML = '';
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = '';
    if (filePreviewRenderBtn) filePreviewRenderBtn.style.display = 'none';
    currentPreviewCopyText = '';
}

function getStoredToolDetailModelRatio() {
    const saved = Number(localStorage.getItem(TOOL_DETAIL_MODEL_RATIO_KEY));
    if (!Number.isFinite(saved)) return 0.5;
    return Math.min(Math.max(saved, 0.18), 0.82);
}

function isToolDetailModelCollapsed() {
    return localStorage.getItem(TOOL_DETAIL_MODEL_COLLAPSED_KEY) === 'true';
}

function applyToolDetailSplitLayout(userPanel, modelPanel, modelRatio, collapsed) {
    if (!userPanel || !modelPanel) return;
    modelPanel.classList.toggle('collapsed', collapsed);
    if (collapsed) {
        userPanel.style.flex = '1 1 auto';
        modelPanel.style.flex = '0 0 42px';
        return;
    }
    const ratio = Math.min(Math.max(modelRatio, 0.18), 0.82);
    userPanel.style.flex = `${1 - ratio} 1 0`;
    modelPanel.style.flex = `${ratio} 1 0`;
}

function createToolDetailSplitResizer(split, userPanel, modelPanel) {
    const resizer = document.createElement('div');
    resizer.className = 'file-preview-tool-detail-resizer';
    resizer.title = '上下拖拽调整区域占比，拖到底部可折叠大模型内容';

    let dragging = false;
    const syncFromPointer = (clientY) => {
        const rect = split.getBoundingClientRect();
        if (!rect.height) return;
        const rawRatio = (rect.bottom - clientY) / rect.height;
        const collapsed = rawRatio < 0.08 || clientY > rect.bottom - 54;
        if (collapsed) {
            localStorage.setItem(TOOL_DETAIL_MODEL_COLLAPSED_KEY, 'true');
            applyToolDetailSplitLayout(userPanel, modelPanel, getStoredToolDetailModelRatio(), true);
            return;
        }
        const ratio = Math.min(Math.max(rawRatio, 0.18), 0.82);
        localStorage.setItem(TOOL_DETAIL_MODEL_RATIO_KEY, String(ratio));
        localStorage.setItem(TOOL_DETAIL_MODEL_COLLAPSED_KEY, 'false');
        applyToolDetailSplitLayout(userPanel, modelPanel, ratio, false);
    };

    const stopDragging = () => {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stopDragging);
    };
    const onMouseMove = (event) => {
        if (!dragging) return;
        syncFromPointer(event.clientY);
        event.preventDefault();
    };

    resizer.addEventListener('mousedown', (event) => {
        dragging = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDragging);
        event.preventDefault();
    });

    return resizer;
}

function renderToolDetailPreviewTab(tab) {
    if (!filePreviewBody || !filePreviewWorkbench) return;
    resetActivePreviewSurface();
    currentPreviewFile = null;
    currentPreviewPath = TOOL_DETAIL_PREVIEW_PATH;
    currentPreviewCopyText = '';
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = 'none';
    const updatedAt = tab.updatedAt ? new Date(tab.updatedAt).toLocaleTimeString() : '—';
    renderFilePreviewMetaRows(filePreviewMeta, [
        { label: '文件名', value: '工具详情.md' },
        { label: '路径', value: tab.detailTitle || '最近一次工具详情' },
        { label: '预览类型', value: 'Markdown' },
        { label: '来源', value: tab.detailTitle || '工具详情' },
        { label: '更新时间', value: updatedAt },
    ]);
    filePreviewBody.classList.add('file-preview-body-markdown', 'file-preview-body-tool-detail');

    const split = document.createElement('div');
    split.className = 'file-preview-tool-detail-split';

    let userPanel = null;
    if (tab.content) {
        userPanel = document.createElement('section');
        userPanel.className = 'file-preview-tool-detail-panel file-preview-tool-detail-user';
        const userTitle = document.createElement('div');
        userTitle.className = 'file-preview-tool-detail-panel-title';
        const titleText = document.createElement('span');
        titleText.textContent = '用户看到的详情';
        const viewSwitch = document.createElement('div');
        viewSwitch.className = 'file-preview-tool-detail-view-switch';
        const renderedBtn = document.createElement('button');
        renderedBtn.type = 'button';
        renderedBtn.className = 'file-preview-tool-detail-view-btn active';
        renderedBtn.textContent = '渲染';
        const sourceBtn = document.createElement('button');
        sourceBtn.type = 'button';
        sourceBtn.className = 'file-preview-tool-detail-view-btn';
        sourceBtn.textContent = '原文';
        viewSwitch.appendChild(renderedBtn);
        viewSwitch.appendChild(sourceBtn);
        const userCopyBtn = document.createElement('button');
        userCopyBtn.type = 'button';
        userCopyBtn.className = 'file-preview-tool-detail-view-btn file-preview-tool-detail-copy-btn';
        userCopyBtn.textContent = '复制';
        userCopyBtn.title = '复制用户看到的详情';
        const userActions = document.createElement('div');
        userActions.className = 'file-preview-tool-detail-panel-actions';
        userActions.appendChild(viewSwitch);
        userActions.appendChild(userCopyBtn);
        userTitle.appendChild(titleText);
        userTitle.appendChild(userActions);

        const article = document.createElement('article');
        article.className = 'file-preview-markdown ai-markdown';
        try {
            article.innerHTML = renderMarkdownContent(tab.content || '');
        } catch (e) {
            article.textContent = tab.content || '';
        }
        enhanceFilePreviewMarkdownImages(article);
        const source = document.createElement('pre');
        source.className = 'file-preview-model-content file-preview-tool-source-content';
        source.textContent = tab.content;
        source.style.display = 'none';
        renderedBtn.addEventListener('click', () => {
            renderedBtn.classList.add('active');
            sourceBtn.classList.remove('active');
            article.style.display = '';
            source.style.display = 'none';
        });
        sourceBtn.addEventListener('click', () => {
            sourceBtn.classList.add('active');
            renderedBtn.classList.remove('active');
            article.style.display = 'none';
            source.style.display = '';
        });
        userCopyBtn.addEventListener('click', async () => {
            const ok = await copyTextToClipboard(tab.content || '');
            const originalText = userCopyBtn.textContent;
            userCopyBtn.textContent = ok ? '已复制' : '失败';
            userCopyBtn.classList.toggle('active', ok);
            setTimeout(() => {
                userCopyBtn.textContent = originalText;
                userCopyBtn.classList.remove('active');
            }, 1400);
        });
        userPanel.appendChild(userTitle);
        userPanel.appendChild(article);
        userPanel.appendChild(source);
        split.appendChild(userPanel);
    }

    const modelPanel = document.createElement('section');
    modelPanel.className = 'file-preview-tool-detail-panel file-preview-tool-detail-model';
    const modelTitle = document.createElement('div');
    modelTitle.className = 'file-preview-tool-detail-panel-title';
    const modelTitleText = document.createElement('span');
    modelTitleText.textContent = '大模型看到的内容';
    const modelActions = document.createElement('div');
    modelActions.className = 'file-preview-tool-detail-panel-actions';
    const modelViewSwitch = document.createElement('div');
    modelViewSwitch.className = 'file-preview-tool-detail-view-switch';
    const modelRenderedBtn = document.createElement('button');
    modelRenderedBtn.type = 'button';
    modelRenderedBtn.className = 'file-preview-tool-detail-view-btn active';
    modelRenderedBtn.textContent = '渲染';
    const modelSourceBtn = document.createElement('button');
    modelSourceBtn.type = 'button';
    modelSourceBtn.className = 'file-preview-tool-detail-view-btn';
    modelSourceBtn.textContent = '原文';
    modelViewSwitch.appendChild(modelRenderedBtn);
    modelViewSwitch.appendChild(modelSourceBtn);
    const modelCopyBtn = document.createElement('button');
    modelCopyBtn.type = 'button';
    modelCopyBtn.className = 'file-preview-tool-detail-view-btn file-preview-tool-detail-copy-btn';
    modelCopyBtn.textContent = '复制';
    modelCopyBtn.disabled = !tab.modelContent;
    modelCopyBtn.title = tab.modelContent ? '复制大模型看到的内容' : '当前消息没有可复制的大模型内容';
    modelActions.appendChild(modelViewSwitch);
    modelActions.appendChild(modelCopyBtn);
    modelTitle.appendChild(modelTitleText);
    modelTitle.appendChild(modelActions);

    const modelArticle = document.createElement('article');
    modelArticle.className = tab.modelContent
        ? 'file-preview-markdown ai-markdown'
        : 'file-preview-markdown ai-markdown file-preview-model-empty';
    if (tab.modelContent) {
        try {
            modelArticle.innerHTML = renderMarkdownContent(tab.modelContent);
        } catch (e) {
            modelArticle.textContent = tab.modelContent;
        }
    } else {
        modelArticle.textContent = '当前消息未包含 ToolResult.content。请确认请求体 dynamic_config.message_version 为 v2，且后端 ENABLE_LOCAL_DEBUG_MODE=true 已生效。';
    }
    enhanceFilePreviewMarkdownImages(modelArticle);

    const modelSource = document.createElement('pre');
    modelSource.className = tab.modelContent
        ? 'file-preview-model-content'
        : 'file-preview-model-content file-preview-model-empty';
    modelSource.textContent = tab.modelContent || '当前消息未包含 ToolResult.content。请确认请求体 dynamic_config.message_version 为 v2，且后端 ENABLE_LOCAL_DEBUG_MODE=true 已生效。';
    modelSource.style.display = 'none';
    modelRenderedBtn.addEventListener('click', () => {
        modelRenderedBtn.classList.add('active');
        modelSourceBtn.classList.remove('active');
        modelArticle.style.display = '';
        modelSource.style.display = 'none';
    });
    modelSourceBtn.addEventListener('click', () => {
        modelSourceBtn.classList.add('active');
        modelRenderedBtn.classList.remove('active');
        modelArticle.style.display = 'none';
        modelSource.style.display = '';
    });
    modelCopyBtn.addEventListener('click', async () => {
        if (!tab.modelContent) return;
        const ok = await copyTextToClipboard(tab.modelContent);
        const originalText = modelCopyBtn.textContent;
        modelCopyBtn.textContent = ok ? '已复制' : '失败';
        modelCopyBtn.classList.toggle('active', ok);
        setTimeout(() => {
            modelCopyBtn.textContent = originalText;
            modelCopyBtn.classList.remove('active');
        }, 1400);
    });
    modelPanel.appendChild(modelTitle);
    modelPanel.appendChild(modelArticle);
    modelPanel.appendChild(modelSource);
    if (userPanel) {
        modelTitle.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            if (!modelPanel.classList.contains('collapsed')) return;
            localStorage.setItem(TOOL_DETAIL_MODEL_COLLAPSED_KEY, 'false');
            applyToolDetailSplitLayout(userPanel, modelPanel, getStoredToolDetailModelRatio(), false);
        });
        split.appendChild(createToolDetailSplitResizer(split, userPanel, modelPanel));
        applyToolDetailSplitLayout(userPanel, modelPanel, getStoredToolDetailModelRatio(), isToolDetailModelCollapsed());
    }
    split.appendChild(modelPanel);

    filePreviewBody.appendChild(split);
    setFilePreviewWorkbenchVisible(true);
}

function closeFilePreviewWorkbench() {
    persistActiveFilePreviewScroll();
    resetActivePreviewSurface();
    filePreviewTabs.clear();
    activeFilePreviewPath = '';
    currentPreviewFile = null;
    currentPreviewPath = '';
    renderFilePreviewTabs();
    setFilePreviewWorkbenchVisible(false);
    localStorage.removeItem(FILE_PREVIEW_STATE_KEY);
}

function clearFilePreviewTabs() {
    persistActiveFilePreviewScroll();
    filePreviewTabs.clear();
    filePreviewScrollPositions = {};
    renderEmptyFilePreviewPlaceholder();
}

function clearToolDetailPreviewTab() {
    if (!filePreviewTabs.has(TOOL_DETAIL_PREVIEW_PATH)) {
        const saved = readFilePreviewState();
        if (saved && saved.toolDetail) {
            const tabs = saved.tabs.filter(path => path !== TOOL_DETAIL_PREVIEW_PATH);
            if (!tabs.length && !saved.visible) {
                localStorage.removeItem(FILE_PREVIEW_STATE_KEY);
                return;
            }
            localStorage.setItem(FILE_PREVIEW_STATE_KEY, JSON.stringify({
                tabs,
                activePath: saved.activePath === TOOL_DETAIL_PREVIEW_PATH ? (tabs[0] || '') : saved.activePath,
                visible: saved.visible,
                scrollPositions: Object.fromEntries(
                    Object.entries(saved.scrollPositions || {}).filter(([path]) => path !== TOOL_DETAIL_PREVIEW_PATH)
                ),
            }));
        }
        return;
    }
    closeFilePreviewTab(TOOL_DETAIL_PREVIEW_PATH);
}

function closeFilePreviewTab(filePath) {
    if (!filePreviewTabs.has(filePath)) return;
    persistActiveFilePreviewScroll();
    const wasActive = activeFilePreviewPath === filePath;
    filePreviewTabs.delete(filePath);
    delete filePreviewScrollPositions[filePath];
    if (!filePreviewTabs.size) {
        renderEmptyFilePreviewPlaceholder();
        return;
    }
    if (wasActive) {
        const nextPath = filePreviewTabs.keys().next().value;
        activateFilePreviewTab(nextPath);
    } else {
        renderFilePreviewTabs();
        saveFilePreviewState();
    }
}

function closeFilePreviewTabs(filePaths, preferredActivePath = '') {
    const targets = new Set(filePaths.filter(path => filePreviewTabs.has(path)));
    if (!targets.size) return;
    persistActiveFilePreviewScroll();
    const wasActiveClosed = targets.has(activeFilePreviewPath);
    for (const filePath of targets) {
        filePreviewTabs.delete(filePath);
        delete filePreviewScrollPositions[filePath];
    }
    if (!filePreviewTabs.size) {
        renderEmptyFilePreviewPlaceholder();
        return;
    }
    if (wasActiveClosed) {
        const nextPath = preferredActivePath && filePreviewTabs.has(preferredActivePath)
            ? preferredActivePath
            : filePreviewTabs.keys().next().value;
        activateFilePreviewTab(nextPath);
        return;
    }
    renderFilePreviewTabs();
    saveFilePreviewState();
}

function openFilePreviewTabContextMenu(clientX, clientY, filePath) {
    const paths = [...filePreviewTabs.keys()];
    const index = paths.indexOf(filePath);
    if (index < 0) return;
    const leftPaths = paths.slice(0, index);
    const rightPaths = paths.slice(index + 1);
    const otherPaths = paths.filter(path => path !== filePath);
    openFiletreeContextMenu(clientX, clientY, [
        {
            label: '关闭当前标签页',
            onSelect: () => closeFilePreviewTab(filePath),
        },
        {
            label: '关闭左侧标签页',
            onSelect: () => closeFilePreviewTabs(leftPaths, filePath),
        },
        {
            label: '关闭右侧标签页',
            onSelect: () => closeFilePreviewTabs(rightPaths, filePath),
        },
        {
            label: '关闭其他标签页',
            onSelect: () => closeFilePreviewTabs(otherPaths, filePath),
        },
        {
            label: '关闭所有标签页',
            onSelect: () => clearFilePreviewTabs(),
        },
    ]);
}

async function openFilePreviewTab(fileHandle, filePath) {
    filePreviewTabs.set(filePath, { handle: fileHandle, path: filePath });
    await activateFilePreviewTab(filePath);
}

async function activateFilePreviewTab(filePath, options = {}) {
    const tab = filePreviewTabs.get(filePath);
    if (!tab) return;
    persistActiveFilePreviewScroll();
    activeFilePreviewPath = filePath;
    setFilePreviewWorkbenchVisible(true);
    renderFilePreviewTabs();
    if (tab.type === 'tool-detail') {
        renderToolDetailPreviewTab(tab);
    } else {
        await previewFile(tab.handle, tab.path);
    }
    if (options.resetScroll) {
        filePreviewScrollPositions[filePath] = 0;
    }
    restoreFilePreviewScroll(filePath);
    saveFilePreviewState();
}

let workspaceDirHandle = null;
let filetreeRefreshTimer = null;
let selectBtnState = 'default'; // 'default' | 'active' | 'need-auth'
const expandedDirs = new Set();

// ── IndexedDB 存取 DirectoryHandle ──
const IDB_NAME = 'http-client-fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'workspace';

function openHandleDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveHandle(handle) {
    try {
        const db = await openHandleDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
        console.warn('保存目录句柄失败', e);
    }
}

async function loadHandle() {
    try {
        const db = await openHandleDB();
        const tx = db.transaction(IDB_STORE, 'readonly');
        return await new Promise((res, rej) => {
            const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => rej(req.error);
        });
    } catch (e) {
        return null;
    }
}

async function getWorkspaceFileHandleByPath(filePath) {
    if (!workspaceDirHandle || !filePath) return null;
    const parts = filePath.split('/').filter(Boolean);
    if (!parts.length) return null;
    let dir = workspaceDirHandle;
    for (const part of parts.slice(0, -1)) {
        try {
            dir = await dir.getDirectoryHandle(part, { create: false });
        } catch (e) {
            return null;
        }
    }
    try {
        return await dir.getFileHandle(parts[parts.length - 1], { create: false });
    } catch (e) {
        return null;
    }
}

async function restorePersistedFilePreviewState() {
    const saved = readFilePreviewState();
    if (!saved) return;
    if (!saved.tabs.length) {
        if (saved.visible) renderEmptyFilePreviewPlaceholder();
        return;
    }
    isRestoringFilePreviewState = true;
    try {
        filePreviewTabs.clear();
        filePreviewScrollPositions = saved.scrollPositions || {};
        const restoredPaths = [];
        for (const filePath of saved.tabs) {
            if (isToolDetailPreviewPath(filePath)) {
                const tab = createToolDetailPreviewTab(saved.toolDetail);
                if (!tab) continue;
                filePreviewTabs.set(filePath, tab);
                restoredPaths.push(filePath);
                continue;
            }
            const handle = await getWorkspaceFileHandleByPath(filePath);
            if (!handle) continue;
            filePreviewTabs.set(filePath, { handle, path: filePath });
            restoredPaths.push(filePath);
        }
        if (!restoredPaths.length) {
            if (saved.visible) {
                renderEmptyFilePreviewPlaceholder();
            } else {
                closeFilePreviewWorkbench();
            }
            return;
        }
        const activePath = restoredPaths.includes(saved.activePath) ? saved.activePath : restoredPaths[0];
        activeFilePreviewPath = activePath;
        renderFilePreviewTabs();
        setFilePreviewWorkbenchVisible(saved.visible);
        const activeTab = saved.visible ? filePreviewTabs.get(activePath) : null;
        if (activeTab) {
            if (activeTab.type === 'tool-detail') {
                renderToolDetailPreviewTab(activeTab);
            } else {
                await previewFile(activeTab.handle, activeTab.path);
            }
            restoreFilePreviewScroll(activePath);
        }
    } finally {
        isRestoringFilePreviewState = false;
        saveFilePreviewState();
    }
}

// 更新按钮状态
function updateSelectBtn(state) {
    selectBtnState = state;
    if (!selectWorkspaceBtn) return;
    selectWorkspaceBtn.classList.toggle('icon-btn-active', state === 'active');
    selectWorkspaceBtn.classList.toggle('icon-btn-warning', state === 'need-auth');
    if (state === 'active') {
        selectWorkspaceBtn.title = '切换项目根目录';
    } else if (state === 'need-auth') {
        const dirHint = mountDirName || '根目录';
        selectWorkspaceBtn.title = `点击重新授权读取 ${dirHint}`;
    } else {
        selectWorkspaceBtn.title = '选择项目根目录';
    }
}

// 激活文件树（已有 handle）
// 若配置了挂载目录且根目录下存在对应子目录，则自动进入该子目录
async function activateFiletree(handle, options = {}) {
    rootDirHandle = handle;
    let target = handle;
    if (mountDirName) {
        try {
            const sub = await handle.getDirectoryHandle(mountDirName, { create: false });
            target = sub;
        } catch (e) {
            // 子目录不存在，直接展示根目录
        }
    }
    workspaceDirHandle = target;
    await saveHandle(handle); // 存原始根目录 handle，下次恢复时再次尝试进入挂载目录
    updateSelectBtn('active');
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    startFiletreeAutoRefresh();
    if (options.restorePreviewState) {
        await restorePersistedFilePreviewState();
    }
}

// 应用挂载目录变更
async function applyMountDir() {
    const newMountDir = mountDirInput ? mountDirInput.value.trim() : '';
    mountDirName = newMountDir;
    localStorage.setItem('mountDirName', mountDirName);
    if (!rootDirHandle) {
        showSystemMessage('请先选择项目根目录');
        return;
    }
    closeFilePreviewWorkbench();
    await activateFiletree(rootDirHandle);
    showSystemMessage(`挂载目录已切换为: ${mountDirName || '(根目录)'}`);
}

function showWorkspacePermissionHint(text) {
    updateSelectBtn('need-auth');
    if (filetreeContainer) {
        filetreeContainer.innerHTML = '';
        const hint = document.createElement('div');
        hint.className = 'filetree-empty filetree-empty-action';
        hint.textContent = text;
        filetreeContainer.appendChild(hint);
    }
}

async function requestWorkspacePermission(handle, options = {}) {
    if (!handle) return false;
    rootDirHandle = handle;
    try {
        const current = await handle.queryPermission({ mode: 'read' });
        if (current === 'granted') {
            await activateFiletree(handle, { restorePreviewState: options.restorePreviewState === true });
            return true;
        }
        const next = await handle.requestPermission({ mode: 'read' });
        if (next === 'granted') {
            await activateFiletree(handle, { restorePreviewState: options.restorePreviewState === true });
            if (options.showSuccess) {
                showSystemMessage('已恢复工作区文件读取权限');
            }
            return true;
        }
    } catch (e) {
        if (options.logFailure) {
            console.warn('请求目录权限失败', e);
        }
    }
    const dirHint = mountDirName || '根目录';
    showWorkspacePermissionHint(`点击此处或上方目录按钮，重新授权读取 ${dirHint}`);
    if (options.showMessage) {
        showSystemMessage('工作区文件读取权限需要点击确认后恢复');
    }
    return false;
}

// 页面加载时尝试恢复上次的目录
(async () => {
    // 初始化挂载目录输入框
    if (mountDirInput) mountDirInput.value = mountDirName;

    const saved = await loadHandle();
    if (!saved) return;
    await requestWorkspacePermission(saved, {
        showMessage: false,
        logFailure: true,
        restorePreviewState: true,
    });
})();

// 点击选择/切换目录按钮
if (selectWorkspaceBtn) {
    selectWorkspaceBtn.addEventListener('click', async () => {
        if (!('showDirectoryPicker' in window)) {
            alert('当前浏览器不支持 File System Access API，请使用 Chrome / Edge 等现代浏览器。');
            return;
        }
        try {
            // need-auth 状态：权限过期，先尝试对已有根目录重新授权，避免用户重新选
            if (selectBtnState === 'need-auth' && rootDirHandle) {
                const granted = await requestWorkspacePermission(rootDirHandle, {
                    showMessage: true,
                    showSuccess: true,
                    logFailure: true,
                    restorePreviewState: true,
                });
                if (granted) {
                    return;
                }
            }
            // active / default 状态：直接弹出选择器，支持切换到新项目
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            closeFilePreviewWorkbench();
            await activateFiletree(handle);
        } catch (e) {
            if (e.name !== 'AbortError') console.error('授权目录失败', e);
        }
    });
}

if (filetreeContainer) {
    filetreeContainer.addEventListener('click', async () => {
        if (selectBtnState !== 'need-auth' || !rootDirHandle) return;
        await requestWorkspacePermission(rootDirHandle, {
            showMessage: true,
            showSuccess: true,
            logFailure: true,
            restorePreviewState: true,
        });
    });
}

// 挂载目录应用按钮
if (applyMountDirBtn) {
    applyMountDirBtn.addEventListener('click', applyMountDir);
}
if (mountDirInput) {
    mountDirInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyMountDir();
    });
}

// 手动刷新
if (refreshTreeBtn) {
    refreshTreeBtn.addEventListener('click', async () => {
        if (workspaceDirHandle) {
            await renderFileTree();
            await refreshWorkspaceMentionIndex();
        }
    });
}

// 关闭预览
if (filePreviewClose) {
    filePreviewClose.addEventListener('click', () => {
        hideFilePreview();
    });
}

if (filePreviewOpenBtn) {
    filePreviewOpenBtn.addEventListener('click', () => openCurrentPreviewInNewTab());
}

async function renderCurrentPreviewAsHtml() {
    if (!currentPreviewFile || !filePreviewBody) return;
    filePreviewBody.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'file-preview-pdf file-preview-html';
    iframe.title = currentPreviewPath;

    const fileUrl = buildFileUrl(currentPreviewPath);
    if (fileUrl) {
        // file:// 协议下相对资源能正常加载
        iframe.src = fileUrl;
    } else {
        // 降级：用 srcdoc 渲染（单文件 HTML 有效，多文件的相对资源不可用）
        iframe.srcdoc = await currentPreviewFile.text();
    }
    filePreviewBody.appendChild(iframe);
}

if (filePreviewRenderBtn) {
    filePreviewRenderBtn.addEventListener('click', renderCurrentPreviewAsHtml);
}

// 自动刷新（每 3 秒）
function startFiletreeAutoRefresh() {
    if (filetreeRefreshTimer) clearInterval(filetreeRefreshTimer);
    filetreeRefreshTimer = setInterval(async () => {
        if (workspaceDirHandle) await renderFileTree();
    }, 3000);
}

// 读取并渲染文件树
async function renderFileTree() {
    if (!filetreeContainer) return;
    try {
        const frag = document.createDocumentFragment();
        await buildTreeNodes(workspaceDirHandle, frag, '', 0);
        filetreeContainer.innerHTML = '';
        filetreeContainer.appendChild(frag);
        if (!filetreeContainer.hasChildNodes() || filetreeContainer.children.length === 0) {
            filetreeContainer.innerHTML = '<div class="filetree-empty">目录为空</div>';
        }
    } catch (e) {
        console.error('渲染文件树失败', e);
    }
}

// 递归构建树节点
async function buildTreeNodes(dirHandle, container, pathPrefix, depth) {
    const entries = [];
    for await (const entry of dirHandle.values()) {
        entries.push(entry);
    }
    // 目录排前，同类按名排序
    entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
        const fullPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
        const isDir = entry.kind === 'directory';

        const node = document.createElement('div');
        node.className = `ft-node ${isDir ? 'ft-dir' : 'ft-file'}`;
        node.style.paddingLeft = `${8 + depth * 14}px`;

        const icon = createFileTreeIcon(entry.name, isDir, expandedDirs.has(fullPath));

        const name = document.createElement('span');
        name.className = 'ft-name';
        name.textContent = entry.name;

        node.appendChild(icon);
        node.appendChild(name);
        container.appendChild(node);

        if (isDir) {
            const childContainer = document.createElement('div');
            childContainer.className = 'ft-children';

            if (expandedDirs.has(fullPath)) {
                childContainer.style.display = 'block';
                await buildTreeNodes(entry, childContainer, fullPath, depth + 1);
            } else {
                childContainer.style.display = 'none';
            }
            container.appendChild(childContainer);

            node.addEventListener('click', async (e) => {
                e.stopPropagation();
                const isOpen = expandedDirs.has(fullPath);
                if (isOpen) {
                    expandedDirs.delete(fullPath);
                    childContainer.style.display = 'none';
                    childContainer.innerHTML = '';
                    updateFileTreeIcon(icon, entry.name, true, false);
                } else {
                    expandedDirs.add(fullPath);
                    childContainer.innerHTML = '';
                    await buildTreeNodes(entry, childContainer, fullPath, depth + 1);
                    childContainer.style.display = 'block';
                    updateFileTreeIcon(icon, entry.name, true, true);
                }
            });
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dirPath = normalizeMentionDirectoryPath(fullPath);
                openFiletreeContextMenu(e.clientX, e.clientY, [{
                    label: '引用此目录（插入 @）',
                    onSelect: () => {
                        insertMentionAtCursor(`[@directory_path:${dirPath}]${MENTION_PROMPT_SEPARATOR}`);
                    },
                }]);
            });
        } else {
            node.addEventListener('click', async (e) => {
                e.stopPropagation();
                await openFilePreviewTab(entry, fullPath);
            });
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const fp = normalizeMentionFilePath(fullPath);
                openFiletreeContextMenu(e.clientX, e.clientY, [{
                    label: '引用此文件（插入 @）',
                    onSelect: () => {
                        insertMentionAtCursor(`[@file_path:${fp}]${MENTION_PROMPT_SEPARATOR}`);
                    },
                }]);
            });
        }
    }
}

// ── 画布文件（magic.project.js）预览 ──

function isMagicProjectJs(filePath) {
    return getWorkspaceFileBaseName(filePath) === 'magic.project.js';
}

function parseMagicProjectConfig(text) {
    try {
        const m = text.match(/window\.magicProjectConfig\s*=\s*(\{[\s\S]*\})/);
        if (!m) return null;
        return JSON.parse(m[1]);
    } catch {
        return null;
    }
}

async function getProjectDirHandle(filePath) {
    const parts = filePath.split('/').filter(Boolean);
    parts.pop(); // 去掉文件名，只保留目录部分
    let dir = workspaceDirHandle;
    for (const part of parts) {
        try { dir = await dir.getDirectoryHandle(part); }
        catch { return null; }
    }
    return dir;
}

async function resolveCanvasFileBlobUrl(projectDirHandle, relPath) {
    const parts = relPath.split('/').filter(Boolean);
    let dir = projectDirHandle;
    for (const p of parts.slice(0, -1)) {
        try { dir = await dir.getDirectoryHandle(p); }
        catch { return null; }
    }
    try {
        const fh = await dir.getFileHandle(parts[parts.length - 1]);
        const file = await fh.getFile();
        const url = URL.createObjectURL(file);
        canvasBlobUrls.push(url);
        return url;
    } catch {
        return null;
    }
}

/**
 * 从视频 blob URL 中抓取第一帧，返回 data URL（失败时返回 null）。
 */
function captureVideoFrame(videoBlobUrl) {
    return new Promise((resolve) => {
        const v = document.createElement('video');
        v.muted = true;
        v.preload = 'metadata';
        let settled = false;
        const done = (result) => {
            if (settled) return;
            settled = true;
            v.src = '';
            resolve(result);
        };
        const timer = setTimeout(() => done(null), 10000);
        v.addEventListener('error', () => { clearTimeout(timer); done(null); });
        v.addEventListener('loadeddata', () => { v.currentTime = 0.01; });
        v.addEventListener('seeked', () => {
            clearTimeout(timer);
            try {
                const c = document.createElement('canvas');
                c.width = v.videoWidth || 640;
                c.height = v.videoHeight || 360;
                c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
                done(c.toDataURL('image/jpeg', 0.82));
            } catch {
                done(null);
            }
        });
        v.src = videoBlobUrl;
    });
}

/**
 * 弹出画布媒体 modal：图片展示原图，视频展示播放器。
 * @param {'image'|'video'} type
 * @param {string|null} blobUrl  - 视频/图片的 blob URL
 * @param {string|null} posterBlobUrl - 视频封面的 blob URL（可选）
 * @param {string} name - 元素名称（用于 aria-label）
 */
function openCanvasMediaModal(type, blobUrl, posterBlobUrl, name) {
    // 移除已有 modal
    const existing = document.getElementById('canvasMediaModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'canvasMediaModal';
    overlay.className = 'canvas-media-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', name);

    const box = document.createElement('div');
    box.className = 'canvas-media-modal-box';

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'canvas-media-modal-close';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.addEventListener('click', () => overlay.remove());

    // 媒体内容
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'canvas-media-modal-media';

    if (type === 'video' && blobUrl) {
        const v = document.createElement('video');
        v.src = blobUrl;
        if (posterBlobUrl) v.poster = posterBlobUrl;
        v.controls = true;
        v.autoplay = true;
        v.style.cssText = 'max-width:100%;max-height:100%;display:block;background:#000;';
        mediaWrap.appendChild(v);
    } else if (type === 'video' && posterBlobUrl) {
        // 无视频源，仅展示封面大图
        const img = document.createElement('img');
        img.src = posterBlobUrl;
        img.alt = name;
        img.style.cssText = 'max-width:100%;max-height:100%;display:block;object-fit:contain;';
        mediaWrap.appendChild(img);
    } else if (type === 'image' && blobUrl) {
        const img = document.createElement('img');
        img.src = blobUrl;
        img.alt = name;
        img.style.cssText = 'max-width:100%;max-height:100%;display:block;object-fit:contain;';
        mediaWrap.appendChild(img);
    }

    if (name) {
        const caption = document.createElement('div');
        caption.className = 'canvas-media-modal-caption';
        caption.textContent = name;
        box.appendChild(caption);
    }

    box.appendChild(closeBtn);
    box.appendChild(mediaWrap);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 点击背景关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // ESC 关闭
    const onKey = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    // modal 移除时停止视频播放
    new MutationObserver(() => {
        if (!document.getElementById('canvasMediaModal')) {
            const v = overlay.querySelector('video');
            if (v) { v.pause(); v.src = ''; }
            document.removeEventListener('keydown', onKey);
        }
    }).observe(document.body, { childList: true });
}

/**
 * 在 containerEl 内渲染画布内容。
 * containerEl 本身需具备 overflow:auto + 固定高度（来自 CSS），函数不修改其样式。
 */
async function renderCanvasView(config, projectDirHandle, containerEl) {
    const elements = config?.canvas?.elements ?? [];
    if (!elements.length) {
        appendPreviewMessage(containerEl, '画布中没有元素。');
        return;
    }

    // 计算所有元素的边界框
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
        const x = el.x ?? 0, y = el.y ?? 0, w = el.width ?? 0, h = el.height ?? 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
    }
    const canvasW = maxX - minX || 1;
    const canvasH = maxY - minY || 1;

    // scaleWrap：根据 scale 后尺寸撑开 containerEl 的滚动区域
    const scaleWrap = document.createElement('div');
    scaleWrap.className = 'canvas-preview-scale-wrap';
    containerEl.appendChild(scaleWrap);

    // space：按画布原始坐标定位元素，通过 CSS transform 缩放
    const space = document.createElement('div');
    space.className = 'canvas-preview-space';
    space.style.width = `${canvasW}px`;
    space.style.height = `${canvasH}px`;
    scaleWrap.appendChild(space);

    // 等两帧渲染完成后用 containerEl 的实际尺寸计算 scale
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pad = 24;
    const availW = containerEl.clientWidth - pad;
    const availH = containerEl.clientHeight - pad;
    const scale = Math.min(1, Math.min(availW / canvasW, availH / canvasH));

    scaleWrap.style.width  = `${Math.ceil(canvasW * scale) + pad}px`;
    scaleWrap.style.height = `${Math.ceil(canvasH * scale) + pad}px`;
    space.style.position      = 'absolute';
    space.style.left          = `${pad / 2}px`;
    space.style.top           = `${pad / 2}px`;
    space.style.transformOrigin = 'top left';
    space.style.transform     = `scale(${scale})`;

    // 按 zIndex 从低到高渲染元素
    const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    await Promise.all(sorted.map(async (el) => {
        const elDiv = document.createElement('div');
        elDiv.className = 'canvas-preview-element';
        elDiv.style.left = `${(el.x ?? 0) - minX}px`;
        elDiv.style.top = `${(el.y ?? 0) - minY}px`;
        elDiv.style.width = `${el.width ?? 100}px`;
        elDiv.style.height = `${el.height ?? 100}px`;
        elDiv.title = el.name || el.id || '';

        const makeLabel = (text) => {
            const span = document.createElement('span');
            span.className = 'canvas-el-label';
            span.textContent = text;
            return span;
        };

        // 视频类型专用：暗色卡片（封面图优先，无封面则显示图标+名称）
        const renderVideoCard = (posterBlobUrl, name) => {
            const card = document.createElement('div');
            card.className = 'canvas-el-video-card';

            if (posterBlobUrl) {
                const img = document.createElement('img');
                img.src = posterBlobUrl;
                img.alt = name || '';
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;';
                card.appendChild(img);
            }

            const overlay = document.createElement('div');
            overlay.className = 'canvas-el-video-overlay';
            const playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            playIcon.setAttribute('viewBox', '0 0 24 24');
            playIcon.className = 'canvas-el-video-play-icon';
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '12');
            circle.setAttribute('fill', 'rgba(0,0,0,0.5)');
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', '9.5,7 18,12 9.5,17');
            poly.setAttribute('fill', 'white');
            playIcon.appendChild(circle);
            playIcon.appendChild(poly);
            overlay.appendChild(playIcon);

            if (!posterBlobUrl && name) {
                const nameEl = document.createElement('span');
                nameEl.className = 'canvas-el-video-name';
                nameEl.textContent = name;
                overlay.appendChild(nameEl);
            }
            card.appendChild(overlay);
            return card;
        };

        if (el.status === 'processing') {
            if (el.type === 'video') {
                elDiv.classList.add('canvas-el-state', 'canvas-el-video-processing');
                const icon = document.createElement('span');
                icon.className = 'canvas-el-video-loading-icon';
                elDiv.appendChild(icon);
                elDiv.appendChild(makeLabel(el.name || ''));
            } else {
                elDiv.classList.add('canvas-el-state', 'canvas-el-processing');
                elDiv.appendChild(makeLabel(el.name || ''));
            }
        } else if (el.status === 'failed') {
            elDiv.classList.add('canvas-el-state', 'canvas-el-failed');
            elDiv.appendChild(makeLabel(el.name || ''));
        } else if (el.type === 'video') {
            // 视频：封面优先，无封面则从视频抓第一帧；点击弹窗播放
            const posterBlobUrl = el.poster ? await resolveCanvasFileBlobUrl(projectDirHandle, el.poster) : null;
            const videoBlobUrl = el.src ? await resolveCanvasFileBlobUrl(projectDirHandle, el.src) : null;
            // 没有 poster 时从视频文件抓帧作为封面
            let thumbnailUrl = posterBlobUrl;
            if (!thumbnailUrl && videoBlobUrl) {
                thumbnailUrl = await captureVideoFrame(videoBlobUrl);
            }
            elDiv.appendChild(renderVideoCard(thumbnailUrl, el.name || ''));
            if (videoBlobUrl || posterBlobUrl) {
                elDiv.style.cursor = 'pointer';
                elDiv.addEventListener('click', () => openCanvasMediaModal('video', videoBlobUrl, thumbnailUrl, el.name || ''));
            }
        } else if (el.src) {
            const blobUrl = await resolveCanvasFileBlobUrl(projectDirHandle, el.src);
            if (blobUrl) {
                const img = document.createElement('img');
                img.src = blobUrl;
                img.alt = el.name || '';
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
                elDiv.appendChild(img);
                elDiv.style.cursor = 'pointer';
                elDiv.addEventListener('click', () => openCanvasMediaModal('image', blobUrl, null, el.name || ''));
            } else {
                elDiv.classList.add('canvas-el-state', 'canvas-el-missing');
                elDiv.appendChild(makeLabel(el.name || ''));
            }
        } else {
            elDiv.classList.add('canvas-el-state', 'canvas-el-empty');
            elDiv.appendChild(makeLabel(el.name || el.id || ''));
        }

        space.appendChild(elDiv);
    }));
}

async function addCanvasRightPanel(config, filePath) {
    if (!filePreviewMain) return;
    filePreviewMain.classList.add('has-canvas-panel');

    const oldPanel = document.getElementById('canvasRightPanel');
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'canvasRightPanel';
    panel.className = 'canvas-right-panel';

    // 面板顶部信息栏
    const panelHeader = document.createElement('div');
    panelHeader.className = 'canvas-panel-header';
    const titleEl = document.createElement('span');
    titleEl.className = 'canvas-panel-title';
    titleEl.textContent = config.name || filePath;
    const countEl = document.createElement('span');
    countEl.className = 'canvas-panel-count';
    countEl.textContent = `${config.canvas?.elements?.length ?? 0} 个元素`;
    panelHeader.appendChild(titleEl);
    panelHeader.appendChild(countEl);
    panel.appendChild(panelHeader);

    // 画布视口（overflow: auto 由 CSS 控制）
    const viewport = document.createElement('div');
    viewport.className = 'canvas-right-viewport';
    panel.appendChild(viewport);

    filePreviewMain.appendChild(panel);

    // 获取项目目录并渲染画布
    const projectDirHandle = await getProjectDirHandle(filePath);
    if (!projectDirHandle) {
        appendPreviewMessage(viewport, '无法访问项目目录，请检查文件系统权限。');
        return;
    }
    await renderCanvasView(config, projectDirHandle, viewport);
}

// 预览文件内容：图片/音视频/PDF 用 blob URL，文本读入 pre，其余提示不可预览
async function previewFile(fileHandle, filePath) {
    if (!filePreviewBody || !filePreviewWorkbench) return;
    try {
        const file = await fileHandle.getFile();
        resetActivePreviewSurface();

        // 记录当前预览对象，供 header 上的"新窗口打开/渲染预览"按钮使用
        currentPreviewFile = file;
        currentPreviewPath = filePath;
        const isHtmlFile = isHtmlPreviewable(filePath, file);
        if (filePreviewRenderBtn) filePreviewRenderBtn.style.display = 'none';

        const kind = getWorkspacePreviewKind(filePath, file);

        if (isHtmlFile) {
            currentPreviewCopyText = await file.text();
            setFilePreviewMeta(file, filePath, 'html', []);
            await renderCurrentPreviewAsHtml();
        } else if (kind === 'unsupported') {
            setFilePreviewMeta(file, filePath, kind, []);
            appendPreviewMessage(filePreviewBody, '此文件类型无法在浏览器内预览，请使用本地应用打开。');
        } else if (kind === 'image') {
            setFilePreviewMeta(file, filePath, kind, []);
            filePreviewObjectUrl = URL.createObjectURL(file);
            const img = document.createElement('img');
            img.className = 'file-preview-image';
            img.alt = filePath;
            img.addEventListener('load', () => {
                setFilePreviewMeta(file, filePath, kind, [
                    { label: '尺寸', value: `${img.naturalWidth} × ${img.naturalHeight} px` },
                ]);
            });
            img.addEventListener('error', () => {
                revokeFilePreviewObjectUrl();
                filePreviewBody.innerHTML = '';
                appendPreviewMessage(
                    filePreviewBody,
                    '无法将此文件作为图片显示（可能格式不受当前浏览器支持）。请使用本地应用打开。',
                );
            });
            img.src = filePreviewObjectUrl;
            filePreviewBody.appendChild(img);
        } else if (kind === 'video') {
            setFilePreviewMeta(file, filePath, kind, []);
            filePreviewObjectUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.className = 'file-preview-video';
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.addEventListener('loadedmetadata', () => {
                setFilePreviewMeta(file, filePath, kind, [
                    { label: '分辨率', value: `${video.videoWidth} × ${video.videoHeight} px` },
                    { label: '时长', value: formatMediaDurationSeconds(video.duration) },
                ]);
            });
            video.addEventListener('error', () => {
                revokeFilePreviewObjectUrl();
                filePreviewBody.innerHTML = '';
                appendPreviewMessage(
                    filePreviewBody,
                    '无法播放此视频（可能编码或容器格式不受当前浏览器支持）。请使用本地应用打开。',
                );
            });
            video.src = filePreviewObjectUrl;
            filePreviewBody.appendChild(video);
        } else if (kind === 'audio') {
            setFilePreviewMeta(file, filePath, kind, []);
            filePreviewObjectUrl = URL.createObjectURL(file);
            const audio = document.createElement('audio');
            audio.className = 'file-preview-audio';
            audio.controls = true;
            audio.preload = 'metadata';
            audio.addEventListener('loadedmetadata', () => {
                setFilePreviewMeta(file, filePath, kind, [
                    { label: '时长', value: formatMediaDurationSeconds(audio.duration) },
                ]);
            });
            audio.addEventListener('error', () => {
                revokeFilePreviewObjectUrl();
                filePreviewBody.innerHTML = '';
                appendPreviewMessage(
                    filePreviewBody,
                    '无法播放此音频（可能格式不受当前浏览器支持）。请使用本地应用打开。',
                );
            });
            audio.src = filePreviewObjectUrl;
            filePreviewBody.appendChild(audio);
        } else if (kind === 'pdf') {
            setFilePreviewMeta(file, filePath, kind, []);
            filePreviewObjectUrl = URL.createObjectURL(file);
            const iframe = document.createElement('iframe');
            iframe.className = 'file-preview-pdf';
            iframe.title = filePath;
            iframe.src = filePreviewObjectUrl;
            filePreviewBody.appendChild(iframe);
        } else if (kind === 'text') {
            const MAX_SIZE = 512 * 1024; // 512KB
            let text;
            if (file.size > MAX_SIZE) {
                const slice = file.slice(0, MAX_SIZE);
                text = await slice.text() + '\n\n... (文件过大，仅显示前 512KB) ...';
            } else {
                text = await file.text();
            }
            const lineCount = text.split(/\r\n|\r|\n/).length;
            const textExtras = [
                { label: '行数', value: String(lineCount) },
                { label: '字符数', value: String(text.length) },
            ];
            if (file.size > MAX_SIZE) {
                textExtras.push({ label: '说明', value: '正文仅预览前 512KB；行数/字符数为截断后统计' });
            }
            currentPreviewCopyText = text;
            setFilePreviewMeta(file, filePath, kind, textExtras);
            if (isMarkdownPreviewFile(filePath) && window.marked) {
                filePreviewBody.classList.add('file-preview-body-markdown');
                const article = document.createElement('article');
                article.className = 'file-preview-markdown ai-markdown';
                article.innerHTML = marked.parse(text);
                enhanceFilePreviewMarkdownImages(article);
                filePreviewBody.appendChild(article);
            } else {
                const pre = document.createElement('pre');
                pre.className = 'file-preview-content';
                pre.textContent = text;
                filePreviewBody.appendChild(pre);
            }

            // magic.project.js：解析画布配置后在右侧自动展开画布面板
            if (isMagicProjectJs(filePath)) {
                const config = parseMagicProjectConfig(text);
                if (config?.canvas) {
                    addCanvasRightPanel(config, filePath);
                }
            }
        }

        setFilePreviewWorkbenchVisible(true);
    } catch (e) {
        console.error('读取文件失败', e);
    }
}

const FILE_TREE_ICON_PATHS = {
    folderClosed: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l1.7 2H18.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M4 9.5h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>',
    folderOpen: '<path d="M3.5 8.5a2 2 0 0 1 2-2h4l1.5 2h7.5a2 2 0 0 1 1.94 2.48l-1.45 5.8a2 2 0 0 1-1.94 1.52H5.18a2 2 0 0 1-1.95-2.44l1.25-5.55A2 2 0 0 1 6.43 8.5H20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>',
    file: '<path d="M7 3.5h6.5L18 8v12.5H7V3.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M13.5 3.8V8H18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>',
    code: '<path d="M9 9 6 12l3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path><path d="m15 9 3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path><path d="m13 7-2 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>',
    markdown: '<path d="M4 6.5h16v11H4v-11Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M7 14v-4l2.2 2.4L11.4 10v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M15 10v4m0 0-1.6-1.6M15 14l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>',
    pdf: '<path d="M7 3.5h6.5L18 8v12.5H7V3.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M9 15.5h6M9 12.5h6M9 9.5h2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>',
    image: '<path d="M5 5.5h14v13H5v-13Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="m7.5 16 3.2-3.4 2.2 2.2 1.5-1.6L17.2 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="14.8" cy="9.2" r="1.2" fill="currentColor"></circle>',
    audio: '<path d="M8 14H5.8a1.8 1.8 0 0 1 0-3.6H8l5-3.2v10L8 14Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M16 10.2a3 3 0 0 1 0 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>',
    video: '<path d="M5 7h10v10H5V7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="m15 10 4-2.5v9L15 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>',
    archive: '<path d="M7 4.5h10v15H7v-15Z" fill="none" stroke="currentColor" stroke-width="1.7"></path><path d="M10 4.5v4h4v-4M10 8.5h4M12 11v2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>',
    spreadsheet: '<path d="M6 4.5h12v15H6v-15Z" fill="none" stroke="currentColor" stroke-width="1.7"></path><path d="M6 9h12M6 13h12M10 4.5v15M14 4.5v15" fill="none" stroke="currentColor" stroke-width="1.2"></path>',
};

function createFileTreeIcon(name, isDir, isOpen) {
    const icon = document.createElement('span');
    icon.className = 'ft-icon';
    updateFileTreeIcon(icon, name, isDir, isOpen);
    return icon;
}

function updateFileTreeIcon(icon, name, isDir, isOpen) {
    if (!icon) return;
    const iconType = isDir ? (isOpen ? 'folderOpen' : 'folderClosed') : getFileIconType(name);
    icon.className = `ft-icon ft-icon-${iconType}`;
    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${FILE_TREE_ICON_PATHS[iconType] || FILE_TREE_ICON_PATHS.file}</svg>`;
}

// 根据扩展名返回文件图标类型
function getFileIconType(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        md: 'markdown', markdown: 'markdown',
        pdf: 'pdf',
        html: 'code', htm: 'code', js: 'code', ts: 'code', jsx: 'code',
        tsx: 'code', css: 'code', py: 'code', sh: 'code', json: 'code',
        yaml: 'code', yml: 'code', env: 'code',
        png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
        wav: 'audio', mp3: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
        mp4: 'video', mov: 'video', webm: 'video', mkv: 'video',
        zip: 'archive', tar: 'archive', gz: 'archive', rar: 'archive', '7z': 'archive',
        xlsx: 'spreadsheet', xls: 'spreadsheet', csv: 'spreadsheet',
    };
    return map[ext] || 'file';
}
