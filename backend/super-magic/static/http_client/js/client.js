// 全局变量
let messageHistory = []; // 存储用户发送过的消息历史
let currentTaskMode = "plan"; // 当前任务模式，默认为 plan（保留兼容性）
let currentAgentMode = "magic"; // 当前Agent模式，默认为 magic
let currentLanguage = "zh_CN"; // 当前语言，默认中文
let currentMessageVersion = "v2"; // 消息版本，默认 v2
let currentExecutionSource = "human_chat"; // 当前执行来源，默认人工对话
let currentFileName = ""; // 存储当前上传的文件名
let isAdvancedMode = false; // 高级模式开关，开启后直接发送原始 JSON
let isImMode = false; // IM 渠道模拟模式
let currentImChannel = "dingtalk"; // 当前 IM 渠道
let currentImUserId = ""; // 当前 IM 用户 ID

// 用户通过文件选择器选中的原始项目根目录 handle
let rootDirHandle = null;

// WebSocket相关变量
let websocket = null;
let isWebSocketConnected = false;
let wsOpenCallbacks = []; // 等待连接建立的 Promise 回调队列

// V2 chunk 和事件消息都走本地 /subscribe WebSocket。

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
const CLIENT_CONTEXT_INPUT_DRAFT_KEY = 'httpClient.clientContextInputDraft';
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

// 消息列表懒加载：恢复/重渲染时只渲染最近一批，滚动到顶部时按需加载历史消息
// 批次大小按可见消息（非 event 条目）计数，event 条目不计入但随区间一并渲染
const LAZY_RENDER_BATCH_SIZE = 50;
const LAZY_RENDER_TRIGGER_TOP_PX = 400;
let lazyPrependTarget = null;
const lazyRenderState = {
    renderedFromIndex: 0,
    loadMoreEl: null,
    isLoadingMore: false,
    isAdjustingScroll: false,
    lastScrollTop: 0,
};

// 从 beforeIndex 往前找，跳过 event 条目，数够 batchSize 条可见消息后返回起始下标
function findLazyStartIndex(entries, beforeIndex, batchSize) {
    let count = 0;
    let startIndex = 0;
    for (let i = beforeIndex - 1; i >= 0; i--) {
        if (entries[i].type !== 'event') {
            count++;
            if (count >= batchSize) {
                startIndex = i;
                break;
            }
        }
    }

    // 批次从完整用户轮次开始，避免同一次工具调用的前后状态被拆成两张卡片。
    while (startIndex > 0 && entries[startIndex].type !== 'client') {
        startIndex--;
    }
    return startIndex;
}

function getSystemMessageKey(text) {
    if (text.startsWith('已切换到高级模式')) return 'mode-toggle';
    if (text.startsWith('已切换到普通模式')) return 'mode-toggle';
    if (text.startsWith('切换到 ')) return 'agent-mode-toggle';
    if (text.startsWith('语言已切换为:')) return 'language-toggle';
    if (text.startsWith('消息版本已切换为:')) return 'message-version-toggle';
    if (text.startsWith('执行来源已切换为:')) return 'execution-source-toggle';
    if (text.startsWith('模型列表已刷新')) return 'model-list-refresh';
    if (text.startsWith('工作区文件读取权限')) return 'workspace-permission';
    if (text.startsWith('点击此处或刷新按钮')) return 'workspace-permission';
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

    const clientContextDraft = localStorage.getItem(CLIENT_CONTEXT_INPUT_DRAFT_KEY);
    if (clientContextInput && clientContextDraft !== null && !clientContextInput.value) {
        clientContextInput.value = clientContextDraft;
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
    latestTokenUsage = null;
    closeTokenContextPopover();
    updateTokenContextPreview();
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
    // 懒加载：只渲染最后一批消息，历史消息滚动到顶部时按需加载
    const total = chatLog.length;
    const startIndex = findLazyStartIndex(chatLog, total, LAZY_RENDER_BATCH_SIZE);
    resetLazyRenderState();
    lazyRenderState.renderedFromIndex = startIndex;

    isRestoring = true;
    if (startIndex > 0) {
        insertLoadMorePlaceholder(startIndex);
    }
    for (let i = startIndex; i < total; i++) {
        renderLogEntry(chatLog[i]);
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
    return normalizeAssistantLogOrder(result);
}

const ASSISTANT_LOG_TYPES = new Set(['thinking', 'ai', 'tool_call']);
const ASSISTANT_TYPE_ORDER = { thinking: 0, ai: 1, tool_call: 2 };

function isAssistantLogEntry(entry) {
    return Boolean(entry && ASSISTANT_LOG_TYPES.has(entry.type));
}

function getAssistantLogReplyKey(entry) {
    if (!entry) return '';
    if (entry.type === 'tool_call') return String(entry.replyKey || '');
    return String(entry.key || '');
}

// 回放按 chatLog 到达顺序 append，工具常比正文先入日志，刷新后就会跑到正文上面。
// 按用户消息分段，把同一轮的思考 / 正文 / 工具排回展示顺序；event 等其它条目留在原槽位。
function normalizeAssistantLogOrder(entries) {
    const result = [];
    let segment = [];
    const flush = () => {
        if (segment.length) result.push(...reorderAssistantSegment(segment));
        segment = [];
    };
    for (const entry of entries) {
        if (entry && entry.type === 'client') {
            flush();
            result.push(entry);
            continue;
        }
        segment.push(entry);
    }
    flush();
    return result;
}

function reorderAssistantSegment(segment) {
    const slots = [];
    const assistants = [];
    for (let i = 0; i < segment.length; i++) {
        if (!isAssistantLogEntry(segment[i])) continue;
        slots.push(i);
        assistants.push(segment[i]);
    }
    if (slots.length < 2) return segment;
    const ordered = orderAssistantLogEntries(assistants);
    const next = segment.slice();
    slots.forEach((slot, index) => {
        next[slot] = ordered[index];
    });
    return next;
}

function orderAssistantLogEntries(items) {
    const keyedCount = items.filter((entry) => getAssistantLogReplyKey(entry)).length;
    if (keyedCount === items.length) {
        return orderAssistantLogEntriesByKey(items);
    }
    return orderUnkeyedAssistantLogEntries(items);
}

function orderAssistantLogEntriesByKey(items) {
    const groups = new Map();
    const groupOrder = [];
    for (const item of items) {
        const key = getAssistantLogReplyKey(item);
        if (!groups.has(key)) {
            groups.set(key, []);
            groupOrder.push(key);
        }
        groups.get(key).push(item);
    }
    const result = [];
    for (const key of groupOrder) {
        result.push(...sortAssistantLogTypes(groups.get(key)));
    }
    return result;
}

function sortAssistantLogTypes(items) {
    return items
        .map((entry, index) => ({ entry, index }))
        .sort((left, right) => {
            const typeDiff = (ASSISTANT_TYPE_ORDER[left.entry.type] ?? 9)
                - (ASSISTANT_TYPE_ORDER[right.entry.type] ?? 9);
            if (typeDiff !== 0) return typeDiff;
            return left.index - right.index;
        })
        .map((item) => item.entry);
}

function orderUnkeyedAssistantLogEntries(items) {
    const thinkings = items.filter((entry) => entry.type === 'thinking');
    const ais = items.filter((entry) => entry.type === 'ai');
    const tools = items.filter((entry) => entry.type === 'tool_call');
    const stepCount = Math.max(thinkings.length, ais.length, tools.length ? 1 : 0);
    const result = [];
    const usedTools = new Set();
    for (let step = 0; step < stepCount; step++) {
        if (thinkings[step]) result.push(thinkings[step]);
        if (ais[step]) result.push(ais[step]);
        const stepTs = Number((ais[step] || thinkings[step] || {}).timestamp) || 0;
        const nextTsRaw = (ais[step + 1] || thinkings[step + 1] || {}).timestamp;
        const nextTs = nextTsRaw === undefined ? undefined : Number(nextTsRaw) || 0;
        for (const tool of tools) {
            if (usedTools.has(tool)) continue;
            const toolTs = Number(tool.timestamp) || 0;
            if (step === stepCount - 1 || nextTs === undefined
                || Math.abs(toolTs - stepTs) <= Math.abs(toolTs - nextTs)) {
                result.push(tool);
                usedTools.add(tool);
            }
        }
    }
    for (const tool of tools) {
        if (!usedTools.has(tool)) result.push(tool);
    }
    return result;
}

function renderLogEntry(entry) {
    switch (entry.type) {
        case 'client':    renderClientEntry(entry); break;
        case 'ai':        showAIMessage(entry.content, entry.timestamp, true, {
            key: entry.key,
            replace: true,
            finalize: true,
        }); break;
        case 'thinking':  showThinkingMessage(entry.content, entry.timestamp, true, {
            key: entry.key,
            replace: true,
            finalize: true,
        }); break;
        case 'tool_call': showToolCallMessage(entry.tool, entry.eventType, entry.timestamp, true, {
            modelContent: entry.modelContent || '',
            attachments: entry.attachments || entry.tool?.attachments || [],
            replyKey: entry.replyKey || entry.key || '',
            toolCallId: entry.toolCallId,
        }); break;
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
        const sourcePart = entry.executionSource ? ` - 来源: ${entry.executionSource}` : '';
        headerText = `客户端消息 (${entry.time}) - IM渠道: ${channelLabel}${userIdPart}${sourcePart}`;
    } else {
        const agentMode = entry.agentMode ? entry.agentMode.toUpperCase() : 'N/A';
        const modelId = entry.modelId ? ` - Model: ${entry.modelId}` : '';
        const sourcePart = entry.executionSource ? ` - 来源: ${entry.executionSource}` : '';
        headerText = `客户端消息 (${entry.time}) - Agent模式: ${agentMode}${modelId}${sourcePart}`;
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
const authTokenInput = document.getElementById('authToken');
const longTermMemoryToggle = document.getElementById('longTermMemoryToggle');
const followUpSuggestionsToggle = document.getElementById('followUpSuggestionsToggle');
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
const customAgentCodeInput = document.getElementById('customAgentCodeInput');
const customAgentCodeGroup = document.getElementById('customAgentCodeGroup');
const localCrewAgentOptions = document.getElementById('localCrewAgentOptions');
const modelIdInput = document.getElementById('modelIdInput');
const modelIdSelect = document.getElementById('modelIdSelect');
const reasoningEffortSelect = document.getElementById('reasoningEffortSelect');
const imageModelSelect = document.getElementById('imageModelSelect');
const videoModelSelect = document.getElementById('videoModelSelect');
const advancedModeToggle = document.getElementById('advancedModeToggle');
const rawJsonInput = document.getElementById('rawJsonInput');
const clientContextInput = document.getElementById('clientContextInput');
const clientContextOpenBtn = document.getElementById('clientContextOpenBtn');
const clientContextCount = document.getElementById('clientContextCount');
const clientContextClearBtn = document.getElementById('clientContextClearBtn');
const clientContextModal = document.getElementById('clientContextModal');
const clientContextModalCount = document.getElementById('clientContextModalCount');
const clientContextModalClearBtn = document.getElementById('clientContextModalClearBtn');
const clientContextModalCloseBtn = document.getElementById('clientContextModalCloseBtn');
const tokenContextPreview = document.getElementById('tokenContextPreview');
const tokenContextUsage = document.getElementById('tokenContextUsage');
const tokenContextRing = document.getElementById('tokenContextRing');
const tokenContextPopover = document.getElementById('tokenContextPopover');
const tokenContextPopoverPercentage = document.getElementById('tokenContextPopoverPercentage');
const tokenContextPopoverProgress = document.getElementById('tokenContextPopoverProgress');
const tokenContextPopoverCount = document.getElementById('tokenContextPopoverCount');
const tokenContextPopoverBreakdown = document.getElementById('tokenContextPopoverBreakdown');
const tokenContextWarning = document.getElementById('tokenContextWarning');
const languageSelect = document.getElementById('languageSelect');
const messageVersionSelect = document.getElementById('messageVersionSelect');
const executionSourceSelect = document.getElementById('executionSourceSelect');
const imModeToggle = document.getElementById('imModeToggle');
const rawEventsToggle = document.getElementById('rawEventsToggle');
const imChannelSelect = document.getElementById('imChannelSelect');
const imUserIdInput = document.getElementById('imUserIdInput');
const messagesContainer = document.getElementById('messagesContainer');
const scrollToLatestBtn = document.getElementById('scrollToLatestBtn');
const messageInputPanel = document.getElementById('messageInputPanel');

const INIT_CONFIG_PANEL_OPEN_KEY = 'httpClient.initConfigPanelOpen';
const MCP_CONFIG_PANEL_OPEN_KEY = 'httpClient.mcpConfigPanelOpen';
const LONG_TERM_MEMORY_ENABLED_KEY = 'httpClient.longTermMemoryEnabled';
const FOLLOW_UP_SUGGESTIONS_ENABLED_KEY = 'httpClient.followUpSuggestionsEnabled';
const SUGGESTION_STATUS_PENDING = 0;
const SUGGESTION_STATUS_FAILED = 2;
const SUGGESTION_RELATION_TYPE_TASK = 1;
const SUGGESTION_MAX_RETRY_COUNT = 3;
const SUGGESTION_RETRY_DELAY_MS = 3000;
const TOKEN_CONTEXT_DEFAULT_LIMIT = 200_000;
const TOKEN_CONTEXT_WARNING_THRESHOLD = 0.7;
const TOKEN_CONTEXT_RING_CIRCUMFERENCE = 42.41;
let latestTokenUsage = null;

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

function renderLocalCrewOptions(crews) {
    if (!localCrewAgentOptions) return;
    localCrewAgentOptions.innerHTML = '';
    (Array.isArray(crews) ? crews : []).forEach((crew) => {
        if (!crew || !crew.agent_code) return;
        const option = document.createElement('option');
        option.value = crew.agent_code;
        option.label = crew.domain && crew.crew
            ? `${crew.domain}/${crew.crew}`
            : (crew.crew_dir || crew.agent_code);
        localCrewAgentOptions.appendChild(option);
    });
}

async function loadLocalCrewOptions() {
    if (!localCrewAgentOptions) return;
    const serverUrl = (serverUrlInput.value.trim() || 'http://127.0.0.1:8002').replace(/\/+$/, '');
    try {
        const response = await fetch(`${serverUrl}/api/v1/debug/local-crew/list`);
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.code !== 1000) {
            renderLocalCrewOptions([]);
            return;
        }
        renderLocalCrewOptions(json.data?.crews || []);
    } catch (error) {
        renderLocalCrewOptions([]);
    }
}

initCompactPanelToggle(configPanelToggle, configPanelBody, configPanelArrow, INIT_CONFIG_PANEL_OPEN_KEY, false);

function refreshClientContextDebugState() {
    const length = clientContextInput?.value.length || 0;
    const hasManualContext = length > 0;
    if (clientContextOpenBtn) clientContextOpenBtn.classList.toggle('has-manual-context', hasManualContext);
    if (clientContextCount) clientContextCount.textContent = `${length}字`;
    if (clientContextModalCount) clientContextModalCount.textContent = `${length} 字符`;
    if (clientContextClearBtn) clientContextClearBtn.style.display = hasManualContext ? '' : 'none';
    if (clientContextModalClearBtn) clientContextModalClearBtn.disabled = !hasManualContext;
}

function formatTokenCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 0) return '';
    if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
    return String(Math.round(count));
}

function formatTokenPercentage(ratio) {
    const percentage = ratio * 100;
    return percentage < 10 ? `${percentage.toFixed(1)}%` : `${Math.round(percentage)}%`;
}

function getSelectedModelContextLimit() {
    const modelId = modelIdSelect && modelIdSelect.style.display !== 'none'
        ? modelIdSelect.value.trim()
        : modelIdInput?.value.trim();
    if (!modelId) return null;

    let textModels = [];
    try {
        textModels = JSON.parse(localStorage.getItem('availableModels') || '[]');
    } catch (e) {
        return null;
    }
    const model = textModels.find(item => item && item.id === modelId);
    const maxTokens = model?.info?.options?.max_tokens;
    return Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0 ? Number(maxTokens) : null;
}

function normalizeTokenUsage(tokenUsage) {
    if (!tokenUsage || typeof tokenUsage !== 'object') return null;
    const inputTokens = tokenUsage.input_tokens ?? tokenUsage.prompt_tokens;
    const outputTokens = tokenUsage.output_tokens ?? tokenUsage.completion_tokens;
    const explicitTotalTokens = tokenUsage.total_tokens;
    const hasInputTokens = inputTokens !== null && inputTokens !== undefined && inputTokens !== ''
        && Number.isFinite(Number(inputTokens));
    const hasOutputTokens = outputTokens !== null && outputTokens !== undefined && outputTokens !== ''
        && Number.isFinite(Number(outputTokens));
    const hasExplicitTotalTokens = explicitTotalTokens !== null && explicitTotalTokens !== undefined
        && explicitTotalTokens !== '' && Number.isFinite(Number(explicitTotalTokens));
    const derivedTotalTokens = hasInputTokens && hasOutputTokens
        ? Number(inputTokens) + Number(outputTokens)
        : null;
    const totalTokens = hasExplicitTotalTokens ? Number(explicitTotalTokens) : derivedTotalTokens;
    const maxContextTokens = tokenUsage.max_context_tokens ?? tokenUsage.context_window;
    if (!Number.isFinite(totalTokens)) return null;
    return {
        input_tokens: hasInputTokens ? Number(inputTokens) : null,
        output_tokens: hasOutputTokens ? Number(outputTokens) : null,
        total_tokens: totalTokens,
        max_context_tokens: Number.isFinite(Number(maxContextTokens)) ? Number(maxContextTokens) : null,
        model_id: tokenUsage.model_id || tokenUsage.model_name || '',
        input_tokens_details: tokenUsage.input_tokens_details || null,
    };
}

function setTokenContextPopoverOpen(isOpen) {
    if (!tokenContextPopover || !tokenContextPreview) return;
    tokenContextPopover.style.display = isOpen ? 'block' : 'none';
    tokenContextPreview.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) positionTokenContextPopover();
}

function closeTokenContextPopover() {
    setTokenContextPopoverOpen(false);
}

function positionTokenContextPopover() {
    if (!tokenContextPopover || !tokenContextPreview || tokenContextPopover.style.display === 'none') return;
    const triggerRect = tokenContextPreview.getBoundingClientRect();
    const popoverRect = tokenContextPopover.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const left = Math.min(
        Math.max(12, triggerRect.right - popoverRect.width),
        viewportWidth - popoverRect.width - 12,
    );
    const openAbove = triggerRect.top >= popoverRect.height + 20;
    const top = openAbove
        ? triggerRect.top - popoverRect.height - 8
        : Math.min(triggerRect.bottom + 8, viewportHeight - popoverRect.height - 12);
    tokenContextPopover.style.left = `${left}px`;
    tokenContextPopover.style.top = `${Math.max(12, top)}px`;
}

function initTokenContextPreview() {
    if (tokenContextPopover && tokenContextPopover.parentElement !== document.body) {
        document.body.appendChild(tokenContextPopover);
    }
    tokenContextPreview?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = tokenContextPopover?.style.display !== 'none';
        setTokenContextPopoverOpen(!isOpen);
    });
    document.addEventListener('click', (event) => {
        if (tokenContextPopover?.contains(event.target) || tokenContextPreview?.contains(event.target)) return;
        closeTokenContextPopover();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeTokenContextPopover();
    });
    window.addEventListener('resize', positionTokenContextPopover);
    window.addEventListener('scroll', positionTokenContextPopover, true);
}

function updateTokenContextPreview(tokenUsage = null) {
    if (!tokenContextPreview) return;
    const normalized = normalizeTokenUsage(tokenUsage);
    if (normalized) latestTokenUsage = normalized;

    const usage = latestTokenUsage;
    const totalTokens = usage?.total_tokens;
    if (!usage || !Number.isFinite(totalTokens)) {
        tokenContextPreview.style.display = 'none';
        closeTokenContextPopover();
        return;
    }

    const contextLimit = usage.max_context_tokens || getSelectedModelContextLimit() || TOKEN_CONTEXT_DEFAULT_LIMIT;
    const ratio = Math.min(Math.max(totalTokens / contextLimit, 0), 1);
    const percentageLabel = formatTokenPercentage(ratio);
    const isHighUsage = ratio >= TOKEN_CONTEXT_WARNING_THRESHOLD;
    const usedLabel = formatTokenCount(totalTokens);
    const maxLabel = formatTokenCount(contextLimit);
    const inputLabel = Number.isFinite(usage.input_tokens) ? formatTokenCount(usage.input_tokens) : '';
    const outputLabel = Number.isFinite(usage.output_tokens) ? formatTokenCount(usage.output_tokens) : '';

    tokenContextPreview.style.display = 'inline-flex';
    tokenContextPreview.classList.toggle('is-high', isHighUsage);
    tokenContextPreview.setAttribute('aria-label', `上下文用量 ${percentageLabel}`);
    tokenContextPreview.title = `上下文用量 ${percentageLabel}`;
    tokenContextUsage.textContent = percentageLabel;
    tokenContextRing.style.strokeDashoffset = String(TOKEN_CONTEXT_RING_CIRCUMFERENCE * (1 - ratio));
    tokenContextPopoverPercentage.textContent = percentageLabel;
    tokenContextPopoverProgress.style.width = `${ratio * 100}%`;
    tokenContextPopoverProgress.parentElement.classList.toggle('is-high', isHighUsage);
    tokenContextPopoverCount.textContent = `${usedLabel} / ${maxLabel} Tokens`;

    const breakdown = [];
    if (inputLabel) breakdown.push(`输入 ${inputLabel}`);
    if (outputLabel) breakdown.push(`输出 ${outputLabel}`);
    if (usage.model_id) breakdown.push(usage.model_id);
    tokenContextPopoverBreakdown.textContent = breakdown.join(' · ');
    tokenContextWarning.style.display = isHighUsage ? 'flex' : 'none';
    positionTokenContextPopover();
}

function clearManualClientContext() {
    if (!clientContextInput) return;
    clientContextInput.value = '';
    localStorage.removeItem(CLIENT_CONTEXT_INPUT_DRAFT_KEY);
    refreshClientContextDebugState();
    if (clientContextModal?.style.display !== 'none') clientContextInput.focus();
}

function openClientContextModal() {
    if (!clientContextModal) return;
    clientContextModal.style.display = 'flex';
    refreshClientContextDebugState();
    setTimeout(() => clientContextInput?.focus(), 50);
}

function closeClientContextModal() {
    if (clientContextModal) clientContextModal.style.display = 'none';
}

function initClientContextModal() {
    clientContextOpenBtn?.addEventListener('click', openClientContextModal);
    clientContextClearBtn?.addEventListener('click', clearManualClientContext);
    clientContextModalCloseBtn?.addEventListener('click', closeClientContextModal);
    clientContextModalClearBtn?.addEventListener('click', clearManualClientContext);
    clientContextModal?.addEventListener('click', (event) => {
        if (event.target === clientContextModal) closeClientContextModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && clientContextModal?.style.display !== 'none') {
            closeClientContextModal();
        }
    });
    refreshClientContextDebugState();
}

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
        const isMagicServiceAuth = Number(cfg.auth_type) === 2;
        const meta = isMagicServiceAuth
            ? `Magic Service 授权 · ${cfg.mcp_server_code || '未填写 mcp_server_code'}`
            : (isHttp ? (cfg.url || '') : (cfg.command || ''));
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
                const normalized = Object.assign({ name: k }, v);
                // 支持面板中的可读别名，发送给后端时统一为 MCP Authorization 的数值类型。
                if (normalized.auth_type === 'magic_service' || normalized.auth_type === 'mcp_authorization') {
                    normalized.auth_type = 2;
                }
                parsed[k] = normalized;
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
    // JSON 模式下用户可能还没有切回列表，发送前必须先同步最新内容。
    if (mcpViewMode === 'json' && !syncJsonToList()) {
        return null;
    }

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

    const magicServiceTemplateBtn = document.getElementById('mcpMagicServiceTemplateBtn');
    if (magicServiceTemplateBtn) {
        magicServiceTemplateBtn.addEventListener('click', () => {
            applyMcpMagicServiceTemplate(jsonInput);
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

/**
 * 将 Magic Service MCP Authorization 配置模板写入 JSON 编辑框。
 * 仅在编辑框为空时写入，避免覆盖用户正在编辑的配置。
 */
function applyMcpMagicServiceTemplate(jsonInput) {
    if (!jsonInput) return;
    if (jsonInput.value.trim()) {
        showSystemMessage('当前已有 MCP 配置，已保留原内容；请清空 JSON 后再插入模板');
        jsonInput.focus();
        return;
    }

    jsonInput.value = JSON.stringify({
        '服务器名称': {
            name: '服务器名称',
            type: 'http',
            url: 'https://你的-mcp-server.example.com/mcp',
            auth_type: 2,
            mcp_server_code: '请填写 magic-service 中的 MCP Server code',
            headers: {},
        },
    }, null, 2);
    jsonInput.focus();
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
    CANVAS: "canvas",
    VIDEO_PRODUCTION: "video-production",
    TEST: "test",
    SKILL: "skill",
    AGENT_MASTER: "agent-master",
    CUSTOM_AGENT: "custom_agent"
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

    // 自动滚动到当前选中项
    requestAnimationFrame(() => {
        const selectedEl = state.list.querySelector('.custom-select-option.selected');
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
    });
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

// 近期选择记录管理（按 select id 分组，最多保留 3 个）
const RECENT_SELECT_KEY_PREFIX = 'customSelect.recent.';
const RECENT_SELECT_MAX = 3;

function getRecentSelections(selectId) {
    if (!selectId) return [];
    try {
        return JSON.parse(localStorage.getItem(RECENT_SELECT_KEY_PREFIX + selectId) || '[]');
    } catch { return []; }
}

function addRecentSelection(selectId, value) {
    if (!selectId || !value) return;
    let recent = getRecentSelections(selectId);
    recent = recent.filter(v => v !== value);
    recent.unshift(value);
    if (recent.length > RECENT_SELECT_MAX) recent.length = RECENT_SELECT_MAX;
    localStorage.setItem(RECENT_SELECT_KEY_PREFIX + selectId, JSON.stringify(recent));
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

    // 近期选择分区（仅无搜索关键词且选项数 > 5 时显示）
    const recentValues = getRecentSelections(state.select.id);
    const currentValue = state.select.value;
    if (!normalizedKeyword && recentValues.length > 0 && options.length > 5) {
        // 过滤出仍存在于当前选项且不是当前选中项的近期值
        const recentOptions = recentValues
            .filter(v => v !== currentValue)
            .map(v => options.find(o => o.value === v))
            .filter(Boolean);
        if (recentOptions.length > 0) {
            const sectionLabel = document.createElement('div');
            sectionLabel.className = 'custom-select-section-label';
            sectionLabel.textContent = '最近使用';
            state.list.appendChild(sectionLabel);
            recentOptions.forEach(option => {
                state.list.appendChild(buildCustomSelectOptionItem(state, option));
            });
            const divider = document.createElement('div');
            divider.className = 'custom-select-divider';
            state.list.appendChild(divider);
        }
    }

    matchedOptions.forEach(option => {
        state.list.appendChild(buildCustomSelectOptionItem(state, option));
    });
}

function buildCustomSelectOptionItem(state, option) {
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
        addRecentSelection(state.select.id, option.value);
        refreshCustomSelect(state.select);
        closeCustomSelect(state);
    });
    return item;
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
    loadLocalCrewOptions();

    // 初始化快捷键提示
    initSendHint();

    // 初始化消息滚动控制
    initMessageScrollControls();

    // 初始化输入栏自定义选择器
    initCustomSelects();
    window.HttpClientModelPicker?.init();
    initClientContextModal();
    initTokenContextPreview();

    restoreInputDrafts();
    refreshClientContextDebugState();
    updateTokenContextPreview();

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
        messageInputEl.addEventListener('paste', async (e) => {
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            const clipboardFiles = Array.from(clipboardData.files || []);
            if (clipboardFiles.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                try {
                    await enqueueMessageInputUpload(clipboardFiles);
                } catch (error) {
                    console.error('聊天框粘贴文件上传失败', error);
                    showSystemMessage(`上传失败：${error.message || error}`);
                }
                return;
            }

            if (!shouldConvertPastedTextToAttachment(clipboardData)) return;

            const text = clipboardData.getData('text/plain');
            const textFile = createPastedTextFile(text);
            e.preventDefault();
            e.stopPropagation();
            try {
                await enqueueMessageInputUpload([textFile], { targetDir: MESSAGE_INPUT_TEMPORARY_DIR });
            } catch (error) {
                console.error('聊天框长文本上传失败', error);
                showSystemMessage(`上传失败：${error.message || error}`);
            }
        });
        messageInputEl.addEventListener('dragover', (e) => {
            if (!hasDraggedFiles(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            messageInputPanel?.classList.add('message-input-drag-over');
        });
        messageInputEl.addEventListener('drop', async (e) => {
            if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
            const droppedFiles = Array.from(e.dataTransfer.files);
            e.preventDefault();
            e.stopPropagation();
            clearMessageInputDropTarget();
            try {
                await enqueueMessageInputUpload(droppedFiles);
            } catch (error) {
                console.error('聊天框拖拽上传失败', error);
                showSystemMessage(`上传失败：${error.message || error}`);
            }
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

    if (clientContextInput) {
        clientContextInput.addEventListener('input', () => {
            saveTextDraft(CLIENT_CONTEXT_INPUT_DRAFT_KEY, clientContextInput.value);
            refreshClientContextDebugState();
        });
    }

    modelIdInput?.addEventListener('input', () => updateTokenContextPreview());

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
                resetLazyRenderState();
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
        // 从 localStorage 恢复上次选择的 Agent 模式
        const savedAgentMode = localStorage.getItem('selectedAgentMode');
        if (savedAgentMode && agentModeSelect.querySelector(`option[value="${savedAgentMode}"]`)) {
            agentModeSelect.value = savedAgentMode;
            changeAgentMode(); // 同步 currentAgentMode 变量
            refreshCustomSelect(agentModeSelect); // 刷新自定义下拉框显示
        }
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
    if (longTermMemoryToggle) {
        const savedLongTermMemoryEnabled = localStorage.getItem(LONG_TERM_MEMORY_ENABLED_KEY);
        longTermMemoryToggle.checked = savedLongTermMemoryEnabled !== 'false';
        longTermMemoryToggle.addEventListener('change', () => {
            localStorage.setItem(LONG_TERM_MEMORY_ENABLED_KEY, String(longTermMemoryToggle.checked));
        });
    }
    if (followUpSuggestionsToggle) {
        const savedFollowUpSuggestionsEnabled = localStorage.getItem(FOLLOW_UP_SUGGESTIONS_ENABLED_KEY);
        followUpSuggestionsToggle.checked = savedFollowUpSuggestionsEnabled !== 'false';
        followUpSuggestionsToggle.addEventListener('change', () => {
            localStorage.setItem(FOLLOW_UP_SUGGESTIONS_ENABLED_KEY, String(followUpSuggestionsToggle.checked));
        });
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

    // 执行来源切换事件
    if (executionSourceSelect) {
        const savedSource = localStorage.getItem('selectedExecutionSource');
        const sourceOptions = Array.from(executionSourceSelect.options).map(option => option.value);
        if (savedSource !== null && sourceOptions.includes(savedSource)) {
            currentExecutionSource = savedSource;
            executionSourceSelect.value = savedSource;
        } else {
            currentExecutionSource = executionSourceSelect.value || 'human_chat';
            executionSourceSelect.value = currentExecutionSource;
        }
        currentExecutionSource = executionSourceSelect.value || currentExecutionSource;
        refreshCustomSelect(executionSourceSelect);
        executionSourceSelect.addEventListener('change', changeExecutionSource);
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
});

// 清理模型列表：清除 localStorage 缓存并恢复文本输入框
function clearModelList() {
    localStorage.removeItem('availableModels');
    localStorage.removeItem('availableImageModels');
    localStorage.removeItem('availableVideoModels');
    localStorage.removeItem('selectedModelId');
    localStorage.removeItem('selectedImageModelId');
    localStorage.removeItem('selectedVideoModelId');

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
    if (videoModelSelect) {
        videoModelSelect.innerHTML = '<option value="">不指定视频模型</option>';
        refreshCustomSelect(videoModelSelect);
    }
    const imageModelGroup = document.getElementById('imageModelGroup');
    if (imageModelGroup) imageModelGroup.style.display = 'none';
    const videoModelGroup = document.getElementById('videoModelGroup');
    if (videoModelGroup) videoModelGroup.style.display = 'none';
    refreshCustomSelect(modelIdSelect);
    updateTokenContextPreview();
    window.HttpClientModelPicker?.refresh();

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
        const videoModels = allModels.filter(m => m.object === 'video');

        localStorage.setItem('availableModels', JSON.stringify(textModels));
        localStorage.setItem('availableImageModels', JSON.stringify(imageModels));
        localStorage.setItem('availableVideoModels', JSON.stringify(videoModels));

        populateModelSelects(textModels, imageModels, videoModels);
        showSystemMessage(`模型列表已刷新：${textModels.length} 个文本模型，${imageModels.length} 个图片模型，${videoModels.length} 个视频模型`);
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
    const videoModels = JSON.parse(localStorage.getItem('availableVideoModels') || '[]');
    if (textModels.length > 0 || imageModels.length > 0 || videoModels.length > 0) {
        populateModelSelects(textModels, imageModels, videoModels);
    }
}

// 填充文本、图片和视频模型下拉框
function populateModelSelects(textModels, imageModels, videoModels) {
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
            updateTokenContextPreview();
            window.HttpClientModelPicker?.refresh();
        };
        refreshCustomSelect(modelIdSelect);
        updateTokenContextPreview();
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
            window.HttpClientModelPicker?.refresh();
        };
        refreshCustomSelect(imageModelSelect);
    }

    // 视频模型
    if (videoModelSelect) {
        const prevVideoValue = videoModelSelect.value;
        videoModelSelect.innerHTML = '<option value="">不指定视频模型</option>';
        videoModels.forEach(m => {
            const attrs = m.info && m.info.attributes;
            const label = attrs && attrs.label ? attrs.label : m.id;
            const resolvedId = attrs && attrs.resolved_model_id ? attrs.resolved_model_id : m.id;
            const idDisplay = resolvedId !== m.id ? `${resolvedId}|${m.id}` : m.id;
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${label} (${idDisplay})`;
            videoModelSelect.appendChild(opt);
        });
        const savedVideoModel = localStorage.getItem('selectedVideoModelId');
        if (savedVideoModel) videoModelSelect.value = savedVideoModel;
        else if (prevVideoValue) videoModelSelect.value = prevVideoValue;

        videoModelSelect.onchange = () => {
            localStorage.setItem('selectedVideoModelId', videoModelSelect.value);
            window.HttpClientModelPicker?.refresh();
        };
        refreshCustomSelect(videoModelSelect);
    }

    // 图片/视频模型组：非 IM 模式下显示
    const imageModelGroup = document.getElementById('imageModelGroup');
    if (imageModelGroup && !isImMode) {
        imageModelGroup.style.display = imageModels.length > 0 ? '' : 'none';
    }
    const videoModelGroup = document.getElementById('videoModelGroup');
    if (videoModelGroup && !isImMode) {
        videoModelGroup.style.display = videoModels.length > 0 ? '' : 'none';
    }
    window.HttpClientModelPicker?.refresh();
}

// 设置默认配置
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMessageSubscriptionItem(config) {
    if (!isPlainObject(config)) return config;
    const normalized = { ...config };
    if (!normalized.auth_scheme) normalized.auth_scheme = 'header_token';
    if (!isPlainObject(normalized.headers)) normalized.headers = {};
    if (!isPlainObject(normalized.auth_config)) normalized.auth_config = {};
    if (normalized.enable_obfuscation === undefined) normalized.enable_obfuscation = true;
    return normalized;
}

function normalizeInitConfig(config) {
    if (!isPlainObject(config)) {
        throw new Error('初始化配置顶层必须是对象');
    }

    const normalized = { ...config };
    const subscriptionConfig = normalized.message_subscription_config;
    if (Array.isArray(subscriptionConfig)) {
        normalized.message_subscription_config = subscriptionConfig.map(normalizeMessageSubscriptionItem);
    } else if (isPlainObject(subscriptionConfig)) {
        normalized.message_subscription_config = [normalizeMessageSubscriptionItem(subscriptionConfig)];
    }
    return normalized;
}

function formatInitConfig(config) {
    return JSON.stringify(config, null, 2);
}

function updateInitConfigContent(config) {
    const content = formatInitConfig(config);
    uploadConfigContent.value = content;
    localStorage.setItem('savedConfigContent', content);
}

function setupDefaultConfigs() {
    // 尝试从 localStorage 加载保存的配置
    const savedConfig = localStorage.getItem('savedConfigContent');
    const savedFileName = localStorage.getItem('savedConfigFileName');

    if (savedConfig) {
        try {
            const normalizedConfig = normalizeInitConfig(JSON.parse(savedConfig));
            uploadConfigContent.value = formatInitConfig(normalizedConfig);
            localStorage.setItem('savedConfigContent', uploadConfigContent.value);
        } catch (e) {
            uploadConfigContent.value = savedConfig;
        }
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
                normalizeInitConfig(JSON.parse(this.value));
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
        injectDebugTaskId(messageData);
        injectLongTermMemoryPreference(messageData);
        injectFollowUpPreference(messageData);
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

/**
 * 为调试面板发送的普通聊天消息注入新的任务 ID.
 * 初始化消息和中断消息不切换任务，避免影响当前运行中的任务状态.
 */
let currentDebugTaskId = '';
let followUpPollToken = 0;

function injectDebugTaskId(messageData) {
    if (!messageData || messageData.type !== MessageType.CHAT) return;
    if (messageData.context_type === ContextType.INTERRUPT) return;

    messageData.metadata = messageData.metadata || {};
    messageData.metadata.super_magic_task_id = generateDebugTaskId();
    currentDebugTaskId = messageData.metadata.super_magic_task_id;
}

/**
 * 将调试面板中的长期记忆开关注入每次 CHAT metadata。
 * system prompt 首次生成时使用当前 CHAT 值，后续 CHAT 只影响运行时功能。
 */
function injectLongTermMemoryPreference(messageData) {
    if (!messageData || messageData.type !== MessageType.CHAT) return;

    messageData.metadata = messageData.metadata || {};
    messageData.metadata.personal_preferences = {
        ...(messageData.metadata.personal_preferences || {}),
        long_term_memory_enabled: longTermMemoryToggle
            ? longTermMemoryToggle.checked
            : true,
    };
}

/**
 * 将调试面板中的追加问题开关注入每次 CHAT metadata。
 * 关闭后本次主任务不生成追加问题，本页也不再查询。
 */
function injectFollowUpPreference(messageData) {
    if (!messageData || messageData.type !== MessageType.CHAT) return;

    messageData.metadata = messageData.metadata || {};
    messageData.metadata.personal_preferences = {
        ...(messageData.metadata.personal_preferences || {}),
        show_follow_up_suggestions: followUpSuggestionsToggle
            ? followUpSuggestionsToggle.checked
            : true,
    };
}

/**
 * 生成仅用于本地调试的数字字符串任务 ID.
 */
function generateDebugTaskId() {
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${Date.now()}${randomSuffix}`;
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

/** 统一应用普通与原始 JSON 模式的调试选项，思考强度为空时不发送该字段。 */
function applyLocalDebugOptions(messageData) {
    if (!messageData || typeof messageData !== 'object') return;
    messageData.dynamic_config = Object.assign({}, messageData.dynamic_config, {
        enable_debug_tool_result_content: true,
        enable_debug_finished_attachments: true,
        client_context: buildLocalDebugClientContext(),
        super_magic_execution_source: currentExecutionSource || 'human_chat',
    });
    // 调试面板直接透传所选档位，切回默认时移除覆盖，不执行模型能力判断。
    const reasoningEffort = reasoningEffortSelect ? reasoningEffortSelect.value : '';
    if (reasoningEffort) {
        messageData.dynamic_config.reasoning_effort = reasoningEffort;
    } else {
        delete messageData.dynamic_config.reasoning_effort;
    }
    if (currentMessageVersion) {
        messageData.dynamic_config.message_version = currentMessageVersion;
    } else {
        delete messageData.dynamic_config.message_version;
    }
}

function buildLocalDebugClientContext() {
    return {
        version: '1.0.0',
        data: {
            content: buildLocalDebugClientContextContent(),
        },
    };
}

function buildLocalDebugClientContextContent() {
    const manualContent = getManualClientContextContent();
    if (manualContent) return manualContent;

    const openedTabs = [...filePreviewTabs.values()]
        .map(tab => formatClientContextTabName(tab))
        .filter(Boolean);
    const focusedFile = getClientContextFocusedFile();

    if (!openedTabs.length && !focusedFile) return '';

    const tabLines = openedTabs.length
        ? openedTabs.map(tabName => `- ${tabName}`).join('\n')
        : 'None';
    return [
        'Open tabs:',
        tabLines,
        `Focused file: ${focusedFile || 'None'}`,
    ].join('\n');
}

function formatClientContextTabName(tab) {
    if (!tab || typeof tab !== 'object') return '';
    if (isToolDetailPreviewPath(tab.path)) return tab.title || 'Tool detail';
    if (tab.type === 'canvas-project' || tab.type === 'micro-app') {
        return tab.title || getFilePreviewResourcePath(tab);
    }
    return tab.path || tab.title || '';
}

function getClientContextFocusedFile() {
    if (!activeFilePreviewPath || isToolDetailPreviewPath(activeFilePreviewPath)) return '';
    return getFilePreviewResourcePath(filePreviewTabs.get(activeFilePreviewPath)) || activeFilePreviewPath;
}

function getManualClientContextContent() {
    if (!clientContextInput) return '';
    return clientContextInput.value.trim();
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
        showSystemMessage('消息发送失败：无法连接到服务器，请确认服务已启动');
        return;
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
        showSystemMessage('初始化失败：无法连接到服务器，请确认服务已启动');
        return;
    }

    try {
        // 解析配置内容
        const configData = normalizeInitConfig(JSON.parse(uploadConfigContent.value));
        updateInitConfigContent(configData);

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
            const configData = normalizeInitConfig(JSON.parse(content));
            const normalizedContent = formatInitConfig(configData);

            uploadConfigContent.value = normalizedContent;

            // 保存到 localStorage
            localStorage.setItem('savedConfigContent', normalizedContent);
            localStorage.setItem('savedConfigFileName', currentFileName);

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
        if (customAgentCodeGroup) customAgentCodeGroup.style.display = 'none';
        modelIdGroup.style.display = 'none';
        languageGroup.style.display = 'none';
        if (imageModelGroup) imageModelGroup.style.display = 'none';
        const videoModelGroup = document.getElementById('videoModelGroup');
        if (videoModelGroup) videoModelGroup.style.display = 'none';
        window.HttpClientModelPicker?.setVisible(false);
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
        window.HttpClientModelPicker?.setVisible(true);
        // agentCodeGroup 的显示由 agent mode 决定，重新同步一次
        changeAgentMode();
        // 若模型列表已加载则恢复图片/视频模型选择器
        const cachedImageModels = JSON.parse(localStorage.getItem('availableImageModels') || '[]');
        if (imageModelGroup && cachedImageModels.length > 0) {
            imageModelGroup.style.display = '';
        }
        const videoModelGroup = document.getElementById('videoModelGroup');
        const cachedVideoModels = JSON.parse(localStorage.getItem('availableVideoModels') || '[]');
        if (videoModelGroup && cachedVideoModels.length > 0) {
            videoModelGroup.style.display = '';
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
        attachments: buildNativeVisionAttachments(prompt),
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
        attachments: buildNativeVisionAttachments(prompt),
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

    // 若选中了视频模型，注入 dynamic_config.video_model
    const selectedVideoModelId = videoModelSelect ? videoModelSelect.value.trim() : '';
    if (selectedVideoModelId) {
        const videoModels = JSON.parse(localStorage.getItem('availableVideoModels') || '[]');
        const videoModelInfo = videoModels.find(m => m.id === selectedVideoModelId);
        const videoGenerationConfig = videoModelInfo && videoModelInfo.info
            ? (videoModelInfo.info.video_generation_config || null)
            : null;
        const videoModelConfig = { model_id: selectedVideoModelId };
        if (videoGenerationConfig && typeof videoGenerationConfig === 'object') {
            videoModelConfig.video_generation_config = videoGenerationConfig;
        }
        message.dynamic_config = Object.assign({}, message.dynamic_config, {
            video_model: videoModelConfig,
        });
    }

    // magiclaw 模式下从输入框读取 agent_code 注入 dynamic_config
    if (currentAgentMode === 'magiclaw' && agentCodeInput) {
        const agentCode = agentCodeInput.value.trim();
        if (agentCode) {
            message.dynamic_config = Object.assign({}, message.dynamic_config, { agent_code: agentCode });
        }
    }

    // custom_agent 模式：强制 task_mode=chat，并注入完整 dynamic_config
    // 若用户已在调试面板选了具体模型，保留该选择；否则回落到 auto
    if (currentAgentMode === 'custom_agent') {
        message.task_mode = 'chat';
        const customAgentCode = customAgentCodeInput ? customAgentCodeInput.value.trim() : '';
        const selectedModelId = message.model_id && message.model_id !== 'auto' ? message.model_id : null;
        const effectiveModelId = selectedModelId || 'auto';
        if (!selectedModelId) {
            message.model_id = 'auto';
        }
        // 若已由前面的选模型逻辑注入了 models，不再覆盖；否则注入 auto 配置
        const existingModels = message.dynamic_config && message.dynamic_config.models;
        const modelsConfig = (existingModels && Object.keys(existingModels).length > 0)
            ? existingModels
            : {
                [effectiveModelId]: {
                    api_key: '${MAGIC_API_KEY}',
                    api_base_url: '${MAGIC_API_BASE_URL}',
                    name: effectiveModelId
                }
            };
        message.dynamic_config = Object.assign({}, message.dynamic_config, {
            models: modelsConfig,
            video_model: message.dynamic_config && message.dynamic_config.video_model
                ? message.dynamic_config.video_model
                : { model_id: 'doubao-seedance-2-0-fast-260128' },
            ...(customAgentCode ? { agent_code: customAgentCode } : {})
        });
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

    // 按模式注入 Agent Profile（本地调试用，线上由管理后台配置）
    const agentProfileOverrides = {
        'ip-manager': {
            name: 'KJ',
            role: 'Brand Empire Manager',
            description: 'Your personal brand empire manager — part executive producer, part talent manager, part media strategist. Manages brands the way a generational mogul runs a family empire.'
        }
    };
    const profileOverride = agentProfileOverrides[currentAgentMode];
    if (profileOverride) {
        message.agent = { profile: profileOverride };
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
    const executionSource = (
        message.dynamic_config &&
        typeof message.dynamic_config === 'object' &&
        message.dynamic_config.super_magic_execution_source
    ) || currentExecutionSource || '';
    pushLog({
        type: 'client',
        prompt: message.prompt || '',
        agentMode: message.agent_mode || '',
        modelId: message.model_id || '',
        executionSource,
        imChannel,
        imUserId,
        time,
    });
    renderClientEntry({
        type: 'client',
        prompt: message.prompt || '',
        agentMode: message.agent_mode || '',
        modelId: message.model_id || '',
        executionSource,
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
const toolStreamIdByIndex = new Map();
const superMagicChunkSeenKeys = new Set();
const superMagicChunkSeenQueue = [];
const SUPER_MAGIC_CHUNK_SEEN_LIMIT = 3000;

function initMessageScrollControls() {
    if (!messagesContainer || !scrollToLatestBtn) return;

    updateScrollButtonPosition();
    window.addEventListener('resize', updateScrollButtonPosition);

    messagesContainer.addEventListener('scroll', () => {
        const currentScrollTop = messagesContainer.scrollTop;
        const isScrollingUp = currentScrollTop < lazyRenderState.lastScrollTop;
        lazyRenderState.lastScrollTop = currentScrollTop;

        if (
            !isRestoring &&
            !lazyRenderState.isAdjustingScroll &&
            isScrollingUp &&
            currentScrollTop <= LAZY_RENDER_TRIGGER_TOP_PX
        ) {
            loadMoreMessages();
        }
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
    // 懒加载预渲染旧消息时，追加到临时 fragment 而非主 DOM
    if (lazyPrependTarget) {
        lazyPrependTarget.appendChild(node);
    } else if (options.insertBefore && options.insertBefore.parentNode === messageList) {
        messageList.insertBefore(node, options.insertBefore);
    } else if (options.insertAfter && options.insertAfter.parentNode === messageList) {
        options.insertAfter.after(node);
    } else {
        messageList.appendChild(node);
    }
    keepAssistantActivityLast(node);
    syncScrollAfterMessageChange(shouldStickToBottom, { showLatestButton: options.showLatestButton !== false });
}

function findReplyContentNode(replyKey) {
    if (!replyKey) return null;
    const state = streamMessageRegistry.get(`content:${replyKey}`);
    const node = state && state.messageDiv;
    return node && node.isConnected ? node : null;
}

function findReplyThinkingNode(replyKey) {
    if (!replyKey) return null;
    const state = streamMessageRegistry.get(`reasoning:${replyKey}`);
    const node = state && state.wrapper;
    return node && node.isConnected ? node : null;
}

// 同一轮 assistant 固定为：思考 -> 正文 -> 工具。
// 工具 delta 常比正文先到，先按 replyKey 挂到轮次末尾；正文到达后再插到首个同轮工具前。
function placeAssistantReplyNode(node, replyKey, kind) {
    if (!replyKey) {
        appendMessageNode(node);
        return;
    }
    if (kind === 'thinking') {
        appendMessageNode(node, {
            insertBefore: findReplyContentNode(replyKey) || findFirstReplyToolNode(replyKey) || undefined,
        });
        return;
    }
    if (kind === 'content') {
        const firstTool = findFirstReplyToolNode(replyKey);
        if (firstTool) {
            appendMessageNode(node, { insertBefore: firstTool });
            return;
        }
        const thinking = findReplyThinkingNode(replyKey);
        appendMessageNode(node, { insertAfter: thinking || undefined });
        return;
    }
    node.dataset.replyKey = String(replyKey);
    appendMessageNode(node, {
        insertAfter: findLastReplyToolNode(replyKey)
            || findReplyContentNode(replyKey)
            || findReplyThinkingNode(replyKey)
            || undefined,
    });
}

function findFirstReplyToolNode(replyKey) {
    if (!replyKey || !messageList) return null;
    return messageList.querySelector(`[data-reply-key="${CSS.escape(String(replyKey))}"]`);
}

function findLastReplyToolNode(replyKey) {
    const first = findFirstReplyToolNode(replyKey);
    if (!first) return null;
    let last = first;
    let node = first.nextSibling;
    while (node) {
        if (node.dataset && node.dataset.replyKey === String(replyKey)) {
            last = node;
            node = node.nextSibling;
            continue;
        }
        break;
    }
    return last;
}

function syncScrollAfterMessageChange(shouldStickToBottom, options = {}) {
    if (isRestoring) return;
    if (shouldStickToBottom) {
        scrollToBottom();
    } else if (options.showLatestButton !== false) {
        showScrollToLatestButton();
    }
}

// ─── 消息列表懒加载 ──────────────────────────────────────────────────────────

function resetLazyRenderState() {
    if (lazyRenderState.loadMoreEl && lazyRenderState.loadMoreEl.parentNode) {
        lazyRenderState.loadMoreEl.remove();
    }
    lazyRenderState.renderedFromIndex = 0;
    lazyRenderState.loadMoreEl = null;
    lazyRenderState.isLoadingMore = false;
    lazyRenderState.isAdjustingScroll = false;
    lazyRenderState.lastScrollTop = messagesContainer ? messagesContainer.scrollTop : 0;
}

function insertLoadMorePlaceholder(unrenderedCount) {
    if (lazyRenderState.loadMoreEl) lazyRenderState.loadMoreEl.remove();
    const el = document.createElement('div');
    el.className = 'load-more-messages';
    el.innerHTML = `<span class="load-more-icon">▲</span> 加载更多历史消息 <span class="load-more-count">(${unrenderedCount} 条)</span>`;
    el.addEventListener('click', () => loadMoreMessages());
    messageList.prepend(el);
    lazyRenderState.loadMoreEl = el;
}

function captureLazyScrollAnchor() {
    const containerTop = messagesContainer.getBoundingClientRect().top;
    for (const node of messageList.children) {
        if (node === lazyRenderState.loadMoreEl) continue;
        const rect = node.getBoundingClientRect();
        if (rect.bottom > containerTop) {
            return { node, offsetTop: rect.top - containerTop };
        }
    }
    return null;
}

function restoreLazyScrollAnchor(anchor) {
    if (!anchor || !anchor.node.isConnected) return;
    const containerTop = messagesContainer.getBoundingClientRect().top;
    const nextOffsetTop = anchor.node.getBoundingClientRect().top - containerTop;
    lazyRenderState.isAdjustingScroll = true;
    messagesContainer.scrollTop += nextOffsetTop - anchor.offsetTop;
    lazyRenderState.lastScrollTop = messagesContainer.scrollTop;
    requestAnimationFrame(() => {
        lazyRenderState.lastScrollTop = messagesContainer.scrollTop;
        lazyRenderState.isAdjustingScroll = false;
    });
}

function loadMoreMessages() {
    if (lazyRenderState.isLoadingMore || lazyRenderState.renderedFromIndex <= 0) return;
    lazyRenderState.isLoadingMore = true;

    const endIndex = lazyRenderState.renderedFromIndex;
    const startIndex = findLazyStartIndex(chatLog, endIndex, LAZY_RENDER_BATCH_SIZE);

    // 暂存并清空注册表，隔离旧消息渲染，避免覆盖已渲染新消息的状态
    const savedStreams = new Map(streamMessageRegistry);
    const savedTools = new Map(toolCallRegistry);
    const savedSystems = new Map(systemMessageRegistry);
    const savedEventTrace = eventTraceLog;
    const savedEventTraceSeen = eventTraceObjectSeen;
    const previousIsRestoring = isRestoring;
    const previousPrependTarget = lazyPrependTarget;
    const anchor = captureLazyScrollAnchor();

    try {
        streamMessageRegistry.clear();
        toolCallRegistry.clear();
        systemMessageRegistry.clear();
        eventTraceLog = null;
        eventTraceObjectSeen = new WeakSet();

        if (lazyRenderState.loadMoreEl) {
            lazyRenderState.loadMoreEl.remove();
            lazyRenderState.loadMoreEl = null;
        }
        const firstChild = messageList.firstChild;

        isRestoring = true;
        lazyPrependTarget = document.createDocumentFragment();
        for (let i = startIndex; i < endIndex; i++) {
            renderLogEntry(chatLog[i]);
        }
        const fragment = lazyPrependTarget;
        lazyPrependTarget = null;

        messageList.insertBefore(fragment, firstChild);
        lazyRenderState.renderedFromIndex = startIndex;
        if (startIndex > 0) {
            insertLoadMorePlaceholder(startIndex);
        }
        restoreLazyScrollAnchor(anchor);
    } catch (error) {
        console.error('加载历史消息失败:', error);
        if (lazyRenderState.renderedFromIndex > 0 && !lazyRenderState.loadMoreEl) {
            insertLoadMorePlaceholder(lazyRenderState.renderedFromIndex);
        }
    } finally {
        isRestoring = previousIsRestoring;
        lazyPrependTarget = previousPrependTarget;
        streamMessageRegistry.clear();
        toolCallRegistry.clear();
        systemMessageRegistry.clear();
        eventTraceLog = savedEventTrace;
        eventTraceObjectSeen = savedEventTraceSeen;
        for (const [k, v] of savedStreams) streamMessageRegistry.set(k, v);
        for (const [k, v] of savedTools) toolCallRegistry.set(k, v);
        for (const [k, v] of savedSystems) systemMessageRegistry.set(k, v);
        lazyRenderState.isLoadingMore = false;
    }
}

// ─── 滚动相关 ─────────────────────────────────────────────────────────────────

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
    toolStreamIdByIndex.clear();
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
    toolStreamIdByIndex.clear();
    rawStreamRegistry.forEach(state => {
        if (state.timer) clearTimeout(state.timer);
    });
    rawStreamRegistry.clear();
    resetLazyRenderState();
    if (messageList) messageList.innerHTML = '';

    // 懒加载：只渲染最后一批
    const total = chatLog.length;
    const startIndex = findLazyStartIndex(chatLog, total, LAZY_RENDER_BATCH_SIZE);
    lazyRenderState.renderedFromIndex = startIndex;

    isRestoring = true;
    if (startIndex > 0) {
        insertLoadMorePlaceholder(startIndex);
    }
    for (let i = startIndex; i < total; i++) {
        renderLogEntry(chatLog[i]);
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

// 切换执行来源
function changeExecutionSource() {
    currentExecutionSource = executionSourceSelect.value || 'human_chat';
    localStorage.setItem('selectedExecutionSource', currentExecutionSource);
    showSystemMessage(`执行来源已切换为: ${currentExecutionSource}`);
}

// 切换Agent模式
function changeAgentMode() {
    const selectedMode = agentModeSelect.value;
    currentAgentMode = selectedMode;
    localStorage.setItem('selectedAgentMode', selectedMode);

    if (agentCodeGroup) {
        agentCodeGroup.style.display = selectedMode === 'magiclaw' ? '' : 'none';
    }
    if (customAgentCodeGroup) {
        customAgentCodeGroup.style.display = selectedMode === 'custom_agent' ? '' : 'none';
    }

    const modeNames = {
        'magic': 'Magic模式',
        'general': 'General模式',
        'ppt': 'PPT模式',
        'data_analysis': '数据分析模式',
        'summary': '总结模式',
        'canvas': 'Canvas管理模式',
        'magiclaw': 'MagicLaw模式',
        'custom_agent': '自定义Agent模式'
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
    let wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/v1/messages/subscribe';

    // 浏览器 WebSocket 无法设置自定义 header，通过 ?token= 携带鉴权凭证。
    // 优先取输入框的值，留空时回落到上传配置中的 authorization
    let authToken = authTokenInput ? authTokenInput.value.trim() : '';
    if (!authToken) {
        const uploadedConfig = typeof getUploadedConfig === 'function' ? getUploadedConfig() : null;
        if (uploadedConfig) {
            const metadata = uploadedConfig.metadata || {};
            authToken = uploadedConfig.authorization || metadata.authorization || '';
        }
    }
    if (authToken) {
        wsUrl += '?token=' + encodeURIComponent(authToken);
    }

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
        updateTokenContextPreview(payload && (payload.token_usage || payload.usage));

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
            const tool = payload && normalizeToolAttachments(payload.tool, payload.attachments);
            if (tool) {
                showToolCallMessage(tool, eventType, payload.send_timestamp, false, {
                    correlationId: payload.correlation_id,
                    toolCallId: tool.id,
                    replyKey: payload.app_message_id || payload.correlation_id || '',
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
	updateTokenContextPreview(chunk.token_usage || chunk.usage);
	const messageKey = resolveSuperMagicMessageKey(
		chunk.super_message_id,
        envelope.appMessageId,
        chunk.app_message_id,
		chunk.id,
		chunk.correlation_id,
	);
    const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
    const timestamp = Math.floor((envelope.timestampMs || Date.now()) / 1000);
    const streamKey = messageKey || `chunk-${chunk.correlation_id || chunk.i || Date.now()}`;
    const chunkIndex = chunk.i ?? chunk.chunk_id ?? chunk.index;
    for (const choice of choices) {
        const delta = choice && choice.delta ? choice.delta : {};
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            if (isDuplicateSuperMagicChunkDelta(envelope, choice, 'reasoning')) continue;
            showAssistantActivity('thinking');
            queueRawStreamChunk({
                key: streamKey,
                content: delta.reasoning_content,
                contentType: 'reasoning',
                streamStatus: 1,
                timestamp,
                isFinal: false,
                chunkId: chunkIndex === undefined || chunkIndex === null ? undefined : `${chunkIndex}:reasoning`,
            });
        }
        if (typeof delta.content === 'string' && delta.content) {
            if (isDuplicateSuperMagicChunkDelta(envelope, choice, 'content')) continue;
            showAssistantActivity('writing');
            queueRawStreamChunk({
                key: streamKey,
                content: delta.content,
                contentType: 'content',
                streamStatus: 1,
                timestamp,
                isFinal: false,
                chunkId: chunkIndex === undefined || chunkIndex === null ? undefined : `${chunkIndex}:content`,
            });
        }
        const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
        for (const toolCall of toolCalls) {
            const toolIndex = toolCall && toolCall.index !== undefined ? toolCall.index : 0;
            if (isDuplicateSuperMagicChunkDelta(envelope, { index: `${choice.index || 0}:${toolIndex}` }, 'tool')) {
                continue;
            }
            enqueueToolStreamDelta(streamKey, toolCall, timestamp, chunkIndex);
        }
    }

    return true;
}

function isDuplicateSuperMagicChunkDelta(envelope, choice, deltaType) {
    const chunk = envelope && envelope.chunk;
    if (!chunk) return false;

    const chunkIndex = chunk.i ?? chunk.chunk_id ?? chunk.index;
    if (chunkIndex === undefined || chunkIndex === null) return false;

    const messageKey = resolveSuperMagicMessageKey(
        chunk.super_message_id,
        envelope.appMessageId,
        chunk.app_message_id,
        chunk.id,
        chunk.correlation_id,
    ) || 'unknown';
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

function resolveToolStreamKey(messageKey, toolCall) {
    const index = toolCall && toolCall.index !== undefined ? toolCall.index : 0;
    const indexKey = `${messageKey || 'unknown'}:${index}`;
    const fallbackKey = `tool-stream:${indexKey}`;
    if (toolCall && toolCall.id) {
        const previous = toolStreamIdByIndex.get(indexKey);
        toolStreamIdByIndex.set(indexKey, toolCall.id);
        const oldKey = previous || (streamMessageRegistry.has(`tool:${fallbackKey}`) ? fallbackKey : '');
        if (oldKey && oldKey !== toolCall.id) {
            retargetToolStream(oldKey, toolCall.id);
        }
        return toolCall.id;
    }
    return toolStreamIdByIndex.get(indexKey) || fallbackKey;
}

function retargetToolStream(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) return;
    const rawOld = `tool:${oldKey}`;
    const rawNew = `tool:${newKey}`;
    const paced = rawStreamRegistry.get(rawOld);
    if (paced) {
        paced.key = newKey;
        rawStreamRegistry.set(rawNew, paced);
        rawStreamRegistry.delete(rawOld);
    }
    const box = streamMessageRegistry.get(rawOld);
    if (box) {
        box.toolCallId = newKey;
        streamMessageRegistry.set(rawNew, box);
        streamMessageRegistry.delete(rawOld);
    }
}

function enqueueToolStreamDelta(messageKey, toolCall, timestamp, chunkIndex) {
    const fn = (toolCall && toolCall.function) || {};
    const streamKey = resolveToolStreamKey(messageKey, toolCall);
    const args = typeof fn.arguments === 'string' ? fn.arguments : '';
    if (fn.name || fn.label) {
        showToolStreamMessage('', timestamp, true, {
            key: streamKey,
            replace: true,
            toolName: fn.name || '',
            toolLabel: fn.label || '',
            toolCallId: streamKey,
            replyKey: messageKey,
        });
    }
    if (!args) return;
    showAssistantActivity('tool');
    queueRawStreamChunk({
        key: streamKey,
        content: args,
        contentType: 'tool',
        streamStatus: 1,
        timestamp,
        isFinal: false,
        chunkId: chunkIndex === undefined || chunkIndex === null ? undefined : `${chunkIndex}:tool:${streamKey}`,
        toolName: fn.name || '',
        toolLabel: fn.label || '',
        replyKey: messageKey,
    });
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

function queueRawStreamChunk({ key, content, contentType, streamStatus, timestamp, isFinal, chunkId, toolName, toolLabel, replyKey }) {
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
            toolName: toolName || '',
            toolLabel: toolLabel || '',
            replyKey: replyKey || '',
        };
        rawStreamRegistry.set(streamKey, state);
    }
    if (toolName) state.toolName = toolName;
    if (toolLabel) state.toolLabel = toolLabel;
    if (replyKey) state.replyKey = replyKey;

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
    const prefix = contentType === 'reasoning' ? 'reasoning' : (contentType === 'tool' ? 'tool' : 'content');
    const registryKey = `${prefix}:${key}`;
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

// 积压短时一次吐 2 个字，保持打字感；合并包把积压拉大时加快，避免越跟越慢。
function getPacedRenderStep(remaining) {
    if (remaining > 800) return 40;
    if (remaining > 200) return 12;
    if (remaining > 40) return 5;
    return 2;
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
    const step = getPacedRenderStep(remaining);
    const nextLength = state.renderedContent.length + Math.min(step, remaining);
    const nextContent = state.targetContent.slice(0, nextLength);
    state.renderedContent = nextContent;

    const options = {
        key: state.key,
        replace: true,
    };
    if (state.contentType === 'reasoning') {
        showThinkingMessage(nextContent, state.timestamp, true, options);
    } else if (state.contentType === 'tool') {
        showToolStreamMessage(nextContent, state.timestamp, true, {
            ...options,
            toolName: state.toolName,
            toolLabel: state.toolLabel,
            toolCallId: state.key,
            replyKey: state.replyKey,
        });
    } else {
        showAIMessage(nextContent, state.timestamp, true, options);
    }

    scheduleRawStreamRender(state, streamKey);
}

function persistRawStreamFinal(state, streamKey) {
    if (state.contentType === 'tool') return;
    if (state.loggedFinal || !state.renderedContent) return;
    state.loggedFinal = true;
    hideAssistantActivity();
    const entry = {
        type: state.contentType === 'reasoning' ? 'thinking' : 'ai',
        content: state.renderedContent,
        timestamp: state.timestamp,
        rawStreamKey: streamKey,
        key: state.key,
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

/**
 * 解析 V2 流式消息与最终消息共享的稳定标识。
 *
 * super_message_id 由 Super Magic 生成并由下游透传，不会因消息落库而被覆盖；
 * 其余标识仅用于兼容旧消息和未携带 super_message_id 的数据。
 */
function resolveSuperMagicMessageKey(superMessageId, ...fallbackIds) {
    const messageId = [superMessageId, ...fallbackIds]
        .find(value => value !== undefined && value !== null && value !== '');
    return messageId === undefined ? '' : String(messageId);
}

function handleSuperMagicMessage(smsg, payload) {
	updateTokenContextPreview(smsg && (smsg.token_usage || smsg.usage));
	const messageKey = resolveSuperMagicMessageKey(
        smsg.super_message_id,
        smsg.message_id,
        payload.message_id,
        smsg.correlation_id,
		payload.correlation_id,
	);
    const isToolRole = smsg.role === 'tool';
    let hasVisibleContent = false;
    let hasReplyContent = false;

    // 最终消息是权威全文。若匀速渲染还在跑，只校正目标文本，让剩下的字继续打完。
    if (!isToolRole && smsg.reasoning_content) {
        if (queueRawStreamFinal(messageKey, 'reasoning', smsg.reasoning_content, payload.send_timestamp)) {
            hasVisibleContent = true;
            hasReplyContent = true;
        } else {
            showThinkingMessage(smsg.reasoning_content, payload.send_timestamp, false, {
                key: messageKey,
                replace: true,
                finalize: true,
            });
            hasVisibleContent = true;
            hasReplyContent = true;
        }
    }
    if (!isToolRole && smsg.content) {
        if (queueRawStreamFinal(messageKey, 'content', smsg.content, payload.send_timestamp)) {
            hasVisibleContent = true;
            hasReplyContent = true;
        } else {
            showAIMessage(smsg.content, payload.send_timestamp, false, {
                key: messageKey,
                replace: true,
                finalize: true,
            });
            hasVisibleContent = true;
            hasReplyContent = true;
        }
    }

    const tools = collectToolsFromSuperMagicMessage(smsg, payload);
    const finishedAttachments = isMainAgentFinished(payload) && Array.isArray(payload.attachments)
        ? payload.attachments
        : null;
    for (const item of tools) {
        showToolCallMessage(item.tool, payload.event, payload.send_timestamp, false, {
            correlationId: smsg.correlation_id || payload.correlation_id,
            toolCallId: item.toolCallId,
            modelContent: item.modelContent,
            replyKey: messageKey,
            attachments: isFinalTaskTool(item.tool)
                ? (finishedAttachments || [])
                : undefined,
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
        void pollFollowUpSuggestions(currentDebugTaskId);
    }
    return hasVisibleContent;
}

function isFollowUpSuggestionsEnabled() {
    return !followUpSuggestionsToggle || followUpSuggestionsToggle.checked;
}

function delayFollowUpRetry(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

/**
 * 主任务正常结束后，按前端同样的节奏查询追加问题。
 * status 为 0 时最多再等 3 次，每次 3 秒；完成且有内容才展示，失败或超时不展示。
 */
async function pollFollowUpSuggestions(taskId) {
    if (!taskId || !isFollowUpSuggestionsEnabled()) return;
    const token = ++followUpPollToken;
    const serverUrl = (serverUrlInput.value.trim() || 'http://127.0.0.1:8002').replace(/\/+$/, '');

    for (let retryCount = 0; retryCount <= SUGGESTION_MAX_RETRY_COUNT; retryCount += 1) {
        if (token !== followUpPollToken || !isFollowUpSuggestionsEnabled()) return;
        let meta = null;
        try {
            const response = await fetch(`${serverUrl}/api/v1/debug/follow-up-suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: SUGGESTION_RELATION_TYPE_TASK,
                    relation_id: taskId,
                }),
            });
            const json = await response.json().catch(() => null);
            if (!response.ok || !json || json.code !== 1000) return;
            meta = json.data || null;
        } catch (error) {
            console.warn('查询追加问题失败:', error);
            return;
        }
        if (token !== followUpPollToken) return;
        if (!meta || meta.status === SUGGESTION_STATUS_PENDING) {
            if (retryCount >= SUGGESTION_MAX_RETRY_COUNT) return;
            await delayFollowUpRetry(SUGGESTION_RETRY_DELAY_MS);
            continue;
        }
        if (meta.status === SUGGESTION_STATUS_FAILED) return;
        renderFollowUpSuggestions(taskId, Array.isArray(meta.suggestions) ? meta.suggestions : []);
        return;
    }
}

function renderFollowUpSuggestions(taskId, suggestions) {
    const items = suggestions.filter((item) => typeof item === 'string' && item.trim());
    if (!items.length || !messageList) return;
    const existing = messageList.querySelector(`[data-follow-up-task-id="${taskId}"]`);
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'message follow-up-suggestions';
    wrapper.dataset.followUpTaskId = taskId;

    const title = document.createElement('div');
    title.className = 'follow-up-suggestions-title';
    title.textContent = '追加问题';
    wrapper.appendChild(title);

    items.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'follow-up-suggestion-item';
        button.textContent = item;
        button.addEventListener('click', () => {
            if (!messageInput || messageInput.disabled) return;
            messageInput.value = item;
            messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            messageInput.focus();
        });
        wrapper.appendChild(button);
    });
    appendMessageNode(wrapper);
}

function isMainAgentFinished(payload) {
    if (!payload || typeof payload !== 'object') return false;
    return payload.event === 'after_main_agent_run' && payload.status === 'finished';
}

function collectToolsFromSuperMagicMessage(smsg, payload) {
    const tools = [];
    if (smsg.tool) {
        tools.push({
            tool: normalizeToolAttachments(smsg.tool, smsg.attachments, payload && payload.attachments),
            toolCallId: smsg.tool_call_id || smsg.tool.id,
            modelContent: smsg.content || '',
        });
    }
    if (Array.isArray(smsg.tool_calls)) {
        for (const toolCall of smsg.tool_calls) {
            if (toolCall && toolCall.tool) {
                tools.push({
                    tool: normalizeToolAttachments(
                        toolCall.tool,
                        toolCall.attachments,
                        smsg.attachments,
                        payload && payload.attachments,
                    ),
                    toolCallId: toolCall.id || toolCall.tool.id,
                    modelContent: toolCall.content || '',
                });
            }
        }
    }
    if (payload && payload.tool) {
        tools.push({
            tool: normalizeToolAttachments(payload.tool, payload.attachments, smsg.attachments),
            toolCallId: payload.tool.id,
            modelContent: smsg.content || '',
        });
    }
    return tools;
}

function normalizeToolAttachments(tool, ...attachmentSources) {
    if (!tool || typeof tool !== 'object') return tool;
    const merged = [];
    const seen = new Set();
    for (const source of [tool.attachments, ...attachmentSources]) {
        if (!Array.isArray(source)) continue;
        for (const attachment of source) {
            if (!attachment || typeof attachment !== 'object') continue;
            const identity = attachment.file_key || attachment.file_url || attachment.filename;
            if (identity && seen.has(identity)) continue;
            if (identity) seen.add(identity);
            merged.push(attachment);
        }
    }
    return merged.length ? { ...tool, attachments: merged } : tool;
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
    // 所有链接在新窗口打开
    div.querySelectorAll('a[href]').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
    });
    enhanceRenderedFilePathMentions(div);
    return div;
}

/**
 * 将 Markdown 正文中的文件路径标记渲染为可点击的工作区文件标签。
 */
function enhanceRenderedFilePathMentions(root) {
    if (!root || !root.textContent.includes('[@file_path:')) return;
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent || parent.closest('pre, code, a, button, .ai-file-path-mention')) {
                return NodeFilter.FILTER_REJECT;
            }
            return node.textContent.includes('[@file_path:')
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(replaceFilePathMentionsInTextNode);
}

/**
 * 替换单个文本节点中的文件路径标记，保留标记前后的普通文本。
 */
function replaceFilePathMentionsInTextNode(textNode) {
    const text = textNode.textContent || '';
    const pattern = /\[@file_path:(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\]]+))\]/g;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    let hasMatch = false;

    while ((match = pattern.exec(text)) !== null) {
        const rawPath = match[1] ?? match[2] ?? match[3] ?? '';
        const filePath = normalizeRenderedFilePath(rawPath, match[1] !== undefined || match[2] !== undefined);
        if (!filePath) continue;
        hasMatch = true;
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        fragment.appendChild(createRenderedFilePathMention(filePath));
        lastIndex = match.index + match[0].length;
    }

    if (!hasMatch) return;
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.replaceWith(fragment);
}

/**
 * 标准化消息正文中的工作区文件路径，内部始终使用相对路径。
 */
function normalizeRenderedFilePath(rawPath, isQuoted = false) {
    let filePath = String(rawPath || '').trim();
    if (isQuoted) filePath = filePath.replace(/\\(.)/g, '$1');
    try {
        filePath = decodeURI(filePath);
    } catch (_) {
        // 解码失败时继续使用原始路径。
    }
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * 创建与 magic-web 展示一致的文件路径标签，并复用现有文件预览能力。
 */
function createRenderedFilePathMention(filePath) {
    const mention = document.createElement('span');
    mention.className = 'ai-file-path-mention';
    mention.setAttribute('role', 'button');
    mention.setAttribute('tabindex', '0');
    mention.title = filePath;
    mention.textContent = `@${filePath}`;

    const openPreview = () => {
        void openApiFilePreviewTab({
            name: getWorkspaceFileBaseName(filePath),
            path: filePath,
            type: 'file',
            size: 0,
            updated_at: 0,
        });
    };
    mention.addEventListener('click', openPreview);
    mention.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openPreview();
    });
    return mention;
}

function renderMarkdownContent(text) {
    if (typeof marked !== 'undefined') {
        // 所有链接在新窗口打开，避免覆盖当前调试客户端页面
        const html = marked.parse(text || '', { breaks: true });
        return html.replace(/<a\s+href="/g, '<a target="_blank" rel="noopener" href="');
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
    if (!_noLog) {
        const entry = { type: 'ai', content, timestamp };
        if (options.key) entry.key = options.key;
        pushLog(entry);
    }

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

    messageState = { messageDiv, renderedView, rawView, content: '', finalized: false };
    attachCopyButton(actions, () => messageState.content);
    updateAIMessageState(messageState, content, options);
    if (registryKey) {
        streamMessageRegistry.set(registryKey, messageState);
    }
    placeAssistantReplyNode(messageDiv, options.key, 'content');
}

function updateAIMessageState(messageState, content, options = {}) {
    if (shouldIgnoreLateStreamAppend(messageState, options)) return;
    const shouldStickToBottom = isMessageViewportAtBottom();
    const nextContent = options.append ? messageState.content + content : content;
    messageState.content = nextContent;
    if (options.finalize) messageState.finalized = true;
    messageState.renderedView.replaceChildren(buildRenderedView(nextContent));
    messageState.rawView.textContent = nextContent;
    syncScrollAfterMessageChange(shouldStickToBottom);
}

/**
 * 判断是否应忽略权威最终消息到达后的迟到流式片段。
 */
function shouldIgnoreLateStreamAppend(messageState, options = {}) {
    return messageState.finalized === true && options.append === true;
}

// 显示思考过程（折叠展示）
function showThinkingMessage(content, timestamp, _noLog = false, options = {}) {
    if (!_noLog) {
        const entry = { type: 'thinking', content, timestamp };
        if (options.key) entry.key = options.key;
        pushLog(entry);
    }

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
    thinkingState = { wrapper, detail, content: '', finalized: false };
    attachCopyButton(summary, () => thinkingState.content, { compact: true });
    updateThinkingMessageState(thinkingState, content, options);
    if (registryKey) {
        streamMessageRegistry.set(registryKey, thinkingState);
    }
    placeAssistantReplyNode(wrapper, options.key, 'thinking');
}

function updateThinkingMessageState(thinkingState, content, options = {}) {
    if (shouldIgnoreLateStreamAppend(thinkingState, options)) return;
    const shouldStickToBottom = isMessageViewportAtBottom();
    thinkingState.content = options.append ? thinkingState.content + content : content;
    if (options.finalize) thinkingState.finalized = true;
    thinkingState.detail.textContent = thinkingState.content;
    if (shouldStickToBottom) {
        thinkingState.detail.scrollTop = thinkingState.detail.scrollHeight;
    }
    syncScrollAfterMessageChange(shouldStickToBottom);
}

function showToolStreamMessage(content, timestamp, _noLog = false, options = {}) {
    const registryKey = options.key ? `tool:${options.key}` : '';
    let streamState = registryKey ? streamMessageRegistry.get(registryKey) : null;
    if (streamState) {
        updateToolStreamState(streamState, content, options);
        return;
    }

    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    const wrapper = document.createElement('div');
    wrapper.className = 'tool-call-block tool-call-running tool-stream-block';

    const header = document.createElement('div');
    header.className = 'tool-call-header';

    const statusDot = document.createElement('span');
    statusDot.className = 'tool-call-status-dot';

    const actionSpan = document.createElement('span');
    actionSpan.className = 'tool-call-action';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'tool-call-time';
    timeSpan.textContent = timeStr;

    header.appendChild(statusDot);
    header.appendChild(actionSpan);
    header.appendChild(timeSpan);

    const detail = document.createElement('pre');
    detail.className = 'tool-call-detail tool-stream-detail';

    wrapper.appendChild(header);
    wrapper.appendChild(detail);

    streamState = {
        wrapper,
        actionSpan,
        detail,
        content: '',
        toolCallId: options.toolCallId || options.key || '',
        toolName: options.toolName || '',
        toolLabel: options.toolLabel || '',
        replyKey: options.replyKey || '',
    };
    updateToolStreamState(streamState, content, options);
    if (registryKey) {
        streamMessageRegistry.set(registryKey, streamState);
    }
    placeAssistantReplyNode(wrapper, options.replyKey, 'tool');
}

function updateToolStreamState(streamState, content, options = {}) {
    const shouldStickToBottom = isMessageViewportAtBottom();
    streamState.content = options.append ? streamState.content + content : content;
    if (options.toolName) streamState.toolName = options.toolName;
    if (options.toolLabel) streamState.toolLabel = options.toolLabel;
    if (options.toolCallId) streamState.toolCallId = options.toolCallId;
    if (options.replyKey) {
        streamState.replyKey = options.replyKey;
        streamState.wrapper.dataset.replyKey = String(options.replyKey);
    }
    const title = streamState.toolLabel || streamState.toolName || '工具调用';
    streamState.actionSpan.textContent = `流式 · ${title}`;
    streamState.detail.textContent = streamState.content;
    if (shouldStickToBottom) {
        streamState.detail.scrollTop = streamState.detail.scrollHeight;
    }
    syncScrollAfterMessageChange(shouldStickToBottom);
}

function findToolStreamBox(toolKey) {
    if (!toolKey) return null;
    const direct = streamMessageRegistry.get(`tool:${toolKey}`);
    if (direct) return { key: toolKey, state: direct };
    for (const [regKey, state] of streamMessageRegistry.entries()) {
        if (!regKey.startsWith('tool:')) continue;
        if (state.toolCallId === toolKey || regKey === `tool:${toolKey}`) {
            return { key: regKey.slice(5), state };
        }
    }
    return null;
}

function stopToolStream(streamKey) {
    const rawKey = `tool:${streamKey}`;
    const state = rawStreamRegistry.get(rawKey);
    if (state && state.timer) clearTimeout(state.timer);
    rawStreamRegistry.delete(rawKey);
    streamMessageRegistry.delete(rawKey);
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
    card.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; });

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
    appendAskUserRemark(card, data.remark);

    card.classList.remove('ask-user-card');
    card.classList.add('ask-user-card', status === 'answered' ? 'answered' : 'expired');

    // 移除操作按钮区（可能已禁用，彻底隐藏更干净）
    card.querySelectorAll('.ask-user-actions').forEach(el => el.remove());
    card.querySelectorAll('.ask-user-countdown').forEach(el => { el.textContent = statusLabel[status] || status; el.className = 'ask-user-countdown'; });

    askUserCardRegistry.delete(data.question_id);
}

/** 展示 ask_user 提交时携带的追加备注。 */
function appendAskUserRemark(card, remark) {
    const normalizedRemark = typeof remark === 'string' ? remark.trim() : '';
    if (!normalizedRemark) return;

    const remarkEl = document.createElement('div');
    remarkEl.className = 'ask-user-result ask-user-remark-result';
    remarkEl.textContent = `备注：${normalizedRemark}`;
    card.appendChild(remarkEl);
}

/**
 * 渲染 ask_user 交互卡片并挂到 container 上。
 * data: { question_id, questions[], expires_at, status, answers?, remark? }
 */
function renderAskUserCard(data, container) {
    const { question_id, questions = [], expires_at, status } = data;
    const alreadyDone = status && status !== 'pending';

    const card = document.createElement('div');
    card.className = 'ask-user-card' + (alreadyDone ? ' answered' : '');

    // 通用禁用函数（仅操作 DOM，不依赖闭包变量顺序）
    function disableCard() {
        if (card._countdownTimer) clearInterval(card._countdownTimer);
        card.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; });
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
        disableCard();
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
        appendAskUserRemark(card, data.remark);
        container.appendChild(card);
        return;
    }

    // 备注属于整张问答卡片的附加上下文，不参与答案 JSON。
    const remarkLabel = document.createElement('label');
    remarkLabel.className = 'ask-user-remark-label';
    remarkLabel.textContent = '补充备注（可选）';
    const remarkInput = document.createElement('textarea');
    remarkInput.className = 'ask-user-input ask-user-remark';
    remarkInput.rows = 2;
    remarkInput.placeholder = '可补充说明、约束或其他上下文…';
    remarkLabel.appendChild(remarkInput);
    card.appendChild(remarkLabel);

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
        const remark = remarkInput.value.trim();
        const detail = {
            response_status,
            answer: JSON.stringify(answers),
        };
        if (remark) detail.remark = remark;

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
                        detail,
                    }
                })
            });
            const json = await resp.json();

            const resultEl = document.createElement('div');
            resultEl.className = 'ask-user-result' + (response_status === 'skipped' ? ' skipped' : '');
            resultEl.textContent = response_status === 'answered' ? '✅ 已提交' : '⏭ 已跳过';
            card.appendChild(resultEl);
            appendAskUserRemark(card, remark);
            card.classList.add('answered');

            showEventLog({ label: `ask_user 响应: ${json.message || response_status}`, ...json });
        } catch (e) {
            showSystemMessage(`ask_user 提交失败: ${e.message}`);
            // 重新启用按钮允许重试
            card.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = false; });
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

    const toolKey = getToolCallKey(tool, options);
    const streamBox = findToolStreamBox(toolKey);
    const replyKey = options.replyKey || (streamBox && streamBox.state && streamBox.state.replyKey) || '';
    if (!_noLog) {
        const logEntry = { type: 'tool_call', tool, eventType, timestamp };
        if (options.modelContent) logEntry.modelContent = options.modelContent;
        if (Array.isArray(options.attachments)) logEntry.attachments = options.attachments;
        if (replyKey) logEntry.replyKey = replyKey;
        if (options.toolCallId || toolKey) logEntry.toolCallId = options.toolCallId || toolKey;
        pushLog(logEntry);
    }

    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

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

    const attachmentsEl = document.createElement('div');
    attachmentsEl.className = 'tool-call-attachments';
    attachmentsEl.style.display = 'none';

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
    wrapper.appendChild(attachmentsEl);

    toolState = {
        wrapper,
        header,
        actionSpan,
        remarkSpan,
        timeSpan,
        arrow,
        detailEl,
        attachmentsEl,
        copyBtn,
        openDetailPreview: null,
        modelContent: '',
    };
    updateToolCallState(toolState, tool, eventType, timeStr, options);
    if (toolKey) {
        toolCallRegistry.set(toolKey, toolState);
    }
    if (replyKey) wrapper.dataset.replyKey = String(replyKey);
    if (streamBox && streamBox.state.wrapper && streamBox.state.wrapper.parentNode) {
        stopToolStream(streamBox.key);
        streamBox.state.wrapper.replaceWith(wrapper);
        const expectedPrev = findReplyContentNode(replyKey) || findReplyThinkingNode(replyKey);
        if (expectedPrev && !isNodeAfter(wrapper, expectedPrev)) {
            expectedPrev.after(wrapper);
        }
        keepAssistantActivityLast(wrapper);
        syncScrollAfterMessageChange(isMessageViewportAtBottom());
    } else {
        placeAssistantReplyNode(wrapper, replyKey, 'tool');
    }
}

function isNodeAfter(node, earlier) {
    if (!node || !earlier || node.parentNode !== earlier.parentNode) return false;
    return Boolean(earlier.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
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
    const attachments = Array.isArray(options.attachments)
        ? options.attachments
        : (Array.isArray(tool.attachments) ? tool.attachments : null);
    if (attachments !== null) {
        renderToolCallAttachments(toolState.attachmentsEl, attachments);
    }
    syncScrollAfterMessageChange(shouldStickToBottom);
}

/**
 * 渲染工具完成消息携带的附件，严格保留后端数组顺序。
 */
function renderToolCallAttachments(container, attachments) {
    if (!container) return;
    const isExpanded = container.dataset.expanded === 'true';
    container.innerHTML = '';
    if (!Array.isArray(attachments) || attachments.length === 0) {
        delete container.dataset.expanded;
        container.style.display = 'none';
        return;
    }

    const header = document.createElement('div');
    header.className = 'tool-call-attachments-header';

    const title = document.createElement('div');
    title.className = 'tool-call-attachments-title';
    title.textContent = `附件（${attachments.length}）`;
    header.appendChild(title);

    if (attachments.length > 5) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'tool-call-attachments-toggle';
        toggle.setAttribute('aria-expanded', String(isExpanded));
        toggle.textContent = isExpanded ? '收起' : `展开剩余 ${attachments.length - 5} 个`;
        toggle.addEventListener('click', () => {
            const nextExpanded = container.dataset.expanded !== 'true';
            container.dataset.expanded = String(nextExpanded);
            container.classList.toggle('is-expanded', nextExpanded);
            toggle.setAttribute('aria-expanded', String(nextExpanded));
            toggle.textContent = nextExpanded ? '收起' : `展开剩余 ${attachments.length - 5} 个`;
        });
        header.appendChild(toggle);
    } else {
        delete container.dataset.expanded;
    }

    const list = document.createElement('ol');
    list.className = 'tool-call-attachments-list';
    attachments.forEach((attachment, index) => {
        list.appendChild(createToolCallAttachmentItem(attachment, index));
    });

    container.classList.toggle('is-expanded', isExpanded && attachments.length > 5);
    container.appendChild(header);
    container.appendChild(list);
    container.style.display = '';
}

/**
 * 创建单个附件列表项；本地模拟附件复用工作区预览，线上附件使用安全的 HTTP 地址。
 */
function createToolCallAttachmentItem(attachment, index) {
    const item = document.createElement('li');
    item.className = 'tool-call-attachment-item';

    const localPath = getLocalDebugAttachmentPath(attachment);
    const fileUrl = getAttachmentHttpUrl(attachment);
    const canOpen = Boolean(localPath || fileUrl);
    const content = document.createElement(canOpen ? 'button' : 'div');
    content.className = `tool-call-attachment-content${canOpen ? ' is-clickable' : ''}`;
    if (canOpen) content.type = 'button';

    const order = document.createElement('span');
    order.className = 'tool-call-attachment-order';
    order.textContent = String(index + 1);

    const text = document.createElement('span');
    text.className = 'tool-call-attachment-text';

    const name = document.createElement('span');
    name.className = 'tool-call-attachment-name';
    name.textContent = getAttachmentDisplayName(attachment, localPath);
    name.title = name.textContent;

    const metaText = getAttachmentMetaText(attachment);
    text.appendChild(name);
    if (metaText) {
        const meta = document.createElement('span');
        meta.className = 'tool-call-attachment-meta';
        meta.textContent = metaText;
        text.appendChild(meta);
    }

    content.appendChild(order);
    content.appendChild(text);
    if (canOpen) {
        const action = document.createElement('span');
        action.className = 'tool-call-attachment-action';
        action.textContent = localPath ? '预览' : '打开';
        content.appendChild(action);
        content.addEventListener('click', () => {
            if (localPath) {
                void openApiFilePreviewTab({
                    name: getAttachmentDisplayName(attachment, localPath),
                    path: localPath,
                    type: 'file',
                    size: Number(attachment?.file_size) || 0,
                    updated_at: Number(attachment?.timestamp) || 0,
                });
                return;
            }
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
        });
    }

    item.appendChild(content);
    return item;
}

/**
 * 从本地调试附件标识中提取工作区相对路径，不对工作区做额外扫描。
 */
function getLocalDebugAttachmentPath(attachment) {
    const prefix = 'local-debug/workspace/';
    const fileKey = String(attachment?.file_key || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!fileKey.startsWith(prefix)) return '';
    return fileKey.slice(prefix.length).replace(/^\/+/, '');
}

/**
 * 获取允许在新窗口打开的附件 HTTP 地址。
 */
function getAttachmentHttpUrl(attachment) {
    const value = String(attachment?.file_url || '').trim();
    if (!value) return '';
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (_) {
        return '';
    }
}

/**
 * 获取附件展示名称，缺失时依次回退到本地路径和通用名称。
 */
function getAttachmentDisplayName(attachment, localPath = '') {
    return attachment?.display_filename ||
        attachment?.filename ||
        getWorkspaceFileBaseName(localPath) ||
        '未命名附件';
}

/**
 * 生成附件扩展名和大小摘要。
 */
function getAttachmentMetaText(attachment) {
    const parts = [];
    const extension = String(attachment?.file_extension || '').replace(/^\./, '').trim();
    if (extension) parts.push(extension.toUpperCase());
    const fileSize = Number(attachment?.file_size);
    if (Number.isFinite(fileSize) && fileSize >= 0) {
        parts.push(formatFileSizeBytes(fileSize));
    }
    return parts.join(' · ');
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

    if (detail && detail.type === 'browser' && detail.data) {
        renderBrowserToolDetail(toolState, detail.data, tool);
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

function renderBrowserToolDetail(toolState, data, tool) {
    const attachments = Array.isArray(tool.attachments) ? tool.attachments : [];
    const attachment = attachments.find(item => item && item.file_key === data.file_key);
    let imageUrl = typeof data.file_url === 'string' ? data.file_url : '';
    if (!imageUrl && attachment && typeof attachment.file_url === 'string') {
        imageUrl = attachment.file_url;
    }
    const action = data.action || '网页操作';
    const pageTitle = data.page_title || '';
    const title = pageTitle || data.title || action;
    const summary = browserDetailSummary(data, action, pageTitle);
    const target = data.target || '';
    const pageUrl = data.url || '';

    toolState.detailEl.classList.add('tool-call-detail-browser');
    toolState.detailEl.replaceChildren();

    const meta = document.createElement('div');
    meta.className = 'browser-tool-detail-meta';
    const heading = document.createElement('div');
    heading.className = 'browser-tool-detail-title';
    heading.textContent = title;
    meta.appendChild(heading);
    if (summary) {
        const summaryEl = document.createElement('div');
        summaryEl.className = 'browser-tool-detail-summary';
        summaryEl.textContent = summary;
        meta.appendChild(summaryEl);
    }
    if (target) {
        const targetEl = document.createElement('div');
        targetEl.className = 'browser-tool-detail-target';
        targetEl.textContent = `操作对象：${target}`;
        meta.appendChild(targetEl);
    }
    if (pageUrl) {
        const link = document.createElement('a');
        link.className = 'browser-tool-detail-url';
        link.href = pageUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = `页面地址：${pageUrl}`;
        link.addEventListener('click', event => event.stopPropagation());
        meta.appendChild(link);
    }
    toolState.detailEl.appendChild(meta);

    if (imageUrl) {
        const image = document.createElement('img');
        image.className = 'browser-tool-detail-image';
        image.src = imageUrl;
        image.alt = title;
        image.addEventListener('error', () => {
            image.replaceWith(createBrowserSnapshotPlaceholder('截图已过期或暂时无法加载'));
        });
        toolState.detailEl.appendChild(image);
    }

    const previewMarkdown = buildBrowserDetailMarkdown(data, imageUrl);
    toolState.arrow.style.display = '';
    toolState.openDetailPreview = () => openToolDetailPreview(tool, detailFromBrowserData(data), previewMarkdown, toolState.modelContent || '');
    toolState.detailEl.style.display = 'none';
    toolState.arrow.textContent = '▶';
}

function browserDetailSummary(data, action, pageTitle) {
    const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
    if (summary) return summary;
    if (data.status === 'failed') return `${action}未完成，请查看错误信息。`;
    if (data.target) return `${action}已完成：${data.target}`;
    if (pageTitle) return `${action}已完成，当前页面为「${pageTitle}」`;
    if (data.status === 'succeeded') return `${action}已完成。`;
    return '';
}

function createBrowserSnapshotPlaceholder(text) {
    const placeholder = document.createElement('div');
    placeholder.className = 'browser-tool-detail-placeholder';
    placeholder.textContent = text;
    return placeholder;
}

function detailFromBrowserData(data) {
    return { type: 'browser', data };
}

function buildBrowserDetailMarkdown(data, imageUrl) {
    const action = data.action || '网页操作';
    const pageTitle = data.page_title || '';
    const title = pageTitle || data.title || action;
    const lines = [`## ${title}`];
    const summary = browserDetailSummary(data, action, pageTitle);
    if (summary) lines.push('', summary);
    if (data.target) lines.push('', `操作对象：${data.target}`);
    if (data.url) lines.push('', `<a href="${escapeHtml(data.url)}" target="_blank" rel="noreferrer">${escapeHtml(data.url)}</a>`);
    if (imageUrl) {
        lines.push('', `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="max-height:720px;max-width:100%;height:auto">`);
    }
    return lines.join('\n');
}

function formatToolDetail(detail) {
    if (typeof detail === 'string') return detail;
    if (!detail || typeof detail !== 'object') return '';
    if (detail.type === 'md' && detail.data && detail.data.content) return detail.data.content;
    if (detail.type === 'text' && detail.data && detail.data.content) return detail.data.content;
    if (detail.type === 'text' && detail.data && detail.data.message) return detail.data.message;
    if (detail.type === 'terminal' && detail.data) {
        const terminalOutput = detail.data.output || [
            detail.data.stdout || '',
            detail.data.stderr || '',
        ].filter(Boolean).join('\n');
        return [
            detail.data.command ? `$ ${detail.data.command}` : '',
            terminalOutput,
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
    if (detail && typeof detail === 'object' && detail.type === 'browser') {
        return detailText;
    }
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
    const displayData = sanitizeDebugValue(data);
    if (!_noLog) pushLog({ type: 'event', data: displayData });
    if (!showRawEvents) return;
    if (data && typeof data === 'object') {
        if (eventTraceObjectSeen.has(data)) return;
        eventTraceObjectSeen.add(data);
    }
    const eventLabel = getEventTraceLabel(displayData);
    const timeStr = getEventTraceTime(displayData);
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
    detail.textContent = JSON.stringify(displayData, null, 2);
    trace.rawTexts.push(detail.textContent);
    attachCopyButton(summary, () => detail.textContent, { compact: true });

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    trace.body.appendChild(wrapper);
    trace.body.scrollTop = trace.body.scrollHeight;
    keepAssistantActivityLast();
    syncScrollAfterMessageChange(shouldStickToBottom, { showLatestButton: true });
}

function sanitizeDebugValue(value, seen = new WeakSet()) {
    if (typeof value === 'string') {
        const marker = ';base64,';
        const markerIndex = value.indexOf(marker);
        if (value.startsWith('data:') && markerIndex >= 0) {
            const prefixEnd = markerIndex + marker.length;
            return `${value.slice(0, prefixEnd)}<omitted ${value.length - prefixEnd} chars>`;
        }
        return value;
    }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '<circular>';
    seen.add(value);
    if (Array.isArray(value)) {
        const items = value.map(item => sanitizeDebugValue(item, seen));
        seen.delete(value);
        return items;
    }
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        result[key] = sanitizeDebugValue(item, seen);
    }
    seen.delete(value);
    return result;
}

function ensureEventTraceLog() {
    if (eventTraceLog) {
        const inDom = messageList.contains(eventTraceLog.wrapper);
        const inFragment = lazyPrependTarget && lazyPrependTarget.contains(eventTraceLog.wrapper);
        if (inDom || inFragment) return eventTraceLog;
    }

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

    if (event.code === 4401 || event.code === 4503) {
        // 服务端鉴权拒绝：4401 未授权（凭证缺失或不一致），4503 sandbox 未绑定 metadata.json
        showConnectionStatusMessage(`WebSocket连接被服务端拒绝 (code: ${event.code}): ${event.reason || '鉴权失败'}`);
    } else if (event.wasClean) {
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
 * 根据文件树范围生成可插入到消息中的 mention 文本。
 */
function buildFiletreeMentionSnippet(kind, path, scope = getActiveFiletreeScope()) {
    const normalizedPath = kind === 'directory'
        ? normalizeMentionDirectoryPath(path)
        : normalizeMentionFilePath(path);
    if (!normalizedPath) return '';
    const type = scope === 'memory'
        ? (kind === 'directory' ? 'memory_directory' : 'memory_file')
        : (kind === 'directory' ? 'directory_path' : 'file_path');
    return `[@${type}:${normalizedPath}]${MENTION_PROMPT_SEPARATOR}`;
}

/**
 * 从 prompt 解析工作区与长期记忆 mention，生成后端需要的结构化 mentions。
 */
function parsePromptMentions(prompt) {
    if (!prompt || typeof prompt !== 'string') return [];
    const found = [];
    const dirRe = /\[@directory_path:([^\]]+)\]/g;
    const fileRe = /\[@file_path:([^\]]+)\]/g;
    const memoryDirRe = /\[@memory_(?:directory|dir):([^\]]+)\]/g;
    const memoryFileRe = /\[@memory_file:([^\]]+)\]/g;
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
    while ((m = memoryDirRe.exec(prompt)) !== null) {
        const directory_path = normalizeMentionDirectoryPath(m[1]);
        if (directory_path) {
            found.push({
                index: m.index,
                mention: {
                    type: 'memory_directory',
                    directory_name: getWorkspaceFileBaseName(directory_path.replace(/\/+$/, '')),
                    directory_path,
                },
            });
        }
    }
    while ((m = memoryFileRe.exec(prompt)) !== null) {
        const file_path = normalizeMentionFilePath(m[1]);
        if (file_path) {
            found.push({
                index: m.index,
                mention: {
                    type: 'memory_file',
                    file_id: '',
                    file_name: getWorkspaceFileBaseName(file_path),
                    file_path,
                },
            });
        }
    }
    found.sort((a, b) => a.index - b.index);
    const seen = new Set();
    const mentions = [];
    for (const { mention } of found) {
        const key = mention.type === 'project_directory' || mention.type === 'memory_directory'
            ? `d:${mention.type}:${mention.directory_path}`
            : `f:${mention.type}:${mention.file_path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mentions.push(mention);
    }
    return mentions;
}

/** 根据文件路径判断是否为聊天图片。 */
function isImagePath(path) {
    const value = String(path || '').split(/[?#]/, 1)[0];
    const extensionIndex = value.lastIndexOf('.');
    return extensionIndex >= 0 && IMAGE_UPLOAD_EXTENSIONS.has(value.slice(extensionIndex + 1).toLowerCase());
}

/** 根据消息中的工作区图片引用生成后端附件描述，触发原生视觉链路。 */
function buildNativeVisionAttachments(prompt) {
    const imageMentions = parsePromptMentions(prompt)
        .filter((mention) => mention.type === 'project_file' && isImagePath(mention.file_path));
    const seen = new Set();
    const attachments = [];
    for (const mention of imageMentions) {
        const path = normalizeMentionFilePath(mention.file_path);
        if (!path || seen.has(path)) continue;
        seen.add(path);
        const entry = workspaceMentionIndex.find((item) => item.kind === 'file' && item.scope !== 'memory' && item.path === path);
        const filename = getWorkspaceFileBaseName(path);
        attachments.push({
            file_url: debugWorkspaceApi.rawUrl(path, 'workspace'),
            filename,
            file_name: filename,
            file_key: `local-debug/workspace/${path}`,
            file_tag: 'image',
            file_size: Number(entry?.size || 0),
            relative_file_path: path,
        });
    }
    return attachments;
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
    ta.dispatchEvent(new Event('input', { bubbles: true }));
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

function collectApiWorkspaceMentionPaths(entries, out, scope = getActiveFiletreeScope()) {
    for (const entry of entries || []) {
        if (!entry || !entry.path) continue;
        const kind = entry.type === 'directory' ? 'directory' : 'file';
        out.push({ kind, path: entry.path, scope });
        if (kind === 'directory' && Array.isArray(entry.children)) {
            collectApiWorkspaceMentionPaths(entry.children, out, scope);
        }
    }
}

async function refreshWorkspaceMentionIndex() {
    workspaceMentionIndex = [];
    const out = [];
    try {
        const data = await debugWorkspaceApi.listTree('', 8);
        collectApiWorkspaceMentionPaths(data.entries || [], out, getActiveFiletreeScope());
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
        empty.textContent = '没有匹配的路径';
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
    const snippet = buildFiletreeMentionSnippet(item.kind, item.path, item.scope);
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
const uploadWorkspaceBtn = document.getElementById('uploadWorkspaceBtn');
const workspaceUploadInput = document.getElementById('workspaceUploadInput');
const filePreviewWorkbench = document.getElementById('filePreviewWorkbench');
const filePreviewTabsEl = document.getElementById('filePreviewTabs');
const filePreviewMain = filePreviewWorkbench?.querySelector('.file-preview-main') || null;
const filePreviewBody = document.getElementById('filePreviewBody');
const filePreviewMeta = document.getElementById('filePreviewMeta');
const filePreviewClose = document.getElementById('filePreviewClose');
const filePreviewOpenBtn = document.getElementById('filePreviewOpenBtn');
const filePreviewRenderBtn = document.getElementById('filePreviewRenderBtn');
const filePreviewCanvasDataToggleBtn = document.getElementById('filePreviewCanvasDataToggleBtn');
const filePreviewMarkdownMode = document.getElementById('filePreviewMarkdownMode');
const filePreviewEditBtn = document.getElementById('filePreviewEditBtn');
const filePreviewSaveBtn = document.getElementById('filePreviewSaveBtn');
const filePreviewCancelBtn = document.getElementById('filePreviewCancelBtn');
const filetreeTitle = document.getElementById('filetreeTitle');
const filetreeScopeTabs = [...document.querySelectorAll('[data-file-scope]')];
const expandAllTreeBtn = document.getElementById('expandAllTreeBtn');
const collapseAllTreeBtn = document.getElementById('collapseAllTreeBtn');

/** 媒体/PDF 预览用的 blob URL，关闭或切换预览时需 revoke */
let filePreviewObjectUrl = null;

/** 当前正在预览的文件，供"新窗口打开/渲染预览"按钮使用 */
let currentPreviewFile = null;
let currentPreviewPath = '';
let currentPreviewCopyText = '';
let currentPreviewEditable = false;
let filePreviewEditMode = false;
let filePreviewEditDirty = false;
let filePreviewEditContent = '';
let currentCanvasProjectRawText = '';
let currentCanvasProjectDecompressedText = '';
let currentCanvasProjectViewMode = 'decompressed';
let currentCanvasPreviewResizeObserver = null;
const filePreviewTabs = new Map();
let activeFilePreviewPath = '';
let filePreviewScrollPositions = {};
let filePreviewScrollSaveFrame = null;
let isRestoringFilePreviewState = false;
let workspaceUploadTargetDir = '';
const FILETREE_SCOPE_KEY = 'httpClient.filetreeScope';
const FILETREE_SCOPES = {
    workspace: { title: '工作区文件', rootLabel: '.workspace', uploadLabel: '上传文件到 .workspace 根目录' },
    memory: { title: '长期记忆文件', rootLabel: '~/.magic/memory', uploadLabel: '上传文件到长期记忆根目录' },
};
let activeFiletreeScope = localStorage.getItem(FILETREE_SCOPE_KEY) === 'memory' ? 'memory' : 'workspace';
const DEFAULT_EXPANDED_DIRECTORY_LIMIT = 15;

const UNSUPPORTED_REMOTE_IMAGE_EXT_RE = /\.(heic|heif|tif|tiff)(?:[?#]|$)/i;
const DEBUG_WORKSPACE_FILES_API_PREFIX = '/api/v1/debug/workspace-files';

function getDebugWorkspaceApiBase() {
    const base = (serverUrlInput?.value?.trim() || 'http://127.0.0.1:8002').replace(/\/+$/, '');
    return `${base}${DEBUG_WORKSPACE_FILES_API_PREFIX}`;
}

function getActiveFiletreeScope() {
    return activeFiletreeScope;
}

function getActiveFiletreeScopeConfig() {
    return FILETREE_SCOPES[getActiveFiletreeScope()];
}

function updateFiletreeScopeUi() {
    const config = getActiveFiletreeScopeConfig();
    if (filetreeTitle) filetreeTitle.textContent = config.title;
    filetreeScopeTabs.forEach((tab) => {
        const isActive = tab.dataset.fileScope === getActiveFiletreeScope();
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
    });
    if (uploadWorkspaceBtn) {
        uploadWorkspaceBtn.title = config.uploadLabel;
        uploadWorkspaceBtn.setAttribute('aria-label', config.uploadLabel);
    }
    if (refreshTreeBtn) refreshTreeBtn.title = `刷新${config.title}`;
    if (selectWorkspaceBtn) selectWorkspaceBtn.title = `刷新${config.title}`;
}

function appendFiletreeScope(path, scope = getActiveFiletreeScope()) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}scope=${encodeURIComponent(scope)}`;
}

async function requestDebugWorkspaceJson(path, options = {}, scope = getActiveFiletreeScope()) {
    const response = await fetch(`${getDebugWorkspaceApiBase()}${appendFiletreeScope(path, scope)}`, {
        headers: {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {}),
        },
        ...options,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.code !== 1000) {
        throw new Error(json?.message || `HTTP ${response.status}`);
    }
    return json.data || {};
}

function createDebugWorkspaceApiClient() {
    return {
        listTree(path = '', depth = 2, scope = getActiveFiletreeScope()) {
            const query = new URLSearchParams({
                path: path || '',
                depth: String(depth),
            });
            return requestDebugWorkspaceJson(`/tree?${query.toString()}`, {}, scope);
        },
        readFile(path, scope = getActiveFiletreeScope()) {
            return requestDebugWorkspaceJson('/content', {
                method: 'POST',
                body: JSON.stringify({ path }),
            }, scope);
        },
        writeFile(path, content, scope = getActiveFiletreeScope()) {
            return requestDebugWorkspaceJson('/content', {
                method: 'PUT',
                body: JSON.stringify({ path, content, create_parent_dirs: true, overwrite: true }),
            }, scope);
        },
        deletePath(path, recursive = false, scope = getActiveFiletreeScope()) {
            return requestDebugWorkspaceJson('', {
                method: 'DELETE',
                body: JSON.stringify({ path, recursive }),
            }, scope);
        },
        movePath(sourcePath, targetPath, overwrite = false, scope = getActiveFiletreeScope()) {
            return requestDebugWorkspaceJson('/move', {
                method: 'POST',
                body: JSON.stringify({ source_path: sourcePath, target_path: targetPath, overwrite }),
            }, scope);
        },
        uploadFile(targetDir, filename, contentBase64, overwrite = true, scope = getActiveFiletreeScope()) {
            return requestDebugWorkspaceJson('/upload', {
                method: 'POST',
                body: JSON.stringify({
                    target_dir: targetDir || '',
                    filename,
                    content_base64: contentBase64,
                    overwrite,
                }),
            }, scope);
        },
        rawUrl(path, scope = getActiveFiletreeScope()) {
            const query = new URLSearchParams({ path });
            query.set('scope', scope);
            return `${getDebugWorkspaceApiBase()}/raw?${query.toString()}`;
        },
        /** 构造保留目录层级的原始文件地址，供 HTML 相对资源解析使用。 */
        rawPathUrl(path, scope = getActiveFiletreeScope()) {
            const normalizedPath = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
            const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
            return `${getDebugWorkspaceApiBase()}/raw/${encodedPath}?scope=${encodeURIComponent(scope)}`;
        },
        downloadUrl(path, scope = getActiveFiletreeScope()) {
            const query = new URLSearchParams({ path });
            query.set('scope', scope);
            return `${getDebugWorkspaceApiBase()}/download?${query.toString()}`;
        },
    };
}

const debugWorkspaceApi = createDebugWorkspaceApiClient();

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

/** 解码并规范化工作区相对路径，阻止资源路径逃逸工作区根目录。 */
function normalizeMarkdownWorkspacePath(path) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(String(path || ''));
    } catch (e) {
        return '';
    }

    const parts = [];
    for (const part of decodedPath.replace(/\\/g, '/').split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (!parts.length) return '';
            parts.pop();
            continue;
        }
        if ([...part].some(char => char.charCodeAt(0) < 32)) return '';
        parts.push(part);
    }
    return parts.join('/');
}

/** 将 Markdown 文件中的相对资源链接解析为工作区相对路径。 */
function resolveMarkdownWorkspaceAssetPath(markdownPath, assetSource) {
    const source = String(assetSource || '').trim();
    if (!source || source.startsWith('/') || source.startsWith('#')) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith('//')) return '';

    const pathOnly = source.split(/[?#]/, 1)[0];
    const basePath = getWorkspaceParentPath(markdownPath);
    return normalizeMarkdownWorkspacePath(basePath ? `${basePath}/${pathOnly}` : pathOnly);
}

/** 将 Markdown 中的远程或工作区相对图片链接转换为可预览地址。 */
function enhanceFilePreviewMarkdownImages(root, options = {}) {
    if (!root) return;
    const markdownPath = String(options.baseFilePath || '');
    const scope = options.scope || getActiveFiletreeScope();
    root.querySelectorAll('img[src]').forEach((img) => {
        const source = img.getAttribute('src') || '';
        const originalSrc = normalizeRemoteImageUrl(source);
        if (!originalSrc) {
            const assetPath = resolveMarkdownWorkspaceAssetPath(markdownPath, source);
            if (!assetPath) return;
            img.dataset.workspacePath = assetPath;
            img.decoding = 'async';
            img.loading = 'lazy';
            img.src = debugWorkspaceApi.rawUrl(assetPath, scope);
            return;
        }

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
    if (!currentPreviewFile && currentPreviewPath) {
        const rawUrl = isHtmlPreviewable(currentPreviewPath)
            ? debugWorkspaceApi.rawPathUrl(currentPreviewPath)
            : debugWorkspaceApi.rawUrl(currentPreviewPath);
        window.open(rawUrl, '_blank');
        return;
    }
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
    if (hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return;
    }
    persistActiveFilePreviewScroll();
    resetActivePreviewSurface();
    setFilePreviewWorkbenchVisible(false);
    saveFilePreviewState();
}

function getWorkspaceFileBaseName(filePath) {
    const i = filePath.lastIndexOf('/');
    return i >= 0 ? filePath.slice(i + 1) : filePath;
}

function getWorkspaceParentPath(filePath) {
    const value = String(filePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const i = value.lastIndexOf('/');
    return i >= 0 ? value.slice(0, i) : '';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('读取上传文件失败'));
        reader.readAsDataURL(file);
    });
}

function triggerWorkspaceDownload(path) {
    const normalizedPath = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedPath) return;
    const link = document.createElement('a');
    link.href = debugWorkspaceApi.downloadUrl(normalizedPath);
    link.download = getWorkspaceFileBaseName(normalizedPath);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

async function uploadWorkspaceFiles(files, targetDir = '') {
    const list = Array.from(files || []).filter(file => file && file.name);
    if (!list.length) return;
    const normalizedTargetDir = String(targetDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    showSystemMessage(`开始上传 ${list.length} 个文件到 ${normalizedTargetDir || '.workspace 根目录'}`);
    const uploaded = await uploadWorkspaceFilesToDirectory(list, normalizedTargetDir);
    if (normalizedTargetDir) expandedDirs.add(normalizedTargetDir);
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    showSystemMessage(`已上传 ${uploaded.length} 个文件到 ${normalizedTargetDir || '.workspace 根目录'}`);
    return uploaded;
}

async function uploadWorkspaceFilesToDirectory(files, targetDir = '', scope = getActiveFiletreeScope()) {
    const list = Array.from(files || []).filter(file => file && file.name);
    const normalizedTargetDir = String(targetDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const uploaded = [];
    for (const file of list) {
        const contentBase64 = await fileToBase64(file);
        const entry = await debugWorkspaceApi.uploadFile(normalizedTargetDir, file.name, contentBase64, true, scope);
        uploaded.push(entry);
    }
    return uploaded;
}

function openWorkspaceUploadPicker(targetDir = '') {
    if (!workspaceUploadInput) return;
    workspaceUploadTargetDir = String(targetDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    workspaceUploadInput.value = '';
    workspaceUploadInput.click();
}

function getWorkspaceDropTargetDir(event) {
    const node = event.target && event.target.closest ? event.target.closest('.ft-node') : null;
    if (!node || !filetreeContainer || !filetreeContainer.contains(node)) return '';
    const path = node.dataset.path || '';
    return node.dataset.type === 'directory' ? path : getWorkspaceParentPath(path);
}

function clearWorkspaceDropTarget() {
    filetreeContainer?.classList.remove('ft-drag-over');
    filetreeContainer?.querySelectorAll('.ft-drop-target').forEach(node => node.classList.remove('ft-drop-target'));
}

function hasDraggedFiles(event) {
    return Boolean(event?.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files'));
}

function clearMessageInputDropTarget() {
    messageInputPanel?.classList.remove('message-input-drag-over');
}

const MESSAGE_INPUT_TEMPORARY_DIR = '.tmp';
const MESSAGE_INPUT_DEFAULT_UPLOAD_DIR = 'uploads';
const LONG_PLAIN_TEXT_PASTE_THRESHOLD = 4000;
const MAGIC_CLIPBOARD_TYPES = new Set([
    'text/x-magic-message-rich-text',
    'text/x-magic-message-mentions',
]);
const IMAGE_UPLOAD_EXTENSIONS = new Set([
    'avif',
    'bmp',
    'gif',
    'heic',
    'heif',
    'ico',
    'jpeg',
    'jpg',
    'png',
    'svg',
    'tif',
    'tiff',
    'webp',
]);
let messageInputUploadQueue = Promise.resolve();

/** 判断聊天输入区上传的文件是否属于图片类型。 */
function isImageUploadFile(file) {
    const mimeType = String(file?.type || '').toLowerCase();
    if (mimeType.startsWith('image/')) return true;

    const fileName = String(file?.name || '');
    const extensionIndex = fileName.lastIndexOf('.');
    if (extensionIndex < 0) return false;
    return IMAGE_UPLOAD_EXTENSIONS.has(fileName.slice(extensionIndex + 1).toLowerCase());
}

/** 按正式前端规则判断剪贴板纯文本是否需要转换为临时 TXT 文件。 */
function shouldConvertPastedTextToAttachment(clipboardData) {
    if (!clipboardData || clipboardData.files?.length > 0) return false;

    const text = clipboardData.getData('text/plain');
    if (text.trim().length < LONG_PLAIN_TEXT_PASTE_THRESHOLD) return false;

    const types = Array.from(clipboardData.types || []);
    if (types.length === 0) return true;
    if (!types.includes('text/plain')) return false;
    if (types.some(type => MAGIC_CLIPBOARD_TYPES.has(type))) return false;

    const html = clipboardData.getData('text/html');
    return !html.includes('data-magic-clipboard');
}

/** 使用本地时间生成与正式前端一致的粘贴文本文件名。 */
function formatPastedTextTimestamp(date) {
    const padDatePart = value => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = padDatePart(date.getMonth() + 1);
    const day = padDatePart(date.getDate());
    const hour = padDatePart(date.getHours());
    const minute = padDatePart(date.getMinutes());
    const second = padDatePart(date.getSeconds());
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

/** 将长纯文本转换为可上传到临时目录的 UTF-8 TXT 文件。 */
function createPastedTextFile(text, now = new Date()) {
    return new File([text], `pasted-text-${formatPastedTextTimestamp(now)}.txt`, {
        type: 'text/plain;charset=utf-8',
        lastModified: now.getTime(),
    });
}

/** 根据显式目录或文件类型决定聊天输入区文件的上传目录。 */
function resolveMessageInputUploadTarget(file, forcedTargetDir = '') {
    if (forcedTargetDir) return forcedTargetDir;
    return isImageUploadFile(file) ? MESSAGE_INPUT_TEMPORARY_DIR : MESSAGE_INPUT_DEFAULT_UPLOAD_DIR;
}

/** 为聊天输入区文件生成不覆盖工作区现有文件的名称。 */
function createUniqueMessageInputFile(file, targetDir, reservedPaths) {
    const normalizedTargetDir = String(targetDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const originalName = file.name;
    const extensionIndex = originalName.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;
    const nameStem = hasExtension ? originalName.slice(0, extensionIndex) : originalName;
    const extension = hasExtension ? originalName.slice(extensionIndex) : '';
    let candidateName = originalName;
    let duplicateIndex = 1;

    const buildCandidatePath = name => normalizeMentionFilePath(
        normalizedTargetDir ? `${normalizedTargetDir}/${name}` : name,
    );
    while (reservedPaths.has(buildCandidatePath(candidateName))) {
        candidateName = `${nameStem} (${duplicateIndex})${extension}`;
        duplicateIndex += 1;
    }
    reservedPaths.add(buildCandidatePath(candidateName));

    if (candidateName === originalName) return file;
    return new File([file], candidateName, {
        type: file.type,
        lastModified: file.lastModified,
    });
}

/** 串行执行聊天附件上传，确保同名判断使用上一次上传后的最新文件索引。 */
function enqueueMessageInputUpload(files, options = {}) {
    const runUpload = () => uploadFilesFromMessageInput(files, options);
    const queuedUpload = messageInputUploadQueue.then(runUpload, runUpload);
    messageInputUploadQueue = queuedUpload.catch(() => undefined);
    return queuedUpload;
}

/** 上传聊天输入区文件，刷新工作区后在当前光标位置插入文件引用。 */
async function uploadFilesFromMessageInput(files, options = {}) {
    const list = Array.from(files || []).filter(file => file && file.name);
    if (!list.length) return;

    const forcedTargetDir = String(options.targetDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const reservedPaths = new Set(
        workspaceMentionIndex
            .filter(item => item.kind === 'file')
            .map(item => normalizeMentionFilePath(item.path)),
    );
    const uploadItems = list.map(file => {
        const targetDir = resolveMessageInputUploadTarget(file, forcedTargetDir);
        return {
            file: createUniqueMessageInputFile(file, targetDir, reservedPaths),
            targetDir,
        };
    });
    const targetDirectories = new Set(uploadItems.map(item => item.targetDir));
    const targetLabel = targetDirectories.size === 1
        ? Array.from(targetDirectories)[0]
        : '按文件类型对应的目录';
    showSystemMessage(`开始上传 ${list.length} 个文件到 ${targetLabel}`);

    const uploaded = [];
    for (const item of uploadItems) {
        const entries = await uploadWorkspaceFilesToDirectory([item.file], item.targetDir, 'workspace');
        uploaded.push(...entries);
        expandedDirs.add(item.targetDir);
    }

    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    const snippets = uploaded
        .map(entry => entry && entry.path ? `[@file_path:${normalizeMentionFilePath(entry.path)}]${MENTION_PROMPT_SEPARATOR}` : '')
        .filter(Boolean)
        .join('');
    if (snippets) {
        insertMentionAtCursor(snippets);
    }
    const temporaryFileCount = uploadItems.filter(item => item.targetDir === MESSAGE_INPUT_TEMPORARY_DIR).length;
    const temporaryHint = temporaryFileCount > 0 ? `，其中 ${temporaryFileCount} 个位于 .tmp` : '';
    showSystemMessage(`已上传 ${uploaded.length} 个文件${temporaryHint}，并插入文件引用`);
}

function isWorkspacePreviewPathAffected(targetPath, previewPath) {
    const target = String(targetPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const preview = String(previewPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!target || !preview) return false;
    return preview === target || preview.startsWith(`${target}/`);
}

/** 返回预览标签关联的工作区真实路径，用于删除和自动刷新判断。 */
function getFilePreviewResourcePath(tab) {
    if (!tab) return '';
    if (tab.type === 'canvas-project') return tab.directoryPath || tab.projectPath || '';
    if (tab.type === 'micro-app') return tab.appRootPath || '';
    if (tab.type === 'api-directory') return tab.entry?.path || tab.path || '';
    return tab.path || '';
}

async function deleteWorkspacePath(path, isDir) {
    const normalizedPath = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) return;
    if (hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return;
    }
    await debugWorkspaceApi.deletePath(normalizedPath, Boolean(isDir));
    for (const item of [...expandedDirs]) {
        if (item === normalizedPath || item.startsWith(`${normalizedPath}/`)) {
            expandedDirs.delete(item);
        }
    }
    for (const [tabPath, tab] of [...filePreviewTabs.entries()]) {
        if (isWorkspacePreviewPathAffected(normalizedPath, getFilePreviewResourcePath(tab))) {
            filePreviewTabs.delete(tabPath);
        }
    }
    const activePreviewResourcePath = getFilePreviewResourcePath(filePreviewTabs.get(activeFilePreviewPath));
    if (isWorkspacePreviewPathAffected(normalizedPath, activePreviewResourcePath || activeFilePreviewPath) || isWorkspacePreviewPathAffected(normalizedPath, currentPreviewPath)) {
        closeFilePreviewWorkbench();
    } else {
        renderFilePreviewTabs();
        saveFilePreviewState();
    }
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    showSystemMessage(`已删除 ${normalizedPath}`);
}

function confirmDeleteWorkspacePath(path, isDir) {
    const normalizedPath = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) return;
    const message = isDir
        ? `确定要删除目录 ${normalizedPath} 及其所有内容吗？`
        : `确定要删除文件 ${normalizedPath} 吗？`;
    showConfirmDialog(message, async () => {
        try {
            await deleteWorkspacePath(normalizedPath, isDir);
        } catch (error) {
            console.error('删除工作区路径失败', error);
            showSystemMessage(`删除失败：${error.message || error}`);
        }
    });
}

function createWorkspaceDeleteButton(path, isDir) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ft-node-action ft-node-delete';
    button.title = isDir ? '删除目录' : '删除文件';
    button.setAttribute('aria-label', button.title);
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M8 10v8.5A1.5 1.5 0 0 0 9.5 20h5a1.5 1.5 0 0 0 1.5-1.5V10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M11 11.5v5M13 11.5v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>';
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        confirmDeleteWorkspacePath(path, isDir);
    });
    return button;
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
    'micro-app': '微应用',
    directory: '文件夹',
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
    const tabs = [...filePreviewTabs.values()]
        .filter(tab => tab.type !== 'micro-app' && tab.type !== 'canvas-project')
        .map(tab => tab.path);
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
        btn.title = getFilePreviewResourcePath(tab) || tab.path;

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

function hasUnsavedFilePreviewEdits() {
    return filePreviewEditMode && filePreviewEditDirty;
}

function updateFilePreviewEditActions() {
    if (filePreviewEditMode) {
        if (filePreviewEditBtn) filePreviewEditBtn.style.display = 'none';
        if (filePreviewSaveBtn) filePreviewSaveBtn.style.display = '';
        if (filePreviewCancelBtn) filePreviewCancelBtn.style.display = '';
        return;
    }
    if (filePreviewEditBtn) filePreviewEditBtn.style.display = currentPreviewEditable ? '' : 'none';
    if (filePreviewSaveBtn) filePreviewSaveBtn.style.display = 'none';
    if (filePreviewCancelBtn) filePreviewCancelBtn.style.display = 'none';
}

function enterFilePreviewEditMode() {
    if (!currentPreviewEditable || !filePreviewBody || filePreviewEditMode) return;
    filePreviewEditMode = true;
    filePreviewEditDirty = false;
    filePreviewEditContent = currentPreviewCopyText;
    resetActivePreviewSurface({ preserveEditState: true });
    const editor = document.createElement('textarea');
    editor.className = 'file-preview-editor';
    editor.value = filePreviewEditContent;
    editor.setAttribute('aria-label', `编辑 ${currentPreviewPath}`);
    editor.spellcheck = false;
    editor.addEventListener('input', () => {
        filePreviewEditContent = editor.value;
        filePreviewEditDirty = editor.value !== currentPreviewCopyText;
        updateFilePreviewEditActions();
    });
    editor.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            saveFilePreviewEdits();
        }
    });
    filePreviewBody.appendChild(editor);
    updateFilePreviewEditActions();
    editor.focus();
}

async function saveFilePreviewEdits() {
    if (!filePreviewEditMode || !currentPreviewPath || !filePreviewEditDirty) return;
    const path = currentPreviewPath;
    const content = filePreviewEditContent;
    if (filePreviewSaveBtn) {
        filePreviewSaveBtn.disabled = true;
        filePreviewSaveBtn.textContent = '保存中...';
    }
    try {
        const result = await debugWorkspaceApi.writeFile(path, content);
        const tab = filePreviewTabs.get(path);
        if (tab?.entry && result) {
            tab.entry.size = result.size;
            tab.entry.updated_at = result.updated_at;
        }
        filePreviewEditMode = false;
        filePreviewEditDirty = false;
        await renderApiFilePreviewTab(tab || { type: 'api-file', path, entry: { path } });
        await renderFileTree();
        await refreshWorkspaceMentionIndex();
        showSystemMessage(`已保存 ${path}`);
    } catch (error) {
        console.error('保存文件失败', error);
        showSystemMessage(`保存失败：${error.message || error}`);
    } finally {
        if (filePreviewSaveBtn) {
            filePreviewSaveBtn.disabled = false;
            filePreviewSaveBtn.textContent = '保存';
        }
        updateFilePreviewEditActions();
    }
}

async function cancelFilePreviewEdits() {
    if (!filePreviewEditMode) return;
    const path = currentPreviewPath;
    const tab = filePreviewTabs.get(path);
    filePreviewEditMode = false;
    filePreviewEditDirty = false;
    await renderApiFilePreviewTab(tab || { type: 'api-file', path, entry: { path } });
}

function resetActivePreviewSurface(options = {}) {
    const preservedCopyText = currentPreviewCopyText;
    const preservedEditable = currentPreviewEditable;
    if (window.MicroAppRuntimeHost) {
        window.MicroAppRuntimeHost.dispose();
    }
    revokeFilePreviewObjectUrl();
    revokeCanvasBlobUrls();
    if (currentCanvasPreviewResizeObserver) {
        currentCanvasPreviewResizeObserver.disconnect();
        currentCanvasPreviewResizeObserver = null;
    }
    const canvasPanel = document.getElementById('canvasRightPanel');
    if (canvasPanel) canvasPanel.remove();
    const canvasModal = document.getElementById('canvasMediaModal');
    if (canvasModal) canvasModal.remove();
    filePreviewMain?.classList.remove('has-canvas-panel');
    if (filePreviewBody) {
        filePreviewBody.innerHTML = '';
        filePreviewBody.classList.remove(
            'file-preview-body-markdown',
            'file-preview-body-tool-detail',
            'file-preview-body-canvas-project',
            'file-preview-body-markdown-source',
        );
    }
    if (filePreviewMeta) filePreviewMeta.innerHTML = '';
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = '';
    if (filePreviewRenderBtn) filePreviewRenderBtn.style.display = 'none';
    if (filePreviewCanvasDataToggleBtn) filePreviewCanvasDataToggleBtn.style.display = 'none';
    currentCanvasProjectRawText = '';
    currentCanvasProjectDecompressedText = '';
    currentCanvasProjectViewMode = 'decompressed';
    updateMarkdownPreviewModeControls(false, 'rendered');
    currentPreviewCopyText = options.preserveEditState ? preservedCopyText : '';
    currentPreviewEditable = options.preserveEditState ? preservedEditable : false;
    if (!options.preserveEditState) {
        filePreviewEditMode = false;
        filePreviewEditDirty = false;
        filePreviewEditContent = '';
    }
    updateFilePreviewEditActions();
}

/** 更新 Markdown 渲染/原文模式按钮的显示状态。 */
function updateMarkdownPreviewModeControls(visible, mode = 'rendered') {
    if (!filePreviewMarkdownMode) return;
    filePreviewMarkdownMode.style.display = visible ? '' : 'none';
    filePreviewMarkdownMode.querySelectorAll('[data-markdown-mode]').forEach((button) => {
        const isActive = button.dataset.markdownMode === mode;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

/** 渲染 Markdown 文件的渲染结果或原始文本。 */
function renderMarkdownFileMode(text, mode = 'rendered', filePath = '') {
    if (!filePreviewBody) return;
    const normalizedMode = mode === 'source' ? 'source' : 'rendered';
    filePreviewBody.innerHTML = '';
    filePreviewBody.classList.toggle('file-preview-body-markdown', normalizedMode === 'rendered');
    filePreviewBody.classList.toggle('file-preview-body-markdown-source', normalizedMode === 'source');

    if (normalizedMode === 'rendered' && window.marked) {
        const article = document.createElement('article');
        article.className = 'file-preview-markdown ai-markdown';
        article.innerHTML = marked.parse(text);
        enhanceFilePreviewMarkdownImages(article, { baseFilePath: filePath });
        filePreviewBody.appendChild(article);
    } else {
        const pre = document.createElement('pre');
        pre.className = 'file-preview-content file-preview-markdown-source';
        pre.textContent = text;
        filePreviewBody.appendChild(pre);
    }
    updateMarkdownPreviewModeControls(Boolean(window.marked), normalizedMode);
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
    if (hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return false;
    }
    persistActiveFilePreviewScroll();
    resetActivePreviewSurface();
    filePreviewTabs.clear();
    activeFilePreviewPath = '';
    currentPreviewFile = null;
    currentPreviewPath = '';
    renderFilePreviewTabs();
    setFilePreviewWorkbenchVisible(false);
    localStorage.removeItem(FILE_PREVIEW_STATE_KEY);
    return true;
}

function clearFilePreviewTabs() {
    if (hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return;
    }
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
    if (filePath === activeFilePreviewPath && hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return;
    }
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
    if (targets.has(activeFilePreviewPath) && hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return;
    }
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
    if (filePath === activeFilePreviewPath && filePreviewEditMode) return;
    if (filePath !== activeFilePreviewPath && hasUnsavedFilePreviewEdits()) {
        showSystemMessage('当前文件有未保存的修改，请先保存或取消编辑');
        return;
    }
    persistActiveFilePreviewScroll();
    activeFilePreviewPath = filePath;
    setFilePreviewWorkbenchVisible(true);
    renderFilePreviewTabs();
    if (tab.type === 'tool-detail') {
        renderToolDetailPreviewTab(tab);
    } else if (tab.type === 'micro-app') {
        await renderMicroAppPreviewTab(tab);
    } else if (tab.type === 'canvas-project') {
        await renderApiCanvasProjectPreviewTab(tab);
    } else if (tab.type === 'api-directory') {
        await renderApiDirectoryPreviewTab(tab);
    } else if (tab.type === 'api-file') {
        await renderApiFilePreviewTab(tab);
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
let filetreeRefreshInFlight = false;
let currentFileTreeFingerprint = '';
let previewAutoRefreshTimer = null;
let previewAutoRefreshInFlight = false;
let previewAutoRefreshPending = false;
let selectBtnState = 'default'; // 'default' | 'active' | 'need-auth'
const expandedDirs = new Set();
const filetreeExpansionInitializedScopes = new Set();
let currentFileTreeEntries = [];

function sortFileTreeEntries(entries) {
    return [...(entries || [])].sort((a, b) => {
        const aDir = a.type === 'directory';
        const bDir = b.type === 'directory';
        if (aDir !== bDir) return aDir ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function collectDirectoryPaths(entries, output = []) {
    for (const entry of sortFileTreeEntries(entries)) {
        if (!entry || entry.type !== 'directory' || !entry.path) continue;
        output.push(entry.path);
        collectDirectoryPaths(entry.children || [], output);
    }
    return output;
}

function initializeDefaultExpandedDirectories(entries) {
    const scope = getActiveFiletreeScope();
    if (filetreeExpansionInitializedScopes.has(scope)) return;
    filetreeExpansionInitializedScopes.add(scope);
    expandedDirs.clear();
    collectDirectoryPaths(entries)
        .slice(0, DEFAULT_EXPANDED_DIRECTORY_LIMIT)
        .forEach(path => expandedDirs.add(path));
}

function expandAllFiletreeDirectories() {
    collectDirectoryPaths(currentFileTreeEntries).forEach(path => expandedDirs.add(path));
    renderFileTree();
}

function collapseAllFiletreeDirectories() {
    expandedDirs.clear();
    renderFileTree();
}

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

async function getWorkspaceDirectoryHandleByPath(dirPath) {
    if (!workspaceDirHandle) return null;
    const parts = String(dirPath || '').split('/').filter(Boolean);
    let dir = workspaceDirHandle;
    for (const part of parts) {
        try {
            dir = await dir.getDirectoryHandle(part, { create: false });
        } catch (e) {
            return null;
        }
    }
    return dir;
}

async function getFileHandleFromDirectory(dirHandle, relativePath) {
    if (!dirHandle || !relativePath) return null;
    const parts = String(relativePath).split('/').filter(Boolean);
    if (!parts.length || parts.includes('..')) return null;
    let dir = dirHandle;
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

function normalizeMicroAppEntry(entry) {
    const raw = String(entry || 'index.html').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = raw.split('/').filter(Boolean);
    if (!parts.length || parts.includes('..')) return 'index.html';
    return parts.join('/');
}

async function readApiMicroAppConfig(dirPath) {
    const configPath = dirPath ? `${dirPath}/app.json` : 'app.json';
    try {
        const data = await debugWorkspaceApi.readFile(configPath);
        const config = JSON.parse(data.content || '{}');
        if (!config || config.type !== 'micro-app') return null;
        return Object.assign({}, config, {
            entry: normalizeMicroAppEntry(config.entry),
        });
    } catch (e) {
        return null;
    }
}

function hasApiMicroAppConfigFile(entry) {
    if (!entry || entry.type !== 'directory' || !Array.isArray(entry.children)) return false;
    return entry.children.some(child => child && child.type === 'file' && child.name === 'app.json');
}

/** 判断 API 文件树目录是否包含画布项目入口文件。 */
function hasApiCanvasProjectFile(entry) {
    if (!entry || entry.type !== 'directory' || !Array.isArray(entry.children)) return false;
    return entry.children.some(child => child && child.type === 'file' && child.name === 'magic.project.js');
}

/** 为支持打开的特殊目录添加显式操作按钮。 */
function appendFileTreeOpenHints(node, options = {}) {
    if (!node) return;
    const actions = [];
    if (options.canvasProject && typeof options.openCanvas === 'function') {
        actions.push({ type: 'canvas', label: '打开画布', onClick: options.openCanvas });
    }
    if (options.microApp && typeof options.openMicroApp === 'function') {
        actions.push({ type: 'micro-app', label: '打开微应用', onClick: options.openMicroApp });
    }
    if (!actions.length) return;

    const hints = document.createElement('span');
    hints.className = 'ft-open-hints';
    for (const action of actions) {
        const hint = document.createElement('button');
        hint.type = 'button';
        hint.className = `ft-open-hint ft-open-hint-${action.type}`;
        hint.textContent = action.label;
        hint.title = `单击${action.label}`;
        hint.setAttribute('aria-label', hint.title);
        hint.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await action.onClick();
        });
        hints.appendChild(hint);
    }
    node.appendChild(hints);
}

/** 只读取顶层信封，避免文件树渲染时提前解压整个画布。 */
async function isApiCanvasDesignProject(entry, dirPath) {
    if (!hasApiCanvasProjectFile(entry)) return false;
    try {
        const projectPath = dirPath ? `${dirPath}/magic.project.js` : 'magic.project.js';
        const data = await debugWorkspaceApi.readFile(projectPath);
        const match = String(data.content || '').match(/window\.magicProjectConfig\s*=\s*(\{[\s\S]*\})/);
        if (!match) return false;
        return JSON.parse(match[1])?.type === 'design';
    } catch (_) {
        return false;
    }
}

/** 读取并校验目录下的 design 类型 magic.project.js。 */
async function readApiCanvasProjectConfig(dirPath) {
    const projectPath = dirPath ? `${dirPath}/magic.project.js` : 'magic.project.js';
    const data = await debugWorkspaceApi.readFile(projectPath);
    const config = await parseMagicProjectConfig(data.content || '');
    if (!config || config.type !== 'design' || !config.canvas) {
        throw new Error('目录中的 magic.project.js 不是 design 画布项目');
    }
    const readSidecar = async fileName => {
        const sidecarPath = dirPath ? `${dirPath}/${fileName}` : fileName;
        try {
            const sidecarData = await debugWorkspaceApi.readFile(sidecarPath);
            const parsed = JSON.parse(sidecarData.content || '{}');
            return parsed && typeof parsed === 'object' && parsed.elements
                && typeof parsed.elements === 'object'
                ? parsed
                : { elements: {} };
        } catch (_) {
            // sidecar 是可选文件；缺失或损坏时只展示主文件内容。
            return { elements: {} };
        }
    };
    const [agentDetails, userDetails] = await Promise.all([
        readSidecar('element-details.json'),
        readSidecar('element-details-user.json'),
    ]);
    hydrateApiCanvasElementDetails(config, agentDetails, userDetails);
    return { config, projectPath, data, agentDetails, userDetails };
}

/** 判断 sidecar 条目是否为前端用户覆盖。 */
function isApiCanvasUserDetail(detail) {
    return detail && typeof detail === 'object' && detail.source === 'user';
}

/** 选择当前 Content 的详情；用户明确标记的条目优先于后端 baseline。 */
function selectApiCanvasContentDetail(agentDetail, userDetail, userElement = null) {
    if (userDetail && (isApiCanvasUserDetail(userElement) || isApiCanvasUserDetail(userDetail))) {
        return userDetail;
    }
    return agentDetail || userDetail || null;
}

/** 返回与前端 elementDetailsStore 一致的可回填重字段。 */
function getApiCanvasHeavyFields(elementType) {
    const requestFields = ['generateImageRequest', 'generateVideoRequest'];
    return ['image', 'video'].includes(elementType)
        ? [...requestFields, 'visualUnderstanding']
        : requestFields;
}

/** 只提取前端允许从公共 Sidecar 回填的字段。 */
function pickApiCanvasHeavyFields(detail, elementType) {
    if (!detail || typeof detail !== 'object') return null;
    const fields = {};
    getApiCanvasHeavyFields(elementType).forEach(field => {
        if (detail[field] !== undefined && detail[field] !== null) fields[field] = detail[field];
    });
    return Object.keys(fields).length ? fields : null;
}

/** 将画布 sidecar 中的元素级或 Content 级详情回填到预览数据。 */
function hydrateApiCanvasElementDetails(config, agentDoc, userDoc) {
    const agentElements = agentDoc?.elements && typeof agentDoc.elements === 'object'
        ? agentDoc.elements
        : {};
    const userElements = userDoc?.elements && typeof userDoc.elements === 'object'
        ? userDoc.elements
        : {};

    const visit = elements => {
        for (const element of Array.isArray(elements) ? elements : []) {
            if (!element || typeof element !== 'object') continue;
            const agentElement = agentElements[element.id];
            const userElement = userElements[element.id];
            const agentContentDetails = agentElement?.contentDetails;
            const userContentDetails = userElement?.contentDetails;

            if (Array.isArray(element.contents) && element.contents.length) {
                const firstContent = element.contents[0];
                const legacyDetail = selectApiCanvasContentDetail(agentElement, userElement, userElement);
                const legacyFields = pickApiCanvasHeavyFields(legacyDetail, element.type);
                if (legacyFields && firstContent && typeof firstContent === 'object') {
                    Object.entries(legacyFields).forEach(([field, value]) => {
                        if (firstContent[field] === undefined) firstContent[field] = value;
                    });
                }
                element.contents = element.contents.map(content => {
                    const contentId = content?.contentId;
                    const agentDetail = contentId && agentContentDetails?.[contentId];
                    const userDetail = contentId && userContentDetails?.[contentId];
                    const detail = selectApiCanvasContentDetail(agentDetail, userDetail, userElement);
                    const heavyFields = pickApiCanvasHeavyFields(detail, element.type);
                    return heavyFields
                        ? { ...content, ...heavyFields }
                        : content;
                });
            }

            if (Array.isArray(element.children)) visit(element.children);
        }
    };
    visit(config?.canvas?.elements);
}

/** 打开只读画布项目预览标签页。 */
async function openApiCanvasProjectPreviewTab(dirPath, entry = null) {
    try {
        const { config, projectPath, data } = await readApiCanvasProjectConfig(dirPath);
        const normalizedDirPath = String(dirPath || '').replace(/\/+$/, '');
        const tabPath = `@canvas:${normalizedDirPath || '/'}`;
        filePreviewTabs.set(tabPath, {
            type: 'canvas-project',
            path: tabPath,
            directoryPath: normalizedDirPath,
            title: `画布：${config.name || getWorkspaceFileBaseName(dirPath) || '画布项目'}`,
            projectPath,
            projectConfig: config,
            projectEntry: entry,
            projectSize: data.size || 0,
        });
        await activateFilePreviewTab(tabPath, { resetScroll: true });
    } catch (error) {
        console.error('打开画布项目预览失败', error);
        showSystemMessage(`打开画布项目失败：${error.message || error}`);
    }
}

/** 创建只读画布的缩放工具栏，并暴露控制器绑定入口。 */
function createCanvasPreviewZoomToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'canvas-preview-zoom-toolbar';

    const zoomOutButton = document.createElement('button');
    zoomOutButton.type = 'button';
    zoomOutButton.className = 'canvas-preview-zoom-button';
    zoomOutButton.textContent = '−';
    zoomOutButton.title = '缩小画布';

    const scaleLabel = document.createElement('span');
    scaleLabel.className = 'canvas-preview-zoom-label';
    scaleLabel.textContent = '100%';

    const zoomInButton = document.createElement('button');
    zoomInButton.type = 'button';
    zoomInButton.className = 'canvas-preview-zoom-button';
    zoomInButton.textContent = '+';
    zoomInButton.title = '放大画布';

    const actualSizeButton = document.createElement('button');
    actualSizeButton.type = 'button';
    actualSizeButton.className = 'canvas-preview-zoom-text-button';
    actualSizeButton.textContent = '100%';
    actualSizeButton.title = '按真实尺寸展示';

    const fitAllButton = document.createElement('button');
    fitAllButton.type = 'button';
    fitAllButton.className = 'canvas-preview-zoom-text-button';
    fitAllButton.textContent = '显示全部';
    fitAllButton.title = '缩放并居中展示全部元素';

    const resetViewButton = document.createElement('button');
    resetViewButton.type = 'button';
    resetViewButton.className = 'canvas-preview-zoom-text-button';
    resetViewButton.textContent = '复位';
    resetViewButton.title = '清除画布移动并恢复居中显示全部元素';

    toolbar.append(
        zoomOutButton,
        scaleLabel,
        zoomInButton,
        actualSizeButton,
        fitAllButton,
        resetViewButton,
    );
    return {
        element: toolbar,
        /** 绑定画布缩放控制器，工具栏只改变视图而不修改项目数据。 */
        bind(controller) {
            zoomOutButton.addEventListener('click', controller.zoomOut);
            zoomInButton.addEventListener('click', controller.zoomIn);
            actualSizeButton.addEventListener('click', controller.resetToActualSize);
            fitAllButton.addEventListener('click', controller.fitAll);
            resetViewButton.addEventListener('click', controller.resetView);
        },
        /** 同步当前缩放比例文本。 */
        updateScale(scale) {
            scaleLabel.textContent = `${Math.round(scale * 100)}%`;
        },
    };
}

/** 渲染只读画布项目页面，不提供编辑、拖拽或选择逻辑。 */
async function renderApiCanvasProjectPreviewTab(tab) {
    if (!filePreviewBody || !filePreviewWorkbench) return;
    resetActivePreviewSurface();
    currentPreviewFile = null;
    currentPreviewPath = tab.projectPath || tab.directoryPath || tab.path;
    currentPreviewCopyText = '';
    currentPreviewEditable = false;
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = 'none';
    renderFilePreviewMetaRows(filePreviewMeta, [
        { label: '文件名', value: tab.title || '画布项目' },
        { label: '路径', value: tab.directoryPath || tab.projectPath || '—' },
        { label: '预览类型', value: '只读画布' },
        { label: '版本', value: tab.projectConfig?.version || '—' },
        { label: '元素数', value: String(tab.projectConfig?.canvas?.elements?.length || 0) },
        { label: '连接数', value: String(tab.projectConfig?.canvas?.connections?.length || 0) },
    ]);

    filePreviewBody.classList.add('file-preview-body-canvas-project');
    const shell = document.createElement('div');
    shell.className = 'canvas-project-shell';
    const viewport = document.createElement('div');
    viewport.className = 'canvas-project-viewport';
    const zoomToolbar = createCanvasPreviewZoomToolbar();
    shell.append(viewport, zoomToolbar.element);
    filePreviewBody.appendChild(shell);
    const projectDirPath = tab.directoryPath || String(tab.projectPath || '').split('/').filter(Boolean).slice(0, -1).join('/');
    const resolveMediaUrl = async relPath => appendPreviewRefreshToken(
        debugWorkspaceApi.rawUrl(joinWorkspacePath(projectDirPath, relPath)),
    );
    const zoomController = await renderCanvasView(
        normalizeMagicProjectForPreview(tab.projectConfig),
        resolveMediaUrl,
        viewport,
        {
            showLabels: false,
            preserveCanvasOrigin: false,
            fitMode: 'contain',
            onScaleChange: scale => zoomToolbar.updateScale(scale),
        },
    );
    if (zoomController) zoomToolbar.bind(zoomController);
    setFilePreviewWorkbenchVisible(true);
}

async function openApiMicroAppPreviewTab(dirPath, appConfig) {
    const entryPath = normalizeMicroAppEntry(appConfig && appConfig.entry);
    const workspaceEntryPath = dirPath ? `${dirPath}/${entryPath}` : entryPath;
    try {
        await debugWorkspaceApi.readFile(workspaceEntryPath);
    } catch (e) {
        showSystemMessage(`微应用入口不存在: ${workspaceEntryPath}`);
        return;
    }
    const tabPath = `@micro-app:${dirPath || '/'}`;
    filePreviewTabs.set(tabPath, {
        type: 'micro-app',
        path: tabPath,
        title: `微应用：${appConfig.name || getWorkspaceFileBaseName(dirPath) || '微应用'}`,
        appRootHandle: null,
        appRootPath: dirPath,
        appConfig,
        entryPath,
        entryHandle: null,
        workspaceApi: debugWorkspaceApi,
    });
    await activateFilePreviewTab(tabPath, { resetScroll: true });
}

async function readMicroAppConfig(dirHandle) {
    if (!dirHandle) return null;
    try {
        const configHandle = await dirHandle.getFileHandle('app.json', { create: false });
        const text = await (await configHandle.getFile()).text();
        const config = JSON.parse(text);
        if (!config || config.type !== 'micro-app') return null;
        return Object.assign({}, config, {
            entry: normalizeMicroAppEntry(config.entry),
        });
    } catch (e) {
        return null;
    }
}

async function openMicroAppPreviewTab(dirHandle, dirPath, appConfig) {
    const entryPath = normalizeMicroAppEntry(appConfig && appConfig.entry);
    const entryHandle = await getFileHandleFromDirectory(dirHandle, entryPath);
    if (!entryHandle) {
        showSystemMessage(`微应用入口不存在: ${dirPath}/${entryPath}`);
        return;
    }
    const tabPath = `@micro-app:${dirPath || '/'}`;
    filePreviewTabs.set(tabPath, {
        type: 'micro-app',
        path: tabPath,
        title: `微应用：${appConfig.name || getWorkspaceFileBaseName(dirPath) || '微应用'}`,
        appRootHandle: dirHandle,
        appRootPath: dirPath,
        appConfig,
        entryPath,
        entryHandle,
    });
    await activateFilePreviewTab(tabPath, { resetScroll: true });
}

async function renderMicroAppPreviewTab(tab) {
    if (!filePreviewBody || !window.MicroAppRuntimeHost) return;
    resetActivePreviewSurface();
    currentPreviewFile = null;
    currentPreviewPath = tab.appRootPath || tab.path;
    currentPreviewCopyText = '';
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = 'none';
    if (filePreviewRenderBtn) filePreviewRenderBtn.style.display = 'none';
    renderFilePreviewMetaRows(filePreviewMeta, [
        { label: '文件名', value: tab.title || '微应用' },
        { label: '路径', value: tab.appRootPath || tab.path },
        { label: '预览类型', value: PREVIEW_KIND_LABEL['micro-app'] },
        { label: '入口', value: tab.entryPath || 'index.html' },
        { label: '运行时', value: 'http_client local-adapter' },
    ]);
    await window.MicroAppRuntimeHost.render({
        container: filePreviewBody,
        appRootHandle: tab.appRootHandle,
        appRootPath: tab.appRootPath,
        entryPath: tab.entryPath,
        entryHandle: tab.entryHandle,
        appConfig: tab.appConfig,
        workspaceApi: tab.workspaceApi || debugWorkspaceApi,
        serverUrlProvider: () => (serverUrlInput.value.trim() || 'http://127.0.0.1:8002'),
        refreshFileTree: async () => {
            await renderFileTree();
            await refreshWorkspaceMentionIndex();
        },
        sendAgentMessage: sendMicroAppAgentMessage,
        fillMessageDraft: fillMicroAppMessageDraft,
        setInputMessage: setMicroAppInputMessage,
        uploadWorkspaceFiles: uploadMicroAppWorkspaceFiles,
        addFilesToMessage: addMicroAppFilesToMessage,
        downloadWorkspaceFiles: downloadMicroAppWorkspaceFiles,
    });
    setFilePreviewWorkbenchVisible(true);
}

function buildMicroAppPrompt(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (typeof payload.prompt === 'string') return payload.prompt;
    if (typeof payload.message === 'string') return payload.message;
    if (typeof payload.content === 'string') return payload.content;
    if (payload.content && typeof payload.content === 'object') {
        return JSON.stringify(payload.content, null, 2);
    }
    if (typeof payload.text === 'string') return payload.text;
    return '';
}

function appendMicroAppPathMentions(prompt, payload) {
    const parts = [prompt || ''];
    const paths = [];
    if (typeof payload.skillPath === 'string' && payload.skillPath.trim()) {
        paths.push(payload.skillPath.trim());
    }
    if (Array.isArray(payload.files)) {
        for (const item of payload.files) {
            if (typeof item === 'string' && item.trim()) paths.push(item.trim());
            else if (item && typeof item.path === 'string' && item.path.trim()) paths.push(item.path.trim());
        }
    }
    for (const path of paths) {
        parts.push(`[@file_path:${normalizeMentionFilePath(path)}]${MENTION_PROMPT_SEPARATOR}`);
    }
    return parts.join(parts[0] ? '\n' : '').trim();
}

async function sendMicroAppAgentMessage(payload) {
    const prompt = appendMicroAppPathMentions(buildMicroAppPrompt(payload), payload || {});
    if (!prompt) {
        throw new Error('createTopicAndSend requires prompt, message, content, or text');
    }
    try {
        await ensureWebSocketConnected();
    } catch (e) {
        showSystemMessage('微应用消息发送失败：无法连接到服务器，请确认服务已启动');
        throw e;
    }
    const message = createChatMessage(prompt);
    if (payload && typeof payload.agentMode === 'string' && payload.agentMode.trim()) {
        message.agent_mode = payload.agentMode.trim();
    }
    const modelId = payload && (payload.modelId || payload.model || payload.model_id);
    if (typeof modelId === 'string' && modelId.trim()) {
        message.model_id = modelId.trim();
    }
    if (payload && payload.dynamic_config && typeof payload.dynamic_config === 'object') {
        message.dynamic_config = Object.assign({}, message.dynamic_config || {}, payload.dynamic_config);
    }
    showClientMessage(message);
    showAssistantActivity('thinking');
    const responseData = await sendHttpMessage(message);
    if (!responseData || responseData.code !== 1000) {
        hideAssistantActivity();
    }
    return {
        messageId: message.message_id,
        response: responseData,
    };
}

async function fillMicroAppMessageDraft(payload) {
    const prompt = appendMicroAppPathMentions(buildMicroAppPrompt(payload), payload || {});
    if (!prompt) {
        throw new Error('draftMessage requires prompt, message, content, or text');
    }
    if (!messageInput) {
        throw new Error('Message input is not available');
    }
    messageInput.value = prompt;
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    messageInput.focus();
    showSystemMessage('微应用消息已填入聊天框，确认后可手动发送');
    return {
        drafted: true,
        length: prompt.length,
    };
}

async function setMicroAppInputMessage(message) {
    if (!messageInput) {
        throw new Error('Message input is not available');
    }
    const text = String(message == null ? '' : message);
    messageInput.value = text;
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    messageInput.focus();
    showSystemMessage('微应用消息已填入聊天框，确认后可手动发送');
    return {
        drafted: true,
        length: text.length,
    };
}

async function uploadMicroAppWorkspaceFiles(files) {
    const list = Array.from(files || []).filter(item => item && item.file instanceof File);
    if (!list.length) {
        throw new Error('uploadFiles: files array cannot be empty');
    }
    const uploaded = [];
    for (const item of list) {
        const rawPath = normalizeMentionFilePath(item.path || item.filename || item.file.name);
        const targetPath = rawPath || item.file.name;
        const targetDir = getWorkspaceParentPath(targetPath);
        const filename = getWorkspaceFileBaseName(targetPath) || item.filename || item.file.name;
        const contentBase64 = await fileToBase64(item.file);
        uploaded.push(await debugWorkspaceApi.uploadFile(targetDir, filename, contentBase64, true, 'workspace'));
        if (targetDir) expandedDirs.add(targetDir);
    }
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    showSystemMessage(`微应用已上传 ${uploaded.length} 个文件`);
    return uploaded;
}

async function addMicroAppFilesToMessage(filePaths, agentMode) {
    const paths = Array.from(filePaths || []).filter(path => typeof path === 'string' && path.trim());
    if (!paths.length) {
        throw new Error('addFilesToMessage: filePaths array cannot be empty');
    }
    const snippets = paths
        .map(path => `[@file_path:${normalizeMentionFilePath(path)}]${MENTION_PROMPT_SEPARATOR}`)
        .join('');
    insertMentionAtCursor(snippets);
    return {
        foundCount: paths.length,
        notFoundPaths: [],
        agentMode: typeof agentMode === 'string' ? agentMode : undefined,
    };
}

async function downloadMicroAppWorkspaceFiles(filePaths) {
    const paths = Array.from(filePaths || []).filter(path => typeof path === 'string' && path.trim());
    if (!paths.length) {
        throw new Error('downloadFiles: filePaths array cannot be empty');
    }
    paths.forEach(path => triggerWorkspaceDownload(path));
    showSystemMessage(`微应用已触发 ${paths.length} 个文件下载`);
    return {
        downloadedCount: paths.length,
    };
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
            try {
                if (filePath.endsWith('/')) {
                    const directoryPath = filePath.replace(/\/+$/, '');
                    const data = await debugWorkspaceApi.listTree(directoryPath, 1);
                    filePreviewTabs.set(filePath, {
                        type: 'api-directory',
                        path: filePath,
                        title: getWorkspaceFileBaseName(directoryPath),
                        entry: {
                            name: getWorkspaceFileBaseName(directoryPath),
                            path: directoryPath,
                            type: 'directory',
                            size: 0,
                            updated_at: null,
                            children: data.entries || [],
                        },
                    });
                    restoredPaths.push(filePath);
                    continue;
                }
                const data = await debugWorkspaceApi.readFile(filePath);
                filePreviewTabs.set(filePath, {
                    type: 'api-file',
                    path: filePath,
                    title: getWorkspaceFileBaseName(filePath),
                    entry: {
                        name: getWorkspaceFileBaseName(filePath),
                        path: filePath,
                        type: 'file',
                        size: data.size || 0,
                        updated_at: data.updated_at || null,
                    },
                });
                restoredPaths.push(filePath);
            } catch (e) {
                // 文件不存在或不是文本文件时不恢复该标签页。
            }
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
            } else if (activeTab.type === 'api-directory') {
                await renderApiDirectoryPreviewTab(activeTab);
            } else if (activeTab.type === 'api-file') {
                await renderApiFilePreviewTab(activeTab);
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
        selectWorkspaceBtn.title = '刷新 .workspace 文件树';
    } else if (state === 'need-auth') {
        selectWorkspaceBtn.title = '重新加载 .workspace 文件树';
    } else {
        selectWorkspaceBtn.title = '加载 .workspace 文件树';
    }
}

async function switchFiletreeScope(scope) {
    const normalizedScope = scope === 'memory' ? 'memory' : 'workspace';
    if (normalizedScope === getActiveFiletreeScope()) return;
    if (!closeFilePreviewWorkbench()) return;
    activeFiletreeScope = normalizedScope;
    localStorage.setItem(FILETREE_SCOPE_KEY, activeFiletreeScope);
    expandedDirs.clear();
    filetreeExpansionInitializedScopes.delete(activeFiletreeScope);
    currentFileTreeEntries = [];
    currentFileTreeFingerprint = '';
    updateFiletreeScopeUi();
    if (filetreeContainer) {
        filetreeContainer.innerHTML = `<div class="filetree-empty">正在加载${getActiveFiletreeScopeConfig().title}</div>`;
    }
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
}

updateFiletreeScopeUi();

filetreeScopeTabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
        try {
            await switchFiletreeScope(tab.dataset.fileScope);
        } catch (error) {
            console.error('切换文件根目录失败', error);
            showSystemMessage(`切换失败：${error.message || error}`);
        }
    });
});

// 激活文件树（已有 handle）
async function activateFiletree(handle, options = {}) {
    rootDirHandle = handle;
    workspaceDirHandle = handle;
    await saveHandle(handle);
    updateSelectBtn('active');
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    startFiletreeAutoRefresh();
    if (options.restorePreviewState) {
        await restorePersistedFilePreviewState();
    }
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
    showWorkspacePermissionHint('点击此处或刷新按钮，重新加载 .workspace 文件树');
    if (options.showMessage) {
        showSystemMessage('工作区文件读取权限需要点击确认后恢复');
    }
    return false;
}

// 页面加载时尝试恢复上次的目录
(async () => {
    updateSelectBtn('active');
    await renderFileTree();
    await refreshWorkspaceMentionIndex();
    await restorePersistedFilePreviewState();
    startFiletreeAutoRefresh();
})();

// 点击选择/切换目录按钮
if (selectWorkspaceBtn) {
    selectWorkspaceBtn.addEventListener('click', async () => {
        try {
            await renderFileTree();
            await refreshWorkspaceMentionIndex();
            updateSelectBtn('active');
        } catch (e) {
            console.error('刷新工作区文件树失败', e);
        }
    });
}

if (filetreeContainer) {
    filetreeContainer.addEventListener('click', async () => {
        if (selectBtnState !== 'need-auth') return;
        await renderFileTree();
        await refreshWorkspaceMentionIndex();
    });
    filetreeContainer.addEventListener('dragover', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        clearWorkspaceDropTarget();
        filetreeContainer.classList.add('ft-drag-over');
        const targetNode = e.target.closest ? e.target.closest('.ft-node.ft-dir') : null;
        if (targetNode && filetreeContainer.contains(targetNode)) {
            targetNode.classList.add('ft-drop-target');
        }
    });
    filetreeContainer.addEventListener('dragleave', (e) => {
        if (!filetreeContainer.contains(e.relatedTarget)) {
            clearWorkspaceDropTarget();
        }
    });
    filetreeContainer.addEventListener('drop', async (e) => {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        const targetDir = getWorkspaceDropTargetDir(e);
        clearWorkspaceDropTarget();
        try {
            await uploadWorkspaceFiles(e.dataTransfer.files, targetDir);
        } catch (error) {
            console.error('拖拽上传工作区文件失败', error);
            showSystemMessage(`上传失败：${error.message || error}`);
        }
    });
}

// 手动刷新
if (refreshTreeBtn) {
    refreshTreeBtn.addEventListener('click', async () => {
        await renderFileTree();
        await refreshWorkspaceMentionIndex();
    });
}

if (expandAllTreeBtn) {
    expandAllTreeBtn.addEventListener('click', expandAllFiletreeDirectories);
}

if (collapseAllTreeBtn) {
    collapseAllTreeBtn.addEventListener('click', collapseAllFiletreeDirectories);
}

if (uploadWorkspaceBtn) {
    uploadWorkspaceBtn.addEventListener('click', () => openWorkspaceUploadPicker(''));
}

if (workspaceUploadInput) {
    workspaceUploadInput.addEventListener('change', async () => {
        try {
            await uploadWorkspaceFiles(workspaceUploadInput.files, workspaceUploadTargetDir);
        } catch (error) {
            console.error('上传工作区文件失败', error);
            showSystemMessage(`上传失败：${error.message || error}`);
        } finally {
            workspaceUploadInput.value = '';
            workspaceUploadTargetDir = '';
        }
    });
}

if (messageInputPanel) {
    messageInputPanel.addEventListener('dragover', (e) => {
        if (!hasDraggedFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        messageInputPanel.classList.add('message-input-drag-over');
    });
    messageInputPanel.addEventListener('dragleave', (e) => {
        if (!messageInputPanel.contains(e.relatedTarget)) {
            clearMessageInputDropTarget();
        }
    });
    messageInputPanel.addEventListener('drop', async (e) => {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        const droppedFiles = Array.from(e.dataTransfer.files);
        e.preventDefault();
        clearMessageInputDropTarget();
        try {
            await enqueueMessageInputUpload(droppedFiles);
        } catch (error) {
            console.error('聊天输入区拖拽上传失败', error);
            showSystemMessage(`上传失败：${error.message || error}`);
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

if (filePreviewEditBtn) {
    filePreviewEditBtn.addEventListener('click', enterFilePreviewEditMode);
}

if (filePreviewSaveBtn) {
    filePreviewSaveBtn.addEventListener('click', saveFilePreviewEdits);
}

if (filePreviewCancelBtn) {
    filePreviewCancelBtn.addEventListener('click', cancelFilePreviewEdits);
}

if (filePreviewMarkdownMode) {
    filePreviewMarkdownMode.addEventListener('click', (event) => {
        const button = event.target.closest('[data-markdown-mode]');
        if (!button || !activeFilePreviewPath || !currentPreviewPath) return;
        const mode = button.dataset.markdownMode === 'source' ? 'source' : 'rendered';
        const tab = filePreviewTabs.get(activeFilePreviewPath);
        if (!tab || !isMarkdownPreviewFile(currentPreviewPath) || currentPreviewCopyText == null) return;
        tab.markdownMode = mode;
        renderMarkdownFileMode(currentPreviewCopyText, mode, currentPreviewPath);
    });
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

if (filePreviewCanvasDataToggleBtn) {
    filePreviewCanvasDataToggleBtn.addEventListener('click', toggleMagicProjectDataView);
}

/** 为媒体和 iframe 预览 URL 增加刷新标识，避免浏览器继续使用旧缓存。 */
function appendPreviewRefreshToken(url) {
    const value = String(url || '');
    if (!value) return value;
    return `${value}${value.includes('?') ? '&' : '?'}preview_refresh=${Date.now()}`;
}

/** 为文件树生成稳定指纹，用于识别新增、修改、删除和重命名。 */
function buildFileTreeFingerprint(entries) {
    const records = [];
    const collect = items => {
        for (const entry of Array.isArray(items) ? items : []) {
            records.push([
                entry?.path || entry?.name || '',
                entry?.type || '',
                Number(entry?.size) || 0,
                entry?.updated_at || '',
            ].join('|'));
            if (entry?.type === 'directory') collect(entry.children);
        }
    };
    collect(entries);
    return records.sort().join('\n');
}

/** 按路径递归查找最新文件树节点。 */
function findFileTreeEntryByPath(entries, targetPath) {
    const normalizedTarget = String(targetPath || '').replace(/^\/+|\/+$/g, '');
    for (const entry of Array.isArray(entries) ? entries : []) {
        const normalizedEntry = String(entry?.path || '').replace(/^\/+|\/+$/g, '');
        if (normalizedEntry === normalizedTarget) return entry;
        if (entry?.type === 'directory') {
            const nested = findFileTreeEntryByPath(entry.children, normalizedTarget);
            if (nested) return nested;
        }
    }
    return null;
}

/** 展示当前预览目标已被删除或移动的只读状态。 */
function renderMissingActiveFilePreview(tab) {
    resetActivePreviewSurface();
    currentPreviewFile = null;
    currentPreviewPath = getFilePreviewResourcePath(tab);
    currentPreviewCopyText = '';
    currentPreviewEditable = false;
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = 'none';
    renderFilePreviewMetaRows(filePreviewMeta, [
        { label: '文件名', value: tab?.title || getWorkspaceFileBaseName(currentPreviewPath) || '未知文件' },
        { label: '路径', value: currentPreviewPath || '—' },
        { label: '状态', value: '文件已删除或移动' },
    ]);
    appendPreviewMessage(filePreviewBody, '当前预览目标已被删除或移动。');
    setFilePreviewWorkbenchVisible(true);
}

/** 根据最新文件状态重新加载当前预览标签，不改变标签页集合。 */
async function refreshActiveFilePreview() {
    if (previewAutoRefreshInFlight) {
        previewAutoRefreshPending = true;
        return;
    }
    if (!filePreviewWorkbench || filePreviewWorkbench.hidden || filePreviewEditMode) return;
    const previewPath = activeFilePreviewPath;
    const tab = filePreviewTabs.get(previewPath);
    if (!tab || tab.type === 'tool-detail' || hasUnsavedFilePreviewEdits()) return;

    previewAutoRefreshInFlight = true;
    persistActiveFilePreviewScroll();
    try {
        if (tab.type === 'canvas-project') {
            const latestProjectEntry = findFileTreeEntryByPath(currentFileTreeEntries, tab.directoryPath);
            if (!latestProjectEntry) {
                renderMissingActiveFilePreview(tab);
                return;
            }
            const dirPath = tab.directoryPath || getWorkspaceParentPath(tab.projectPath);
            const latest = await readApiCanvasProjectConfig(dirPath);
            if (activeFilePreviewPath !== previewPath) return;
            Object.assign(tab, {
                projectPath: latest.projectPath,
                projectConfig: latest.config,
                projectSize: latest.data.size || 0,
                title: latest.config.name || tab.title,
            });
            await renderApiCanvasProjectPreviewTab(tab);
        } else if (tab.type === 'micro-app') {
            const latestConfig = tab.workspaceApi
                ? await readApiMicroAppConfig(tab.appRootPath)
                : await readMicroAppConfig(tab.appRootHandle);
            if (activeFilePreviewPath !== previewPath) return;
            if (latestConfig) tab.appConfig = latestConfig;
            await renderMicroAppPreviewTab(tab);
        } else if (tab.type === 'api-file') {
            const latestEntry = findFileTreeEntryByPath(currentFileTreeEntries, tab.path);
            if (!latestEntry) {
                renderMissingActiveFilePreview(tab);
                return;
            }
            if (activeFilePreviewPath !== previewPath) return;
            tab.entry = latestEntry;
            await renderApiFilePreviewTab(tab);
        } else if (tab.handle) {
            if (activeFilePreviewPath !== previewPath) return;
            await previewFile(tab.handle, tab.path);
        }
        restoreFilePreviewScroll(previewPath);
    } catch (error) {
        console.warn('自动刷新当前文件预览失败', error);
    } finally {
        previewAutoRefreshInFlight = false;
        if (previewAutoRefreshPending) {
            previewAutoRefreshPending = false;
            scheduleActiveFilePreviewRefresh();
        }
    }
}

/** 防抖触发当前预览刷新，把一次批量写文件合并为一次重渲染。 */
function scheduleActiveFilePreviewRefresh() {
    if (previewAutoRefreshTimer) clearTimeout(previewAutoRefreshTimer);
    previewAutoRefreshTimer = setTimeout(() => {
        previewAutoRefreshTimer = null;
        void refreshActiveFilePreview();
    }, 250);
}

// 自动刷新文件树，并在检测到任意文件变化时重载当前预览。
function startFiletreeAutoRefresh() {
    if (filetreeRefreshTimer) clearInterval(filetreeRefreshTimer);
    filetreeRefreshTimer = setInterval(async () => {
        if (filetreeRefreshInFlight) return;
        filetreeRefreshInFlight = true;
        try {
            await renderFileTree();
        } finally {
            filetreeRefreshInFlight = false;
        }
    }, 3000);
}

async function openApiFilePreviewTab(entry) {
    if (!entry || !entry.path) return;
    filePreviewTabs.set(entry.path, {
        type: 'api-file',
        path: entry.path,
        title: `目录：${entry.name || getWorkspaceFileBaseName(entry.path)}`,
        entry,
    });
    await activateFilePreviewTab(entry.path, { resetScroll: true });
}

/** 将目录路径转换为不会与同名文件冲突的标签页路径。 */
function buildApiDirectoryPreviewTabPath(directoryPath) {
    const normalizedPath = String(directoryPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return normalizedPath ? `${normalizedPath}/` : '/';
}

/** 打开 API 文件树目录预览标签页。 */
async function openApiDirectoryPreviewTab(entry) {
    if (!entry || !entry.path) return;
    const tabPath = buildApiDirectoryPreviewTabPath(entry.path);
    filePreviewTabs.set(tabPath, {
        type: 'api-directory',
        path: tabPath,
        title: entry.name || getWorkspaceFileBaseName(entry.path),
        entry,
    });
    await activateFilePreviewTab(tabPath, { resetScroll: true });
}

/** 根据文件类型生成目录预览卡片使用的图标类型。 */
function getDirectoryPreviewIconType(entry) {
    if (entry?.type === 'directory') return 'folderClosed';
    return getFileIconType(entry?.name || entry?.path || '');
}

/** 创建目录预览卡片的图标或图片缩略图。 */
function createDirectoryPreviewVisual(entry) {
    const visual = document.createElement('span');
    const iconType = getDirectoryPreviewIconType(entry);
    visual.className = `file-preview-directory-visual is-${iconType}`;

    if (entry?.type === 'file' && iconType === 'image' && entry.path) {
        const image = document.createElement('img');
        image.className = 'file-preview-directory-thumbnail';
        image.alt = entry.name || entry.path;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            visual.classList.remove('has-thumbnail');
            visual.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${FILE_TREE_ICON_PATHS.image}</svg>`;
        });
        image.src = debugWorkspaceApi.rawUrl(entry.path);
        visual.classList.add('has-thumbnail');
        visual.appendChild(image);
        return visual;
    }

    visual.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${FILE_TREE_ICON_PATHS[iconType] || FILE_TREE_ICON_PATHS.file}</svg>`;
    return visual;
}

/** 返回目录预览卡片的人类可读类型名称。 */
function getDirectoryPreviewTypeLabel(entry) {
    if (entry?.type === 'directory') return '文件夹';
    const iconType = getDirectoryPreviewIconType(entry);
    const labels = {
        markdown: 'Markdown',
        code: '代码',
        pdf: 'PDF',
        image: '图片',
        audio: '音频',
        video: '视频',
        archive: '压缩包',
        spreadsheet: '表格',
        file: '文件',
    };
    return labels[iconType] || '文件';
}

/** 创建一个可继续进入目录或打开文件的目录预览卡片。 */
function createDirectoryPreviewItem(entry) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `file-preview-directory-item ${entry.type === 'directory' ? 'is-directory' : 'is-file'}`;
    item.title = entry.path || entry.name || '';

    const visual = createDirectoryPreviewVisual(entry);
    const info = document.createElement('span');
    info.className = 'file-preview-directory-info';

    const name = document.createElement('span');
    name.className = 'file-preview-directory-name';
    name.textContent = entry.name || getWorkspaceFileBaseName(entry.path || '');

    const detail = document.createElement('span');
    detail.className = 'file-preview-directory-detail';
    if (entry.type === 'directory') {
        const childCount = Array.isArray(entry.children) ? entry.children.length : 0;
        detail.textContent = `${getDirectoryPreviewTypeLabel(entry)} · ${childCount} 项`;
    } else {
        detail.textContent = `${getDirectoryPreviewTypeLabel(entry)} · ${formatFileSizeBytes(Number(entry.size) || 0)}`;
    }

    info.appendChild(name);
    info.appendChild(detail);
    item.appendChild(visual);
    item.appendChild(info);
    item.addEventListener('click', async () => {
        if (entry.type === 'directory') {
            await openApiDirectoryPreviewTab(entry);
        } else {
            await openApiFilePreviewTab(entry);
        }
    });
    return item;
}

/** 渲染 API 文件树目录的文件夹式预览。 */
async function renderApiDirectoryPreviewTab(tab) {
    if (!filePreviewBody || !filePreviewWorkbench) return;
    const directoryPath = String(tab.entry?.path || tab.path || '').replace(/\/+$/, '');
    resetActivePreviewSurface();
    currentPreviewFile = null;
    currentPreviewPath = directoryPath;
    currentPreviewCopyText = '';
    if (filePreviewOpenBtn) filePreviewOpenBtn.style.display = 'none';
    if (filePreviewRenderBtn) filePreviewRenderBtn.style.display = 'none';

    try {
        const data = await debugWorkspaceApi.listTree(directoryPath, 1);
        const entries = sortFileTreeEntries(data.entries || []);
        const directoryCount = entries.filter(entry => entry.type === 'directory').length;
        const fileCount = entries.length - directoryCount;
        tab.entry = Object.assign({}, tab.entry, { children: entries });

        renderFilePreviewMetaRows(filePreviewMeta, [
            { label: '文件名', value: tab.title || getWorkspaceFileBaseName(directoryPath) || getActiveFiletreeScopeConfig().rootLabel },
            { label: '路径', value: directoryPath || getActiveFiletreeScopeConfig().rootLabel },
            { label: '预览类型', value: PREVIEW_KIND_LABEL.directory },
            { label: '文件夹', value: String(directoryCount) },
            { label: '文件', value: String(fileCount) },
            { label: '总计', value: String(entries.length) },
        ]);

        const folder = document.createElement('section');
        folder.className = 'file-preview-directory';
        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'file-preview-directory-empty';
            empty.innerHTML = '<div class="file-preview-directory-empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true">' + FILE_TREE_ICON_PATHS.folderOpen + '</svg></div><div class="file-preview-empty-title">空文件夹</div><div class="file-preview-empty-text">这个目录中还没有文件或子目录。</div>';
            folder.appendChild(empty);
        } else {
            const grid = document.createElement('div');
            grid.className = 'file-preview-directory-grid';
            entries.forEach(entry => grid.appendChild(createDirectoryPreviewItem(entry)));
            folder.appendChild(grid);
        }
        filePreviewBody.appendChild(folder);
        setFilePreviewWorkbenchVisible(true);
    } catch (error) {
        console.error('读取 API 工作区目录失败', error);
        appendPreviewMessage(filePreviewBody, `读取目录失败: ${error.message || error}`);
        setFilePreviewWorkbenchVisible(true);
    }
}

function buildApiFilePreviewDescriptor(entry, kind) {
    const path = entry?.path || '';
    return {
        name: entry?.name || getWorkspaceFileBaseName(path),
        size: Number(entry?.size) || 0,
        type: kind === 'html' ? 'text/html' : '',
        lastModified: entry?.updated_at ? Number(entry.updated_at) * 1000 : Date.now(),
    };
}

async function renderApiFilePreviewTab(tab) {
    if (!filePreviewBody || !filePreviewWorkbench) return;
    const entry = tab.entry || {};
    const filePath = entry.path || tab.path;
    const kindProbe = buildApiFilePreviewDescriptor(entry, '');
    const kind = isHtmlPreviewable(filePath, kindProbe) ? 'html' : getWorkspacePreviewKind(filePath, kindProbe);
    const rawUrl = appendPreviewRefreshToken(kind === 'html'
        ? debugWorkspaceApi.rawPathUrl(filePath)
        : debugWorkspaceApi.rawUrl(filePath));
    resetActivePreviewSurface();
    currentPreviewFile = null;
    currentPreviewPath = filePath;
    currentPreviewCopyText = '';
    if (filePreviewRenderBtn) filePreviewRenderBtn.style.display = 'none';

    const setMeta = (previewKind, extraRows = []) => {
        const descriptor = buildApiFilePreviewDescriptor(entry, previewKind);
        setFilePreviewMeta(descriptor, filePath, previewKind, extraRows);
    };

    try {
        if (kind === 'html') {
            const data = await debugWorkspaceApi.readFile(filePath);
            currentPreviewCopyText = data.content || '';
            currentPreviewEditable = true;
            updateFilePreviewEditActions();
            setMeta('html', []);
            const iframe = document.createElement('iframe');
            iframe.className = 'file-preview-pdf file-preview-html';
            iframe.title = filePath;
            iframe.src = rawUrl;
            filePreviewBody.appendChild(iframe);
        } else if (kind === 'unsupported') {
            setMeta(kind, []);
            appendPreviewMessage(filePreviewBody, '此文件类型无法在浏览器内预览，请使用本地应用打开。');
        } else if (kind === 'image') {
            setMeta(kind, []);
            const img = document.createElement('img');
            img.className = 'file-preview-image';
            img.alt = filePath;
            img.addEventListener('load', () => {
                setMeta(kind, [{ label: '尺寸', value: `${img.naturalWidth} × ${img.naturalHeight} px` }]);
            });
            img.addEventListener('error', () => {
                filePreviewBody.innerHTML = '';
                appendPreviewMessage(filePreviewBody, '无法将此文件作为图片显示（可能格式不受当前浏览器支持）。请使用本地应用打开。');
            });
            img.src = rawUrl;
            filePreviewBody.appendChild(img);
        } else if (kind === 'video') {
            setMeta(kind, []);
            const video = document.createElement('video');
            video.className = 'file-preview-video';
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.addEventListener('loadedmetadata', () => {
                setMeta(kind, [
                    { label: '分辨率', value: `${video.videoWidth} × ${video.videoHeight} px` },
                    { label: '时长', value: formatMediaDurationSeconds(video.duration) },
                ]);
            });
            video.addEventListener('error', () => {
                filePreviewBody.innerHTML = '';
                appendPreviewMessage(filePreviewBody, '无法播放此视频（可能编码或容器格式不受当前浏览器支持）。请使用本地应用打开。');
            });
            video.src = rawUrl;
            filePreviewBody.appendChild(video);
        } else if (kind === 'audio') {
            setMeta(kind, []);
            const audio = document.createElement('audio');
            audio.className = 'file-preview-audio';
            audio.controls = true;
            audio.preload = 'metadata';
            audio.addEventListener('loadedmetadata', () => {
                setMeta(kind, [{ label: '时长', value: formatMediaDurationSeconds(audio.duration) }]);
            });
            audio.addEventListener('error', () => {
                filePreviewBody.innerHTML = '';
                appendPreviewMessage(filePreviewBody, '无法播放此音频（可能格式不受当前浏览器支持）。请使用本地应用打开。');
            });
            audio.src = rawUrl;
            filePreviewBody.appendChild(audio);
        } else if (kind === 'pdf') {
            setMeta(kind, []);
            const iframe = document.createElement('iframe');
            iframe.className = 'file-preview-pdf';
            iframe.title = filePath;
            iframe.src = rawUrl;
            filePreviewBody.appendChild(iframe);
        } else if (kind === 'text') {
            const data = await debugWorkspaceApi.readFile(filePath);
            const text = data.content || '';
            const lineCount = text.split(/\r\n|\r|\n/).length;
            const isCanvasProjectFile = isMagicProjectJs(filePath);
            const canvasConfig = isCanvasProjectFile ? await parseMagicProjectConfig(text) : null;
            if (isCanvasProjectFile && canvasConfig?.type === 'design' && canvasConfig.canvas) {
                setMeta('canvas', [
                    { label: '数据视图', value: '解压后 JSON' },
                    { label: '原始行数', value: String(lineCount) },
                    { label: '原始字符数', value: String(text.length) },
                ]);
                renderMagicProjectCodePreview(text, canvasConfig, filePath);
                setMeta('canvas', [
                    { label: '数据视图', value: '解压后 JSON' },
                    { label: '原始行数', value: String(lineCount) },
                    { label: '原始字符数', value: String(text.length) },
                ]);
                updateFilePreviewEditActions();
            } else {
                currentPreviewCopyText = text;
                currentPreviewEditable = true;
                updateFilePreviewEditActions();
                setMeta(kind, [
                    { label: '行数', value: String(lineCount) },
                    { label: '字符数', value: String(text.length) },
                ]);
            }
            if (!isCanvasProjectFile && isMarkdownPreviewFile(filePath)) {
                renderMarkdownFileMode(
                    text,
                    filePreviewTabs.get(filePath)?.markdownMode || 'rendered',
                    filePath,
                );
            }
            if (!isCanvasProjectFile && !isMarkdownPreviewFile(filePath)) {
                const pre = document.createElement('pre');
                pre.className = 'file-preview-content';
                pre.textContent = text;
                filePreviewBody.appendChild(pre);
            }
        }
        setFilePreviewWorkbenchVisible(true);
    } catch (e) {
        console.error('读取 API 工作区文件失败', e);
        appendPreviewMessage(filePreviewBody, `读取文件失败: ${e.message || e}`);
        setFilePreviewWorkbenchVisible(true);
    }
}

// 读取并渲染文件树
async function renderFileTree() {
    if (!filetreeContainer) return { changed: false };
    try {
        const data = await debugWorkspaceApi.listTree('', 8);
        const nextEntries = data.entries || [];
        const nextFingerprint = buildFileTreeFingerprint(nextEntries);
        const changed = Boolean(
            currentFileTreeFingerprint
            && currentFileTreeFingerprint !== nextFingerprint
        );
        currentFileTreeFingerprint = nextFingerprint;
        currentFileTreeEntries = nextEntries;
        initializeDefaultExpandedDirectories(currentFileTreeEntries);
        const frag = document.createDocumentFragment();
        await buildApiTreeNodes(nextEntries, frag, 0);
        filetreeContainer.innerHTML = '';
        filetreeContainer.appendChild(frag);
        if (!filetreeContainer.hasChildNodes() || filetreeContainer.children.length === 0) {
            filetreeContainer.innerHTML = '<div class="filetree-empty">目录为空</div>';
        }
        updateSelectBtn('active');
        if (changed) scheduleActiveFilePreviewRefresh();
        return { changed };
    } catch (e) {
        console.error('渲染文件树失败', e);
        updateSelectBtn('need-auth');
        if (filetreeContainer) {
            filetreeContainer.innerHTML = `<div class="filetree-empty">无法加载${getActiveFiletreeScopeConfig().title}，请确认 super-magic 后端已启动。</div>`;
        }
        return { changed: false, error: e };
    }
}

async function buildApiTreeNodes(entries, container, depth) {
    const sorted = sortFileTreeEntries(entries);

    for (const entry of sorted) {
        if (!entry || !entry.name) continue;
        const fullPath = entry.path || entry.name;
        const isDir = entry.type === 'directory';
        const microAppConfig = getActiveFiletreeScope() === 'workspace' && isDir && hasApiMicroAppConfigFile(entry)
            ? await readApiMicroAppConfig(fullPath)
            : null;
        const canvasProject = getActiveFiletreeScope() === 'workspace' && isDir
            ? await isApiCanvasDesignProject(entry, fullPath)
            : false;

        const node = document.createElement('div');
        node.className = `ft-node ${isDir ? 'ft-dir' : 'ft-file'}${microAppConfig ? ' ft-micro-app' : ''}${canvasProject ? ' ft-canvas-project' : ''}`;
        node.style.paddingLeft = `${8 + depth * 14}px`;
        node.dataset.path = fullPath;
        node.dataset.type = isDir ? 'directory' : 'file';

        const icon = createFileTreeIcon(entry.name, isDir, expandedDirs.has(fullPath), { microApp: !!microAppConfig });

        const name = document.createElement('span');
        name.className = 'ft-name';
        name.textContent = entry.name;
        name.title = microAppConfig
            ? `微应用: ${microAppConfig.name || entry.name}，单击展开/收起，使用“打开微应用”按钮打开`
            : canvasProject
                ? '画布项目：单击展开/收起，使用“打开画布”按钮打开只读预览'
                : fullPath;

        node.appendChild(icon);
        node.appendChild(name);
        appendFileTreeOpenHints(node, {
            microApp: !!microAppConfig,
            canvasProject,
            openMicroApp: () => openApiMicroAppPreviewTab(fullPath, microAppConfig),
            openCanvas: () => openApiCanvasProjectPreviewTab(fullPath, entry),
        });
        node.appendChild(createWorkspaceDeleteButton(fullPath, isDir));
        container.appendChild(node);

        if (isDir) {
            const childContainer = document.createElement('div');
            childContainer.className = 'ft-children';
            if (expandedDirs.has(fullPath)) {
                childContainer.style.display = 'block';
                await buildApiTreeNodes(entry.children || [], childContainer, depth + 1);
            } else {
                childContainer.style.display = 'none';
            }
            container.appendChild(childContainer);

            node.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (e.detail > 1) return;
                if (expandedDirs.has(fullPath)) {
                    expandedDirs.delete(fullPath);
                    childContainer.style.display = 'none';
                    childContainer.innerHTML = '';
                    updateFileTreeIcon(icon, entry.name, true, false, { microApp: !!microAppConfig });
                } else {
                    expandedDirs.add(fullPath);
                    childContainer.innerHTML = '';
                    await buildApiTreeNodes(entry.children || [], childContainer, depth + 1);
                    childContainer.style.display = 'block';
                    updateFileTreeIcon(icon, entry.name, true, true, { microApp: !!microAppConfig });
                }
                await openApiDirectoryPreviewTab(entry);
            });
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dirPath = normalizeMentionDirectoryPath(fullPath);
                const menuItems = [{
                    label: '预览目录',
                    onSelect: () => openApiDirectoryPreviewTab(entry),
                }];
                if (microAppConfig) {
                    menuItems.push({
                        label: '打开微应用',
                        onSelect: () => openApiMicroAppPreviewTab(fullPath, microAppConfig),
                    });
                    menuItems.push({
                        label: expandedDirs.has(fullPath) ? '收起目录' : '展开目录',
                        onSelect: async () => {
                            if (expandedDirs.has(fullPath)) {
                                expandedDirs.delete(fullPath);
                            } else {
                                expandedDirs.add(fullPath);
                            }
                            await renderFileTree();
                        },
                    });
                }
                if (canvasProject) {
                    menuItems.push({
                        label: '打开画布预览',
                        onSelect: () => openApiCanvasProjectPreviewTab(fullPath, entry),
                    });
                }
                menuItems.push({
                    label: '上传到此目录',
                    onSelect: () => openWorkspaceUploadPicker(fullPath),
                });
                menuItems.push({
                    label: '下载目录（zip）',
                    onSelect: () => triggerWorkspaceDownload(fullPath),
                });
                menuItems.push({
                    label: '删除目录',
                    onSelect: () => confirmDeleteWorkspacePath(fullPath, true),
                });
                menuItems.push({
                    label: '引用此目录（插入 @）',
                    onSelect: () => {
                        insertMentionAtCursor(buildFiletreeMentionSnippet(
                            'directory',
                            dirPath,
                            getActiveFiletreeScope(),
                        ));
                    },
                });
                openFiletreeContextMenu(e.clientX, e.clientY, menuItems);
            });
        } else {
            node.addEventListener('click', async (e) => {
                e.stopPropagation();
                await openApiFilePreviewTab(entry);
            });
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const fp = normalizeMentionFilePath(fullPath);
                openFiletreeContextMenu(e.clientX, e.clientY, [
                    {
                        label: '下载文件',
                        onSelect: () => triggerWorkspaceDownload(fullPath),
                    },
                    {
                        label: '删除文件',
                        onSelect: () => confirmDeleteWorkspacePath(fullPath, false),
                    },
                    {
                        label: '引用此文件（插入 @）',
                        onSelect: () => {
                            insertMentionAtCursor(buildFiletreeMentionSnippet(
                                'file',
                                fp,
                                getActiveFiletreeScope(),
                            ));
                        },
                    },
                ]);
            });
        }
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
        const microAppConfig = isDir ? await readMicroAppConfig(entry) : null;

        const node = document.createElement('div');
        node.className = `ft-node ${isDir ? 'ft-dir' : 'ft-file'}${microAppConfig ? ' ft-micro-app' : ''}`;
        node.style.paddingLeft = `${8 + depth * 14}px`;
        node.dataset.path = fullPath;
        node.dataset.type = isDir ? 'directory' : 'file';

        const icon = createFileTreeIcon(entry.name, isDir, expandedDirs.has(fullPath), { microApp: !!microAppConfig });

        const name = document.createElement('span');
        name.className = 'ft-name';
        name.textContent = entry.name;
        if (microAppConfig) {
            name.title = `微应用: ${microAppConfig.name || entry.name}，单击展开/收起，使用“打开微应用”按钮打开`;
        }

        node.appendChild(icon);
        node.appendChild(name);
        appendFileTreeOpenHints(node, {
            microApp: !!microAppConfig,
            openMicroApp: () => openMicroAppPreviewTab(entry, fullPath, microAppConfig),
        });
        node.appendChild(createWorkspaceDeleteButton(fullPath, isDir));
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
                if (e.detail > 1) return;
                const isOpen = expandedDirs.has(fullPath);
                if (isOpen) {
                    expandedDirs.delete(fullPath);
                    childContainer.style.display = 'none';
                    childContainer.innerHTML = '';
                    updateFileTreeIcon(icon, entry.name, true, false, { microApp: !!microAppConfig });
                } else {
                    expandedDirs.add(fullPath);
                    childContainer.innerHTML = '';
                    await buildTreeNodes(entry, childContainer, fullPath, depth + 1);
                    childContainer.style.display = 'block';
                    updateFileTreeIcon(icon, entry.name, true, true, { microApp: !!microAppConfig });
                }
            });
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dirPath = normalizeMentionDirectoryPath(fullPath);
                const menuItems = [];
                if (microAppConfig) {
                    menuItems.push({
                        label: '打开微应用',
                        onSelect: () => openMicroAppPreviewTab(entry, fullPath, microAppConfig),
                    });
                    menuItems.push({
                        label: expandedDirs.has(fullPath) ? '收起目录' : '展开目录',
                        onSelect: async () => {
                            if (expandedDirs.has(fullPath)) {
                                expandedDirs.delete(fullPath);
                            } else {
                                expandedDirs.add(fullPath);
                            }
                            await renderFileTree();
                        },
                    });
                }
                menuItems.push({
                    label: '删除目录',
                    onSelect: () => confirmDeleteWorkspacePath(fullPath, true),
                });
                menuItems.push({
                    label: '引用此目录（插入 @）',
                    onSelect: () => {
                        insertMentionAtCursor(buildFiletreeMentionSnippet('directory', dirPath, 'workspace'));
                    },
                });
                openFiletreeContextMenu(e.clientX, e.clientY, menuItems);
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
                openFiletreeContextMenu(e.clientX, e.clientY, [
                    {
                        label: '删除文件',
                        onSelect: () => confirmDeleteWorkspacePath(fullPath, false),
                    },
                    {
                        label: '引用此文件（插入 @）',
                        onSelect: () => {
                            insertMentionAtCursor(buildFiletreeMentionSnippet('file', fp, 'workspace'));
                        },
                    },
                ]);
            });
        }
    }
}

// ── 画布文件（magic.project.js）预览 ──

function isMagicProjectJs(filePath) {
    return getWorkspaceFileBaseName(filePath) === 'magic.project.js';
}

// V2/V3 画布压缩协议：canvas 字段被压成 MAGICPROJECTDESIGNDATA:// 字符串
const MAGIC_PROJECT_DESIGN_DATA_PREFIX = 'MAGICPROJECTDESIGNDATA://';
const MAGIC_PROJECT_VERSION_V1 = '1.0.0';
const MAGIC_PROJECT_VERSION_V2 = '2.0.0';
const MAGIC_PROJECT_VERSION_V3 = '3.0.0';
const SUPPORTED_MAGIC_PROJECT_VERSIONS = new Set([
    MAGIC_PROJECT_VERSION_V1,
    MAGIC_PROJECT_VERSION_V2,
    MAGIC_PROJECT_VERSION_V3,
]);

function isCompressedCanvas(value) {
    return typeof value === 'string' && value.startsWith(MAGIC_PROJECT_DESIGN_DATA_PREFIX);
}

// 解压 canvas 压缩串：base64 -> gzip 解压 -> JSON。使用浏览器内置 DecompressionStream，无需额外依赖。
async function decompressCanvasData(encoded) {
    const b64 = encoded.slice(MAGIC_PROJECT_DESIGN_DATA_PREFIX.length);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return JSON.parse(new TextDecoder('utf-8').decode(buf));
}

// 解析 magic.project.js：只按顶层 version 选择 V1 明文或 V2/V3 压缩协议。
async function parseMagicProjectConfig(text) {
    try {
        const m = text.match(/window\.magicProjectConfig\s*=\s*(\{[\s\S]*\})/);
        if (!m) return null;
        const config = JSON.parse(m[1]);
        const version = config?.version;
        if (!SUPPORTED_MAGIC_PROJECT_VERSIONS.has(version)) {
            throw new Error(`不支持的画布版本: ${version || 'missing'}`);
        }
        if (version === MAGIC_PROJECT_VERSION_V1) {
            if (!config.canvas || typeof config.canvas !== 'object' || Array.isArray(config.canvas)) {
                throw new Error('V1 画布必须使用明文对象');
            }
        } else {
            if (!isCompressedCanvas(config.canvas)) {
                throw new Error(`${version} 画布必须使用压缩字符串`);
            }
            config.canvas = await decompressCanvasData(config.canvas);
        }
        return config;
    } catch (e) {
        console.error('解析 magic.project.js 失败', e);
        return null;
    }
}

/** 将画布配置转换为默认展示的可读 JSON 文本，保留 magic.project.js 的上下文。 */
function formatMagicProjectDecompressedText(config) {
    return `window.magicProjectConfig = ${JSON.stringify(config, null, 2)};`;
}

/** 为 magic.project.js 创建只读代码预览，并维护原始/解压视图切换状态。 */
function renderMagicProjectCodePreview(rawText, config, filePath) {
    if (!filePreviewBody) return;
    currentCanvasProjectRawText = rawText;
    currentCanvasProjectDecompressedText = formatMagicProjectDecompressedText(config);
    currentCanvasProjectViewMode = 'decompressed';
    currentPreviewCopyText = currentCanvasProjectDecompressedText;
    currentPreviewEditable = false;

    const pre = document.createElement('pre');
    pre.className = 'file-preview-content file-preview-canvas-source';
    pre.textContent = currentCanvasProjectDecompressedText;
    pre.dataset.path = filePath;
    filePreviewBody.appendChild(pre);

    const isCompressed = /"canvas"\s*:\s*"MAGICPROJECTDESIGNDATA:\/\//.test(rawText);
    if (filePreviewCanvasDataToggleBtn && isCompressed) {
        filePreviewCanvasDataToggleBtn.style.display = '';
        filePreviewCanvasDataToggleBtn.textContent = '显示原始压缩数据';
        filePreviewCanvasDataToggleBtn.title = '当前默认显示解压后的 JSON，点击切换为原始压缩数据';
    }
}

/** 在原始压缩数据和解压 JSON 之间切换，不修改工作区文件。 */
function toggleMagicProjectDataView() {
    if (!currentCanvasProjectRawText || !filePreviewBody) return;
    const source = filePreviewBody.querySelector('.file-preview-canvas-source');
    if (!source) return;
    const showRaw = currentCanvasProjectViewMode === 'decompressed';
    currentCanvasProjectViewMode = showRaw ? 'raw' : 'decompressed';
    currentPreviewCopyText = showRaw
        ? currentCanvasProjectRawText
        : currentCanvasProjectDecompressedText;
    source.textContent = currentPreviewCopyText;
    if (filePreviewCanvasDataToggleBtn) {
        filePreviewCanvasDataToggleBtn.textContent = showRaw ? '显示解压后 JSON' : '显示原始压缩数据';
        filePreviewCanvasDataToggleBtn.title = showRaw
            ? '当前显示原始压缩数据，点击切换为解压后的 JSON'
            : '当前默认显示解压后的 JSON，点击切换为原始压缩数据';
    }
    const viewChip = [...(filePreviewMeta?.querySelectorAll('.file-preview-meta-chip') || [])]
        .find(chip => chip.querySelector('.file-preview-meta-label')?.textContent === '数据视图:');
    const viewValue = viewChip?.querySelector('.file-preview-meta-value');
    if (viewValue) viewValue.textContent = showRaw ? '原始压缩串' : '解压后 JSON';
}

/**
 * 选择 V3 Element 当前用于调试预览的 Content。
 * 只读画布默认展示 active Content，再回退第一个 Content。
 */
function selectCanvasPreviewContent(element, preferredContentId = null) {
    const contents = Array.isArray(element?.contents) ? element.contents : [];
    return contents.find(content => content?.contentId === preferredContentId)
        || contents.find(content => content?.contentId === element.activeContentId)
        || contents[0]
        || {};
}

/** 读取一个 Content 对当前只读节点正文产生影响的字段。 */
function resolveCanvasPreviewContentFields(element, content) {
    return {
        fill: content?.fill ?? element?.fill ?? null,
        stroke: content?.stroke ?? element?.stroke ?? null,
        strokeWidth: Number.isFinite(content?.strokeWidth)
            ? content.strokeWidth
            : Number.isFinite(element?.strokeWidth) ? element.strokeWidth : 0,
        cornerRadius: Number.isFinite(content?.cornerRadius)
            ? content.cornerRadius
            : Number.isFinite(element?.cornerRadius) ? element.cornerRadius : 0,
        content: content?.content ?? element?.content ?? null,
        defaultStyle: content?.defaultStyle ?? element?.defaultStyle ?? null,
        src: content?.src ?? element?.src ?? null,
        poster: content?.poster ?? element?.poster ?? null,
        status: content?.status ?? element?.status ?? null,
        errorMessage: content?.errorMessage ?? element?.errorMessage ?? null,
        shots: Array.isArray(content?.shots ?? element?.shots) ? (content?.shots ?? element?.shots) : [],
        generationConfig: content?.generationConfig ?? element?.generationConfig ?? {},
        // 保留生成请求，供调试画布展示只读的生成记录。
        generateImageRequest: content?.generateImageRequest ?? element?.generateImageRequest ?? null,
        generateVideoRequest: content?.generateVideoRequest ?? element?.generateVideoRequest ?? null,
        imageGenerationTaskMeta: content?.imageGenerationTaskMeta ?? element?.imageGenerationTaskMeta ?? null,
        visualUnderstanding: content?.visualUnderstanding ?? null,
        videoEditorDraft: content?.videoEditorDraft ?? null,
        videoGenerationResultMeta: content?.videoGenerationResultMeta ?? null,
        videoSequence: Array.isArray(content?.videoSequence ?? element?.videoSequence)
            ? (content?.videoSequence ?? element?.videoSequence)
            : [],
        audioSequence: Array.isArray(content?.audioSequence ?? element?.audioSequence)
            ? (content?.audioSequence ?? element?.audioSequence)
            : [],
        output: content?.output ?? element?.output ?? {},
    };
}

/** 切换归一化节点当前预览的 Content，不修改原始项目数据。 */
function applyCanvasPreviewContent(element, content) {
    Object.assign(
        element,
        resolveCanvasPreviewContentFields(element.rawElement, content),
        { selectedContentId: content?.contentId ?? null },
    );
}

/**
 * 把 V1/V2/V3 Element 归一化为调试面板唯一预览模型。
 * 该模型只存在于浏览器内，不会写回 magic.project.js。
 */
function normalizeCanvasPreviewElement(element, version, index, parentId = null, depth = 0) {
    const isV3 = version === MAGIC_PROJECT_VERSION_V3;
    const content = isV3 ? selectCanvasPreviewContent(element) : {};
    const previewContents = isV3 && Array.isArray(element?.contents) ? element.contents : [];
    const rawX = Number.isFinite(element?.x) ? element.x : null;
    const rawY = Number.isFinite(element?.y) ? element.y : null;
    const scaleX = Number.isFinite(element?.scaleX) ? element.scaleX : 1;
    const scaleY = Number.isFinite(element?.scaleY) ? element.scaleY : 1;
    // magic-web 将 width/height 与 scaleX/scaleY 分开保存，Konva 节点再统一应用缩放。
    const width = Number.isFinite(element?.width) && element.width > 0 ? element.width : null;
    const height = Number.isFinite(element?.height) && element.height > 0 ? element.height : null;
    return {
        id: String(element?.id || `preview-element-${index + 1}`),
        type: String(element?.type || 'unknown'),
        name: String(element?.name || element?.id || `未命名节点 ${index + 1}`),
        x: rawX,
        y: rawY,
        width,
        height,
        scaleX,
        scaleY,
        parentId,
        depth,
        zIndex: Number.isFinite(element?.zIndex) ? element.zIndex : index,
        visible: element?.visible !== false,
        locked: element?.locked === true,
        opacity: Number.isFinite(element?.opacity) ? element.opacity : 1,
        rotation: Number.isFinite(element?.rotation) ? element.rotation : 0,
        ...resolveCanvasPreviewContentFields(element, content),
        activeContentId: isV3 ? element?.activeContentId ?? null : null,
        mainContentId: isV3 ? element?.mainContentId ?? null : null,
        selectedContentId: isV3 ? content?.contentId ?? null : null,
        previewContents,
        contentCount: isV3 ? previewContents.length : 1,
        rawElement: element,
    };
}

/**
 * 递归展开已有 Frame/Group 子节点，同时保留父子关系供预览层恢复 Konva Group 语义。
 */
function flattenCanvasPreviewElements(elements, version, parentId = null, depth = 0, result = []) {
    for (const element of Array.isArray(elements) ? elements : []) {
        const normalized = normalizeCanvasPreviewElement(element, version, result.length, parentId, depth);
        result.push(normalized);
        if (Array.isArray(element?.children)) {
            flattenCanvasPreviewElements(element.children, version, normalized.id, depth + 1, result);
        }
    }
    return result;
}

/** 读取 CanvasDesign 对应节点缺省尺寸，避免业务节点被压缩成调试卡片。 */
function resolveCanvasPreviewDefaultSize(elementType) {
    return {
        image: [240, 160],
        video: [240, 160],
        audio: [360, 140],
        text: [320, 120],
        rectangle: [220, 140],
        ellipse: [180, 180],
        triangle: [180, 180],
        star: [180, 180],
        frame: [640, 480],
        group: [320, 240],
        storyboard: [960, 1360],
        'video-edit': [520, 360],
    }[elementType] || [220, 140];
}

/**
 * 只为缺失的坐标或尺寸补齐确定性预览布局。
 * 已持久化的真实坐标和尺寸保持不变，补齐结果也不会写回画布文件。
 */
function applyDeterministicCanvasPreviewLayout(elements) {
    const resolvedElements = elements.map(element => {
        const [defaultWidth, defaultHeight] = resolveCanvasPreviewDefaultSize(element.type);
        return {
            ...element,
            width: Number.isFinite(element.width) && element.width > 0 ? element.width : defaultWidth,
            height: Number.isFinite(element.height) && element.height > 0 ? element.height : defaultHeight,
        };
    });
    let fallbackY = resolvedElements.reduce((maxBottom, element) => {
        if (!Number.isFinite(element.x) || !Number.isFinite(element.y)) return maxBottom;
        return Math.max(maxBottom, element.y + element.height);
    }, -80) + 80;
    return resolvedElements.map((element, index) => {
        if (Number.isFinite(element.x) && Number.isFinite(element.y)) return element;
        const positioned = {
            ...element,
            x: 0,
            y: fallbackY,
            zIndex: Number.isFinite(element.zIndex) ? element.zIndex : index,
        };
        fallbackY += positioned.height + 80;
        return positioned;
    });
}

/**
 * 计算二维仿射矩阵。
 * 矩阵顺序与 Konva 的节点树一致：父级变换先应用，子级再应用自身的平移、缩放和旋转。
 */
function multiplyCanvasPreviewMatrix(left, right) {
    return {
        a: left.a * right.a + left.c * right.b,
        b: left.b * right.a + left.d * right.b,
        c: left.a * right.c + left.c * right.d,
        d: left.b * right.c + left.d * right.d,
        e: left.a * right.e + left.c * right.f + left.e,
        f: left.b * right.e + left.d * right.f + left.f,
    };
}

/** 创建与 Konva 节点等价的平移、缩放、旋转矩阵。 */
function createCanvasPreviewLocalMatrix(element) {
    const rotation = Number.isFinite(element.rotation) ? element.rotation * Math.PI / 180 : 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const scaleX = Number.isFinite(element.scaleX) ? element.scaleX : 1;
    const scaleY = Number.isFinite(element.scaleY) ? element.scaleY : 1;
    return {
        a: cos * scaleX,
        b: sin * scaleX,
        c: -sin * scaleY,
        d: cos * scaleY,
        e: Number.isFinite(element.x) ? element.x : 0,
        f: Number.isFinite(element.y) ? element.y : 0,
    };
}

/** 将局部矩形转换为世界坐标包围盒。 */
function getCanvasPreviewWorldBounds(matrix, width, height) {
    const points = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
    ].map(point => ({
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    }));
    const minX = Math.min(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxX = Math.max(...points.map(point => point.x));
    const maxY = Math.max(...points.map(point => point.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 为每个节点生成 magic-web 兼容的世界几何。
 * x/y/width/height 仍保留原始文档值，避免预览层修改项目数据；布局结果只放在 layout 字段中。
 */
function resolveCanvasPreviewScene(elements) {
    const elementById = new Map(elements.map(element => [element.id, element]));
    const layoutById = new Map();
    const resolving = new Set();

    const resolve = element => {
        if (layoutById.has(element.id)) return layoutById.get(element.id);
        if (resolving.has(element.id)) {
            // 损坏的循环父子关系不能阻塞整个调试预览，退化为根节点处理。
            return { matrix: createCanvasPreviewLocalMatrix({ ...element, parentId: null }) };
        }
        resolving.add(element.id);
        const parent = element.parentId ? elementById.get(element.parentId) : null;
        const parentLayout = parent ? resolve(parent) : null;
        const localMatrix = createCanvasPreviewLocalMatrix(element);
        const matrix = parentLayout
            ? multiplyCanvasPreviewMatrix(parentLayout.matrix, localMatrix)
            : localMatrix;
        const width = Number.isFinite(element.width) && element.width > 0 ? element.width : 1;
        const height = Number.isFinite(element.height) && element.height > 0 ? element.height : 1;
        const worldBounds = getCanvasPreviewWorldBounds(
            matrix,
            width,
            height,
        );
        const layout = {
            matrix,
            worldOrigin: { x: matrix.e, y: matrix.f },
            worldBounds,
            width,
            height,
        };
        resolving.delete(element.id);
        layoutById.set(element.id, layout);
        return layout;
    };

    return elements.map(element => ({ ...element, layout: resolve(element) }));
}

/**
 * 把三种持久化结构转换为统一画布预览文档。
 */
function normalizeMagicProjectForPreview(config) {
    const version = config?.version;
    const rawElements = config?.canvas?.elements ?? [];
    let elements = flattenCanvasPreviewElements(rawElements, version);
    const hasCompleteLayout = elements.length > 0 && elements.every(element => (
        Number.isFinite(element.x)
        && Number.isFinite(element.y)
        && Number.isFinite(element.width)
        && Number.isFinite(element.height)
    ));
    elements = resolveCanvasPreviewScene(applyDeterministicCanvasPreviewLayout(elements));
    const connections = Array.isArray(config?.canvas?.connections)
        ? config.canvas.connections.map((connection, index) => ({
            id: String(connection?.id || `preview-connection-${index + 1}`),
            sourceElementId: String(connection?.sourceElementId || connection?.source_element_id || ''),
            targetElementId: String(connection?.targetElementId || connection?.target_element_id || ''),
            locked: connection?.locked === true,
        }))
        : [];
    return {
        version,
        name: config?.name || '',
        elements,
        connections,
        usesPreviewLayout: !hasCompleteLayout,
    };
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
    const parts = relPath.split('/').filter(p => p && p !== '.');
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

function joinWorkspacePath(basePath, relPath) {
    const baseParts = String(basePath || '').split('/').filter(Boolean);
    const relParts = String(relPath || '').split('/').filter(p => p && p !== '.');
    return [...baseParts, ...relParts].join('/');
}

/**
 * 从视频 blob URL 中抓取第一帧，返回 data URL（失败时返回 null）。
 */
function captureVideoFrame(videoBlobUrl) {
    return new Promise((resolve) => {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        if (/^https?:/i.test(videoBlobUrl)) v.crossOrigin = 'anonymous';
        let settled = false;
        let captureRequested = false;
        const done = (result) => {
            if (settled) return;
            settled = true;
            v.src = '';
            resolve(result);
        };
        const timer = setTimeout(() => done(null), 10000);
        v.addEventListener('error', () => { clearTimeout(timer); done(null); });
        const requestCapture = () => {
            if (captureRequested || settled || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
            captureRequested = true;
            const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0.1;
            try {
                v.currentTime = Math.min(0.1, Math.max(0.01, duration / 2));
            } catch {
                done(null);
            }
        };
        const capture = () => {
            if (settled || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
            clearTimeout(timer);
            try {
                const c = document.createElement('canvas');
                c.width = v.videoWidth || 640;
                c.height = v.videoHeight || 360;
                const context = c.getContext('2d');
                if (!context || !c.width || !c.height) return done(null);
                context.drawImage(v, 0, 0, c.width, c.height);
                done(c.toDataURL('image/jpeg', 0.82));
            } catch {
                done(null);
            }
        };
        v.addEventListener('loadedmetadata', requestCapture);
        v.addEventListener('loadeddata', requestCapture);
        v.addEventListener('canplay', requestCapture);
        v.addEventListener('seeked', capture);
        v.src = videoBlobUrl;
        v.load();
    });
}

/**
 * 弹出画布媒体 modal：图片展示原图，视频和音频展示播放器。
 * @param {'image'|'video'|'audio'} type
 * @param {string|null} blobUrl  - 媒体文件的 blob URL
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
    } else if (type === 'audio' && blobUrl) {
        const audio = document.createElement('audio');
        audio.src = blobUrl;
        audio.controls = true;
        audio.autoplay = true;
        audio.style.cssText = 'width:min(560px,80vw);display:block;margin:48px 24px;';
        mediaWrap.appendChild(audio);
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

    // modal 移除时停止媒体播放
    new MutationObserver(() => {
        if (!document.getElementById('canvasMediaModal')) {
            overlay.querySelectorAll('video,audio').forEach(media => {
                media.pause();
                media.src = '';
            });
            document.removeEventListener('keydown', onKey);
        }
    }).observe(document.body, { childList: true });
}

/**
 * 创建节点正文中的普通文字行。
 */
function createCanvasPreviewText(text, className = 'canvas-el-label') {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
}

/** 在图片元素上方创建名称和展示尺寸信息。 */
function createCanvasImageTopMetadata(element) {
    const metadata = document.createElement('div');
    metadata.className = 'canvas-el-image-top-metadata';
    const name = createCanvasPreviewText(element.name, 'canvas-el-image-external-name');
    name.title = element.name;
    const dimensions = createCanvasPreviewText(
        `${Math.round(element.width)} × ${Math.round(element.height)}`,
        'canvas-el-image-dimensions',
    );
    metadata.append(name, dimensions);
    return metadata;
}

/** 返回媒体节点对应的最近一次生成请求。 */
function getCanvasGenerationRequest(element) {
    if (element?.type === 'image') return element.generateImageRequest;
    if (element?.type === 'video') return element.generateVideoRequest;
    return null;
}

/** 判断节点或其任一历史 Content 是否存在生成请求。 */
function hasCanvasGenerationRequest(element) {
    if (getCanvasGenerationRequest(element)) return true;
    const contents = Array.isArray(element?.previewContents) ? element.previewContents : [];
    return contents.some(content => element?.type === 'image'
        ? Boolean(content?.generateImageRequest)
        : element?.type === 'video' ? Boolean(content?.generateVideoRequest) : false);
}

/** 将图片或视频生成请求中的引用素材归一化为面板可展示的数据。 */
function getCanvasGenerationReferences(element, request) {
    if (!request || typeof request !== 'object') return [];
    if (element?.type === 'image') {
        return (Array.isArray(request.reference_images) ? request.reference_images : [])
            .filter(Boolean)
            .map(path => ({ path: String(path), label: '参考图', type: 'image' }));
    }

    const inputs = request.inputs && typeof request.inputs === 'object' ? request.inputs : {};
    const references = [];
    const append = (items, type, label) => {
        (Array.isArray(items) ? items : []).forEach(item => {
            const path = typeof item === 'string' ? item : item?.uri;
            if (path) references.push({ path: String(path), label, type });
        });
    };
    append(inputs.frames, 'image', '关键帧');
    append(inputs.reference_images, 'image', '参考图');
    append(inputs.reference_videos, 'video', '参考视频');
    append(inputs.reference_audios, 'audio', '参考音频');
    const appendSingle = (item, type, label) => {
        const path = typeof item === 'string' ? item : item?.uri;
        if (path) references.push({ path: String(path), label, type });
    };
    appendSingle(inputs.video, 'video', '源视频');
    appendSingle(inputs.mask, 'image', '遮罩');
    append(inputs.audio, 'audio', '输入音频');
    return references;
}

/** 创建生成记录中的一行只读字段。 */
function createCanvasGenerationDetailRow(label, value) {
    if (value === undefined || value === null || value === '') return null;
    const row = document.createElement('div');
    row.className = 'canvas-generation-detail-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'canvas-generation-detail-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = 'canvas-generation-detail-value';
    valueEl.textContent = String(value);
    row.append(labelEl, valueEl);
    return row;
}

/** 将生成详情时间格式化为带时区的人类可读文本。 */
function formatCanvasGenerationDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = number => String(number).padStart(2, '0');
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetRemainder = Math.abs(offsetMinutes) % 60;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} UTC${sign}`
        + `${pad(offsetHours)}:${pad(offsetRemainder)}`;
}

/** 使用前端历史面板相同的天、时、分、秒格式展示耗时。 */
function formatCanvasGenerationDuration(seconds) {
    if (!Number.isFinite(seconds)) return null;
    let remaining = Math.max(0, Math.floor(seconds));
    const days = Math.floor(remaining / 86400);
    remaining %= 86400;
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const parts = [];
    if (days) parts.push(`${days}天`);
    if (hours) parts.push(`${hours}小时`);
    if (minutes) parts.push(`${minutes}分`);
    if (remaining % 60 || !parts.length) parts.push(`${remaining % 60}秒`);
    return parts.join('');
}

/** 创建媒体节点右上角的生成记录入口按钮。 */
function createCanvasGenerationInfoButton(element, onClick) {
    if (!hasCanvasGenerationRequest(element)) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'canvas-generation-info-button';
    button.setAttribute('aria-label', '查看生成记录');
    button.title = '查看生成记录';
    button.textContent = 'i';
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });
    return button;
}

/** 将详情浮层定位到媒体节点右侧，并在空间不足时切换到左侧。 */
function positionCanvasGenerationDetailPanel(panel, anchorElement, containerEl) {
    if (!anchorElement || !containerEl) return;
    const anchorRect = anchorElement.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const gap = 8;
    const preferredLeft = anchorRect.right - containerRect.left + gap;
    const fallbackLeft = anchorRect.left - containerRect.left - panel.offsetWidth - gap;
    const maxLeft = Math.max(gap, containerEl.clientWidth - panel.offsetWidth - gap);
    const left = preferredLeft + panel.offsetWidth <= containerEl.clientWidth - gap
        ? preferredLeft
        : Math.max(gap, Math.min(fallbackLeft, maxLeft));
    const maxTop = Math.max(gap, containerEl.clientHeight - panel.offsetHeight - gap);
    const top = Math.max(gap, Math.min(anchorRect.top - containerRect.top, maxTop));
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
    panel.style.top = `${top}px`;
}

/** 在调试画布视口中渲染生成记录浮层。 */
async function renderCanvasGenerationDetailPanel(element, request, resolveMediaUrl, containerEl, anchorElement, onClose) {
    const existing = containerEl.querySelector('.canvas-generation-detail-panel');
    if (existing) existing.remove();
    if (!request) return;

    const panel = document.createElement('aside');
    panel.className = 'canvas-generation-detail-panel';
    panel.dataset.elementId = element.id;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '生成记录');

    const header = document.createElement('div');
    header.className = 'canvas-generation-detail-header';
    const title = document.createElement('div');
    title.className = 'canvas-generation-detail-title';
    title.textContent = '生成记录';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'canvas-generation-detail-close';
    closeButton.setAttribute('aria-label', '关闭生成记录');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', event => {
        event.stopPropagation();
        panel.remove();
        onClose?.();
    });
    header.append(title, closeButton);
    panel.appendChild(header);

    const divider = document.createElement('div');
    divider.className = 'canvas-generation-detail-divider';
    panel.appendChild(divider);

    const body = document.createElement('div');
    body.className = 'canvas-generation-detail-body';
    panel.appendChild(body);

    const prompt = typeof request.prompt === 'string' ? request.prompt : '';
    const promptItem = document.createElement('section');
    promptItem.className = 'canvas-generation-detail-item';
    const promptTitle = document.createElement('div');
    promptTitle.className = 'canvas-generation-detail-item-title';
    promptTitle.textContent = '提示词';
    const promptActions = document.createElement('div');
    promptActions.className = 'canvas-generation-detail-prompt-actions';
    if (prompt) {
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'canvas-generation-detail-copy';
        copyButton.textContent = '复制';
        copyButton.addEventListener('click', event => {
            event.stopPropagation();
            void navigator.clipboard?.writeText(prompt);
        });
        promptActions.appendChild(copyButton);
    }
    promptTitle.appendChild(promptActions);
    const promptValue = document.createElement('div');
    promptValue.className = 'canvas-generation-detail-prompt';
    promptValue.textContent = prompt || '暂无提示词';
    promptItem.append(promptTitle, promptValue);
    body.appendChild(promptItem);

    const references = getCanvasGenerationReferences(element, request);
    if (references.length) {
        const referencesItem = document.createElement('section');
        referencesItem.className = 'canvas-generation-detail-item';
        const referencesTitle = document.createElement('div');
        referencesTitle.className = 'canvas-generation-detail-item-title';
        referencesTitle.textContent = element.type === 'image' ? '参考图' : '参考素材';
        const referencesGrid = document.createElement('div');
        referencesGrid.className = 'canvas-generation-detail-references';
        references.forEach(reference => {
            const referenceItem = document.createElement('div');
            referenceItem.className = 'canvas-generation-detail-reference';
            const referenceLabel = document.createElement('span');
            referenceLabel.className = 'canvas-generation-detail-reference-label';
            referenceLabel.textContent = reference.label;
            referenceItem.appendChild(referenceLabel);
            const media = document.createElement('div');
            media.className = 'canvas-generation-detail-reference-media';
            media.textContent = reference.path;
            referenceItem.appendChild(media);
            referencesGrid.appendChild(referenceItem);
            void (async () => {
                try {
                    // asset:// 是 provider 资源标识，不属于当前工作区文件，保留原始 URI。
                    if (/^asset:/i.test(reference.path)) return;
                    const url = /^https?:|^blob:|^data:|^file:/i.test(reference.path)
                        ? reference.path
                        : await resolveMediaUrl(reference.path);
                    if (!url || !panel.isConnected) return;
                    const mediaElement = reference.type === 'video'
                        ? document.createElement('video')
                        : reference.type === 'audio'
                        ? document.createElement('audio')
                        : document.createElement('img');
                    mediaElement.src = url;
                    if (mediaElement instanceof HTMLImageElement) mediaElement.alt = reference.label;
                    if (mediaElement instanceof HTMLVideoElement) {
                        mediaElement.muted = true;
                        mediaElement.loop = true;
                        mediaElement.playsInline = true;
                        mediaElement.autoplay = true;
                    }
                    if (mediaElement instanceof HTMLMediaElement) mediaElement.controls = false;
                    mediaElement.addEventListener('error', () => {
                        media.textContent = reference.path;
                    });
                    media.textContent = '';
                    media.appendChild(mediaElement);
                } catch {
                    // 引用素材不可用时保留路径文本，避免详情面板整体失败。
                }
            })();
        });
        referencesItem.append(referencesTitle, referencesGrid);
        body.appendChild(referencesItem);
    }

    const model = request.model_id || request.model || null;
    const size = [request.size, request.resolution]
        .filter(Boolean)
        .join(' · ') || null;
    const rows = [
        createCanvasGenerationDetailRow('模型', model),
        createCanvasGenerationDetailRow('尺寸', size),
    ];
    let runningStartedAtMs = NaN;
    let runningDurationRow = null;
    if (element.type === 'image') {
        const imageConfig = request.image_generation_config && typeof request.image_generation_config === 'object'
            ? request.image_generation_config
            : {};
        const imageSettings = [
            ['画面比例', imageConfig.aspect_ratio],
            ['风格', imageConfig.style],
            ['质量', imageConfig.quality],
        ];
        imageSettings.forEach(([label, value]) => {
            rows.push(createCanvasGenerationDetailRow(label, value));
        });
    }
    if (element.type === 'video') {
        const resultMeta = element.videoGenerationResultMeta && typeof element.videoGenerationResultMeta === 'object'
            ? element.videoGenerationResultMeta
            : {};
        const generationInfo = resultMeta.generation_info && typeof resultMeta.generation_info === 'object'
            ? resultMeta.generation_info
            : {};
        const runtime = resultMeta.runtime && typeof resultMeta.runtime === 'object'
            ? resultMeta.runtime
            : {};
        const finalResolution = generationInfo.resolution || request.generation?.resolution || request.resolution;
        const startedAt = runtime.started_at;
        const finishedAt = runtime.finished_at;
        const startedMs = startedAt ? Date.parse(startedAt) : NaN;
        const isRunning = ['pending', 'processing'].includes(element.status);
        runningStartedAtMs = startedMs;
        const durationSeconds = generationInfo.duration_seconds ?? request.generation?.duration_seconds;
        const generationSpec = [
            generationInfo.aspect_ratio || request.generation?.aspect_ratio,
            durationSeconds !== undefined && durationSeconds !== null ? `${durationSeconds}s` : null,
            finalResolution,
        ].filter(Boolean).join(' · ') || null;
        const inputMode = generationInfo.input_mode || request.input_mode;
        const inputModeLabels = {
            standard: '标准模式',
            omni_reference: '全能模式',
            image_reference: '参考图',
            keyframe_guided: '首尾帧',
            video_edit: '视频编辑',
        };
        const elapsed = Number.isFinite(runtime.elapsed_seconds)
            ? runtime.elapsed_seconds
            : Number.isFinite(startedMs) && finishedAt
                ? Math.max(0, Math.floor((Date.parse(finishedAt) - startedMs) / 1000))
                : isRunning && Number.isFinite(startedMs)
                    ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
                    : null;
        runningDurationRow = createCanvasGenerationDetailRow(
            isRunning ? '已耗时' : '生成耗时',
            formatCanvasGenerationDuration(elapsed),
        );
        rows.push(
            createCanvasGenerationDetailRow('积分消耗', resultMeta.billing?.points),
            createCanvasGenerationDetailRow('生成方式', inputModeLabels[inputMode] || inputMode),
            createCanvasGenerationDetailRow('任务类型', generationInfo.task || request.task),
            createCanvasGenerationDetailRow('生成规格', generationSpec),
            createCanvasGenerationDetailRow('开始时间', formatCanvasGenerationDateTime(startedAt)),
            createCanvasGenerationDetailRow('完成时间', formatCanvasGenerationDateTime(finishedAt)),
            runningDurationRow,
        );
    }
    rows.filter(Boolean).forEach(row => body.appendChild(row));

    containerEl.appendChild(panel);
    positionCanvasGenerationDetailPanel(panel, anchorElement, containerEl);
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('click', event => event.stopPropagation());
    if (element.type === 'video' && ['pending', 'processing'].includes(element.status)
        && Number.isFinite(runningStartedAtMs) && runningDurationRow) {
        const timer = window.setInterval(() => {
            if (!panel.isConnected) {
                window.clearInterval(timer);
                return;
            }
            const value = runningDurationRow.querySelector('.canvas-generation-detail-value');
            if (value) value.textContent = formatCanvasGenerationDuration(
                Math.max(0, Math.floor((Date.now() - runningStartedAtMs) / 1000)),
            );
        }, 1000);
    }
}

/**
 * 为多 Content 节点创建只读版本切换器。
 * 切换只影响浏览器中的归一化节点，不会修改 activeContentId 或 mainContentId。
 */
function createCanvasContentVersionSwitcher(element, onSelect, options = {}) {
    const contents = Array.isArray(element.previewContents) ? element.previewContents : [];
    const { external = false } = options;
    if (!contents.length || (!external && contents.length <= 1)) return null;

    let selectedIndex = Math.max(
        0,
        contents.findIndex(content => content?.contentId === element.selectedContentId),
    );
    let busy = false;
    const switcher = document.createElement('div');
    switcher.className = 'canvas-el-version-switcher';
    if (external) switcher.classList.add('is-external');

    const previousButton = document.createElement('button');
    previousButton.type = 'button';
    previousButton.className = 'canvas-el-version-button';
    previousButton.textContent = '‹';
    previousButton.title = '预览上一个版本';
    previousButton.setAttribute('aria-label', '预览上一个版本');

    const versionLabel = document.createElement('span');
    versionLabel.className = 'canvas-el-version-label';

    const mainVersionLabel = document.createElement('span');
    mainVersionLabel.className = 'canvas-el-main-version-label';

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'canvas-el-version-button';
    nextButton.textContent = '›';
    nextButton.title = '预览下一个版本';
    nextButton.setAttribute('aria-label', '预览下一个版本');

    /** 更新当前版本提示及两侧按钮状态。 */
    const updateState = () => {
        const selectedContent = contents[selectedIndex] || {};
        const labels = [];
        if (selectedContent.contentId === element.activeContentId) labels.push('当前');
        if (selectedContent.contentId === element.mainContentId) labels.push('主版本');
        versionLabel.textContent = external
            ? `当前版本 ${selectedIndex + 1} / ${contents.length}`
            : `${selectedIndex + 1} / ${contents.length}`;
        versionLabel.title = [selectedContent.contentId, ...labels].filter(Boolean).join(' · ');
        const isMainVersion = selectedContent.contentId === element.mainContentId;
        mainVersionLabel.textContent = isMainVersion ? '主版本' : '非主版本';
        mainVersionLabel.classList.toggle('is-main', isMainVersion);
        previousButton.disabled = busy || selectedIndex === 0;
        nextButton.disabled = busy || selectedIndex === contents.length - 1;
    };

    /** 切换到指定序号，并通知节点重新渲染正文。 */
    const selectIndex = async nextIndex => {
        const boundedIndex = Math.max(0, Math.min(contents.length - 1, nextIndex));
        if (busy || boundedIndex === selectedIndex) return;
        selectedIndex = boundedIndex;
        busy = true;
        updateState();
        try {
            await onSelect(contents[selectedIndex]);
        } finally {
            busy = false;
            updateState();
        }
    };

    previousButton.addEventListener('click', event => {
        event.stopPropagation();
        void selectIndex(selectedIndex - 1);
    });
    nextButton.addEventListener('click', event => {
        event.stopPropagation();
        void selectIndex(selectedIndex + 1);
    });
    switcher.addEventListener('click', event => event.stopPropagation());
    if (external) {
        switcher.append(previousButton, versionLabel, mainVersionLabel, nextButton);
    } else {
        switcher.append(previousButton, versionLabel, nextButton);
    }
    updateState();
    return switcher;
}

/**
 * 在画布空间底层绘制 Element 级 Connection。
 */
function renderCanvasConnections(space, connections, elementById, minX, minY, canvasW, canvasH) {
    if (!connections.length) return;
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.classList.add('canvas-preview-connections');
    svg.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);
    svg.setAttribute('width', String(canvasW));
    svg.setAttribute('height', String(canvasH));

    const defs = document.createElementNS(namespace, 'defs');
    const marker = document.createElementNS(namespace, 'marker');
    marker.setAttribute('id', 'canvas-preview-connection-arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS(namespace, 'path');
    arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);

    for (const connection of connections) {
        const source = elementById.get(connection.sourceElementId);
        const target = elementById.get(connection.targetElementId);
        if (!source || !target || source.id === target.id) continue;
        const sourceBounds = source.layout?.worldBounds || {
            x: source.x,
            y: source.y,
            width: source.width,
            height: source.height,
        };
        const targetBounds = target.layout?.worldBounds || {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
        };
        const sourceX = sourceBounds.x - minX + sourceBounds.width;
        const sourceY = sourceBounds.y - minY + sourceBounds.height / 2;
        const targetX = targetBounds.x - minX;
        const targetY = targetBounds.y - minY + targetBounds.height / 2;
        const controlOffset = Math.max(60, Math.abs(targetX - sourceX) * 0.5);
        const direction = targetX >= sourceX ? 1 : -1;
        const path = document.createElementNS(namespace, 'path');
        path.classList.add('canvas-preview-connection');
        if (connection.locked) path.classList.add('is-locked');
        path.setAttribute(
            'd',
            `M ${sourceX} ${sourceY} C ${sourceX + controlOffset * direction} ${sourceY}, `
                + `${targetX - controlOffset * direction} ${targetY}, ${targetX} ${targetY}`,
        );
        path.setAttribute('marker-end', 'url(#canvas-preview-connection-arrow)');
        const title = document.createElementNS(namespace, 'title');
        title.textContent = `${connection.sourceElementId} → ${connection.targetElementId}`;
        path.appendChild(title);
        svg.appendChild(path);
    }
    space.appendChild(svg);
}

/** 解析分镜节点当前使用的画面比例。 */
function resolveCanvasStoryboardAspectRatio(generationConfig) {
    const configuredRatio = generationConfig?.image_generation_config?.aspect_ratio;
    if (configuredRatio) return configuredRatio;
    const sizeMatch = String(generationConfig?.size || '').match(/^(\d+)x(\d+)$/i);
    if (!sizeMatch) return '未设置';
    const width = Number(sizeMatch[1]);
    const height = Number(sizeMatch[2]);
    if (!width || !height) return '未设置';
    let left = width;
    let right = height;
    while (right !== 0) {
        const remainder = left % right;
        left = right;
        right = remainder;
    }
    const divisor = left;
    return `${width / divisor}:${height / divisor}`;
}

/** 创建分镜节点的只读参数和镜头列表。 */
function createCanvasStoryboardCard(element) {
    const card = document.createElement('div');
    card.className = 'canvas-el-storyboard-card';

    const generationConfig = element.generationConfig && typeof element.generationConfig === 'object'
        ? element.generationConfig
        : {};
    const header = document.createElement('div');
    header.className = 'canvas-el-storyboard-header';
    header.appendChild(createCanvasPreviewText(element.name || '分镜生成', 'canvas-el-card-title'));
    header.appendChild(createCanvasPreviewText(`${element.shots.length} 个镜头`, 'canvas-el-card-meta'));
    card.appendChild(header);

    const parameters = document.createElement('div');
    parameters.className = 'canvas-el-storyboard-parameters';
    [
        ['模型', generationConfig.model_id || '未设置'],
        ['画面比例', resolveCanvasStoryboardAspectRatio(generationConfig)],
        ['分辨率', generationConfig.resolution || generationConfig.size || '未设置'],
    ].forEach(([label, value]) => {
        const parameter = document.createElement('div');
        parameter.className = 'canvas-el-storyboard-parameter';
        parameter.appendChild(createCanvasPreviewText(label, 'canvas-el-storyboard-parameter-label'));
        parameter.appendChild(createCanvasPreviewText(value, 'canvas-el-storyboard-parameter-value'));
        parameters.appendChild(parameter);
    });
    card.appendChild(parameters);

    card.appendChild(createCanvasPreviewText('分镜列表', 'canvas-el-storyboard-list-title'));

    const list = document.createElement('ol');
    list.className = 'canvas-el-storyboard-shot-list';
    element.shots.forEach((shot, index) => {
        const item = document.createElement('li');
        item.className = 'canvas-el-storyboard-shot';
        const shotHeader = document.createElement('div');
        shotHeader.className = 'canvas-el-storyboard-shot-header';
        shotHeader.appendChild(createCanvasPreviewText(`镜头 ${index + 1}`, 'canvas-el-storyboard-shot-title'));
        shotHeader.appendChild(createCanvasPreviewText(
            Number.isFinite(shot?.durationSeconds) ? `${shot.durationSeconds} 秒` : '时长未设置',
            'canvas-el-storyboard-shot-duration',
        ));
        item.appendChild(shotHeader);
        item.appendChild(createCanvasPreviewText(
            shot?.description || shot?.id || '暂无画面描述',
            'canvas-el-storyboard-shot-description',
        ));
        list.appendChild(item);
    });
    if (!element.shots.length) {
        list.appendChild(createCanvasPreviewText('暂无分镜', 'canvas-el-card-detail'));
    }
    card.appendChild(list);
    return card;
}

/** 创建视频编辑节点的只读输入轨道和输出规格。 */
function createCanvasVideoEditCard(element) {
    const card = document.createElement('div');
    card.className = 'canvas-el-video-edit-card';
    card.appendChild(createCanvasPreviewText(element.name || '视频编辑', 'canvas-el-card-title'));

    const surface = document.createElement('div');
    surface.className = 'canvas-el-video-edit-surface';
    [
        ['视频片段', element.videoSequence.length, 'video'],
        ['音频轨道', element.audioSequence.length, 'audio'],
    ].forEach(([label, count, type]) => {
        const track = document.createElement('div');
        track.className = `canvas-el-video-edit-track canvas-el-video-edit-track-${type}`;
        track.appendChild(createCanvasPreviewText(label, 'canvas-el-video-edit-track-label'));
        const clips = document.createElement('div');
        clips.className = 'canvas-el-video-edit-clips';
        const visibleCount = Math.min(Math.max(Number(count), 1), 6);
        for (let index = 0; index < visibleCount; index += 1) {
            const clip = document.createElement('span');
            clip.className = 'canvas-el-video-edit-clip';
            if (!count) clip.classList.add('is-empty');
            clips.appendChild(clip);
        }
        track.appendChild(clips);
        track.appendChild(createCanvasPreviewText(`${count} 个`, 'canvas-el-video-edit-track-count'));
        surface.appendChild(track);
    });
    card.appendChild(surface);

    return card;
}

/** 创建音频节点的只读波形摘要。 */
function createCanvasAudioCard(element, available) {
    const card = document.createElement('div');
    card.className = 'canvas-el-audio-card';
    const waveform = document.createElement('div');
    waveform.className = 'canvas-el-audio-waveform';
    const heights = [34, 58, 42, 76, 52, 88, 46, 70, 38, 62, 82, 44, 66, 50, 74, 36];
    heights.forEach(height => {
        const bar = document.createElement('span');
        bar.style.height = `${height}%`;
        waveform.appendChild(bar);
    });
    card.appendChild(waveform);
    card.appendChild(createCanvasPreviewText(element.name, 'canvas-el-card-title'));
    card.appendChild(createCanvasPreviewText(
        available ? '音频资源已就绪，点击可播放' : '音频文件不可用',
        'canvas-el-card-detail',
    ));
    return card;
}

/** 创建未提供专用渲染器的结构化业务节点卡片。 */
function createCanvasStructuredCard(element) {
    const card = document.createElement('div');
    card.className = `canvas-el-structured-card canvas-el-${element.type}`;
    card.appendChild(createCanvasPreviewText(element.name, 'canvas-el-card-title'));
    card.appendChild(createCanvasPreviewText(element.type, 'canvas-el-card-meta'));
    return card;
}

/** 按 V3 富文本段落和文本节点创建只读内容。 */
function createCanvasRichTextContent(element) {
    const root = document.createElement('div');
    root.className = 'canvas-el-text-content';
    const paragraphs = Array.isArray(element.content) ? element.content : [];
    const defaultStyle = element.defaultStyle || {};
    const sourceParagraphs = paragraphs.length ? paragraphs : [{ children: [{ text: element.name || '' }] }];
    sourceParagraphs.forEach(paragraph => {
        const paragraphNode = document.createElement('div');
        paragraphNode.className = 'canvas-el-text-paragraph';
        paragraphNode.style.textAlign = paragraph?.style?.textAlign || 'left';
        if (Number.isFinite(paragraph?.style?.lineHeight)) {
            paragraphNode.style.lineHeight = String(paragraph.style.lineHeight);
        }
        if (Number.isFinite(paragraph?.style?.paragraphSpacing)) {
            paragraphNode.style.marginBottom = `${paragraph.style.paragraphSpacing}px`;
        }
        const children = Array.isArray(paragraph?.children)
            ? paragraph.children
            : [{ text: paragraph?.text || '' }];
        children.forEach(child => {
            const textNode = document.createElement('span');
            const style = { ...defaultStyle, ...(child?.style || {}) };
            textNode.textContent = child?.text || '';
            textNode.style.fontSize = `${Number(style.fontSize) || 16}px`;
            textNode.style.fontFamily = style.fontFamily || 'system-ui, -apple-system, sans-serif';
            textNode.style.fontWeight = style.fontWeight || (style.bold ? '700' : '400');
            textNode.style.fontStyle = style.italic ? 'italic' : 'normal';
            textNode.style.color = style.color || '#111827';
            textNode.style.backgroundColor = style.backgroundColor || 'transparent';
            textNode.style.letterSpacing = Number.isFinite(style.letterSpacing)
                ? `${style.letterSpacing}px`
                : 'normal';
            const decorations = [];
            if (style.underline) decorations.push('underline');
            if (style.strikethrough) decorations.push('line-through');
            textNode.style.textDecoration = decorations.join(' ') || 'none';
            paragraphNode.appendChild(textNode);
        });
        root.appendChild(paragraphNode);
    });
    return root;
}

/**
 * 创建视频节点的可播放封面卡片。
 */
function createCanvasVideoCard(posterBlobUrl, name, videoBlobUrl = null) {
    const card = document.createElement('div');
    card.className = 'canvas-el-video-card';
    if (posterBlobUrl) {
        const image = document.createElement('img');
        image.src = posterBlobUrl;
        image.alt = name || '';
        card.appendChild(image);
    } else if (videoBlobUrl) {
        // Canvas 抓帧受跨域策略或编码格式影响时，直接使用视频元素作为预览兜底。
        const video = document.createElement('video');
        video.src = videoBlobUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.controls = false;
        video.setAttribute('aria-hidden', 'true');
        video.addEventListener('loadedmetadata', () => {
            try {
                video.currentTime = 0.01;
            } catch {
                // 某些视频在元数据加载后仍不允许主动定位，保留浏览器默认首帧。
            }
        });
        card.appendChild(video);
    }
    const overlay = document.createElement('div');
    overlay.className = 'canvas-el-video-overlay';
    const playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    playIcon.setAttribute('viewBox', '0 0 24 24');
    playIcon.className = 'canvas-el-video-play-icon';
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '12');
    circle.setAttribute('fill', 'rgba(0,0,0,0.5)');
    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    triangle.setAttribute('points', '9.5,7 18,12 9.5,17');
    triangle.setAttribute('fill', 'white');
    playIcon.appendChild(circle);
    playIcon.appendChild(triangle);
    overlay.appendChild(playIcon);
    if (!posterBlobUrl) {
        overlay.appendChild(createCanvasPreviewText(name, 'canvas-el-video-name'));
    }
    card.appendChild(overlay);
    return card;
}

/**
 * 渲染单个归一化节点正文，并为媒体节点绑定预览交互。
 */
async function renderCanvasElementBody(element, resolveMediaUrl, body) {
    if (element.status === 'pending' || element.status === 'processing') {
        body.classList.add('canvas-el-state', element.type === 'video' ? 'canvas-el-video-processing' : 'canvas-el-processing');
        if (element.type === 'video') {
            const loading = document.createElement('span');
            loading.className = 'canvas-el-video-loading-icon';
            body.appendChild(loading);
        }
        body.appendChild(createCanvasPreviewText(element.status === 'pending' ? '等待处理' : '处理中'));
        return;
    }
    if (element.status === 'failed') {
        body.classList.add('canvas-el-state', 'canvas-el-failed');
        body.appendChild(createCanvasPreviewText(element.errorMessage || '生成失败'));
        return;
    }
    if ((element.type === 'image' || element.type === 'video')
        && element.status === 'completed' && !element.src) {
        body.classList.add('canvas-el-state', 'canvas-el-completed-pending-resource');
        body.appendChild(createCanvasPreviewText('已完成，等待文件落盘'));
        return;
    }
    if (element.type === 'video') {
        const posterBlobUrl = element.poster ? await resolveMediaUrl(element.poster) : null;
        const videoBlobUrl = element.src ? await resolveMediaUrl(element.src) : null;
        if (!posterBlobUrl && !videoBlobUrl) {
            body.classList.add('canvas-el-state', 'canvas-el-missing');
            body.appendChild(createCanvasPreviewText('视频文件不可用'));
            return;
        }
        let thumbnailUrl = posterBlobUrl;
        if (!thumbnailUrl && videoBlobUrl) thumbnailUrl = await captureVideoFrame(videoBlobUrl);
        body.appendChild(createCanvasVideoCard(thumbnailUrl, element.name, thumbnailUrl ? null : videoBlobUrl));
        if (videoBlobUrl || thumbnailUrl) {
            body.closest('.canvas-preview-element').classList.add('is-interactive');
            body.addEventListener('click', () => openCanvasMediaModal(
                'video',
                videoBlobUrl,
                thumbnailUrl,
                element.name,
            ));
        }
        return;
    }
    if (element.type === 'image') {
        const imageBlobUrl = element.src ? await resolveMediaUrl(element.src) : null;
        if (imageBlobUrl) {
            const image = document.createElement('img');
            image.className = 'canvas-el-image';
            image.src = imageBlobUrl;
            image.alt = element.name;
            image.addEventListener('error', () => {
                body.innerHTML = '';
                body.classList.add('canvas-el-state', 'canvas-el-missing');
                body.appendChild(createCanvasPreviewText('图片文件不可用'));
            });
            body.appendChild(image);
            body.closest('.canvas-preview-element').classList.add('is-interactive');
            body.addEventListener('click', () => openCanvasMediaModal('image', imageBlobUrl, null, element.name));
        } else {
            body.classList.add('canvas-el-state', 'canvas-el-missing');
            body.appendChild(createCanvasPreviewText('图片文件不可用'));
        }
        return;
    }
    if (element.type === 'audio') {
        const audioBlobUrl = element.src ? await resolveMediaUrl(element.src) : null;
        body.appendChild(createCanvasAudioCard(element, Boolean(audioBlobUrl)));
        if (audioBlobUrl) {
            body.closest('.canvas-preview-element').classList.add('is-interactive');
            body.addEventListener('click', () => openCanvasMediaModal('audio', audioBlobUrl, null, element.name));
        }
        return;
    }
    if (element.type === 'text') {
        body.classList.add('canvas-el-text');
        body.appendChild(createCanvasRichTextContent(element));
        return;
    }
    if (element.type === 'storyboard') {
        body.appendChild(createCanvasStoryboardCard(element));
        return;
    }
    if (element.type === 'video-edit') {
        body.appendChild(createCanvasVideoEditCard(element));
        return;
    }
    if (['rectangle', 'ellipse', 'triangle', 'star', 'frame', 'group'].includes(element.type)) {
        const shape = document.createElement('div');
        shape.className = `canvas-el-shape canvas-el-shape-${element.type}`;
        shape.style.background = element.fill || (element.type === 'frame' ? '#fff' : 'transparent');
        shape.style.border = element.strokeWidth && element.stroke
            ? `${element.strokeWidth}px solid ${element.stroke}`
            : element.type === 'frame' ? '1px solid rgba(17, 24, 39, 0.14)' : 'none';
        shape.style.borderRadius = element.type === 'ellipse'
            ? '50%'
            : `${element.cornerRadius || 0}px`;
        if (element.type === 'triangle') {
            shape.style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)';
        }
        if (element.type === 'star') {
            shape.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        }
        body.appendChild(shape);
        return;
    }
    body.appendChild(createCanvasStructuredCard(element));
}

/**
 * 在 containerEl 内渲染已归一化的三版本画布预览。
 */
async function renderCanvasView(preview, resolveMediaUrl, containerEl, options = {}) {
    const {
        showLabels = true,
        preserveCanvasOrigin = false,
        fitMode = 'contain',
        onScaleChange = null,
    } = options;
    const elements = preview?.elements ?? [];
    if (!elements.length) {
        appendPreviewMessage(containerEl, '画布中没有元素。');
        return;
    }

    let minX = preserveCanvasOrigin ? 0 : Infinity;
    let minY = preserveCanvasOrigin ? 0 : Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const element of elements) {
        const bounds = element.layout?.worldBounds || {
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
        };
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
    }
    const canvasW = Math.max(1, maxX - minX);
    const canvasH = Math.max(1, maxY - minY);

    const scaleWrap = document.createElement('div');
    scaleWrap.className = 'canvas-preview-scale-wrap';
    containerEl.appendChild(scaleWrap);

    const space = document.createElement('div');
    space.className = 'canvas-preview-space';
    space.style.width = `${canvasW}px`;
    space.style.height = `${canvasH}px`;
    scaleWrap.appendChild(space);

    const elementById = new Map(elements.map(element => [element.id, element]));
    const elementNodeById = new Map();
    renderCanvasConnections(
        space,
        preview.connections,
        elementById,
        minX,
        minY,
        canvasW,
        canvasH,
    );

    const sorted = [...elements].sort((left, right) => left.zIndex - right.zIndex);
    await Promise.all(sorted.map(async (element) => {
        const elementNode = document.createElement('div');
        elementNode.className = 'canvas-preview-element';
        elementNode.dataset.elementId = element.id;
        elementNode.dataset.elementType = element.type;
        const layout = element.layout || {
            matrix: { a: 1, b: 0, c: 0, d: 1, e: element.x, f: element.y },
            worldOrigin: { x: element.x, y: element.y },
            worldBounds: { x: element.x, y: element.y, width: element.width, height: element.height },
            width: element.width,
            height: element.height,
        };
        elementNode.style.left = `${layout.worldOrigin.x - minX}px`;
        elementNode.style.top = `${layout.worldOrigin.y - minY}px`;
        elementNode.style.width = `${layout.width}px`;
        elementNode.style.height = `${layout.height}px`;
        elementNode.style.transformOrigin = 'top left';
        const localMatrix = createCanvasPreviewLocalMatrix(element);
        elementNode.style.transform = `matrix(${localMatrix.a}, ${localMatrix.b}, ${localMatrix.c}, ${localMatrix.d}, 0, 0)`;
        elementNode.style.zIndex = String(element.zIndex + 1);
        elementNode.title = `${element.name}\n${element.id}`;
        if (!element.visible) elementNode.classList.add('is-hidden');
        if (element.locked) elementNode.classList.add('is-locked');

        let body = document.createElement('div');
        body.className = 'canvas-el-body';
        elementNode.appendChild(body);

        let infoButton = null;

        /** 根据当前 Content 是否有生成请求同步详情入口。 */
        const syncGenerationInfoButton = () => {
            if (!infoButton) return;
            const hasCurrentRequest = Boolean(getCanvasGenerationRequest(element));
            infoButton.style.display = hasCurrentRequest ? '' : 'none';
            if (!hasCurrentRequest) infoButton.classList.remove('is-active');
        };

        /** 使用当前或指定 Content 重新渲染节点正文和已打开的生成详情。 */
        const renderSelectedContent = async selectedContent => {
            if (selectedContent) applyCanvasPreviewContent(element, selectedContent);
            elementNode.classList.remove('is-interactive');
            const nextBody = document.createElement('div');
            nextBody.className = 'canvas-el-body';
            body.replaceWith(nextBody);
            body = nextBody;
            await renderCanvasElementBody(element, resolveMediaUrl, body);
            syncGenerationInfoButton();

            const detailPanel = containerEl.querySelector('.canvas-generation-detail-panel');
            if (detailPanel?.dataset.elementId !== element.id) return;
            const currentRequest = getCanvasGenerationRequest(element);
            if (!currentRequest) {
                detailPanel.remove();
                return;
            }
            await renderCanvasGenerationDetailPanel(
                element,
                currentRequest,
                resolveMediaUrl,
                containerEl,
                elementNode,
                () => infoButton?.classList.remove('is-active'),
            );
        };

        if (showLabels) {
            const footer = document.createElement('div');
            footer.className = 'canvas-el-footer';
            const identity = document.createElement('div');
            identity.className = 'canvas-el-identity';
            identity.appendChild(createCanvasPreviewText(element.type, 'canvas-el-type'));
            identity.appendChild(createCanvasPreviewText(element.name, 'canvas-el-name'));
            footer.appendChild(identity);
            if (element.contentCount > 1) {
                footer.appendChild(createCanvasPreviewText(`${element.contentCount} 个版本`, 'canvas-el-version-count'));
            }
            elementNode.appendChild(footer);
        } else {
            elementNode.classList.add('canvas-preview-element-readonly');
        }
        if (element.type === 'image') {
            elementNode.classList.add('canvas-preview-image-with-metadata');
            elementNode.appendChild(createCanvasImageTopMetadata(element));
        }
        if (elements.some(child => child.parentId === element.id)) {
            const childrenLayer = document.createElement('div');
            childrenLayer.className = 'canvas-el-children-layer';
            childrenLayer.setAttribute('aria-hidden', 'true');
            elementNode.appendChild(childrenLayer);
        }
        infoButton = createCanvasGenerationInfoButton(element, () => {
            const existingPanel = containerEl.querySelector('.canvas-generation-detail-panel');
            if (existingPanel?.dataset.elementId === element.id) {
                existingPanel.remove();
                infoButton?.classList.remove('is-active');
                return;
            }
            const currentRequest = getCanvasGenerationRequest(element);
            if (!currentRequest) return;
            containerEl.querySelectorAll('.canvas-generation-detail-panel').forEach(panel => panel.remove());
            containerEl.querySelectorAll('.canvas-generation-info-button.is-active').forEach(button => {
                button.classList.remove('is-active');
            });
            infoButton?.classList.add('is-active');
            void renderCanvasGenerationDetailPanel(
                element,
                currentRequest,
                resolveMediaUrl,
                containerEl,
                elementNode,
                () => infoButton?.classList.remove('is-active'),
            );
        });
        if (infoButton) elementNode.appendChild(infoButton);
        const versionSwitcher = createCanvasContentVersionSwitcher(
            element,
            selectedContent => renderSelectedContent(selectedContent),
            { external: element.type === 'image' },
        );
        if (versionSwitcher) elementNode.appendChild(versionSwitcher);
        elementNode.style.opacity = String(element.opacity);
        elementNodeById.set(element.id, elementNode);
        await renderSelectedContent(null);
    }));

    // 先完成所有节点渲染，再按 magic-web 的父子关系挂载到对应 Group。
    for (const element of elements) {
        const elementNode = elementNodeById.get(element.id);
        if (!elementNode) continue;
        const parentNode = element.parentId ? elementNodeById.get(element.parentId) : null;
        const parentLayer = parentNode?.querySelector(':scope > .canvas-el-children-layer');
        if (parentLayer) parentLayer.appendChild(elementNode);
        else space.appendChild(elementNode);

        const isRoot = !parentLayer;
        elementNode.style.left = `${isRoot ? element.x - minX : element.x}px`;
        elementNode.style.top = `${isRoot ? element.y - minY : element.y}px`;
    }

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const minimumScale = 0.04;
    const maximumScale = 2;
    let currentScale = null;
    let currentFitMode = fitMode;
    let panX = 0;
    let panY = 0;
    let baseSpaceLeft = 0;
    let baseSpaceTop = 0;

    /** 使用独立平移偏移更新画布位置，即使视口没有滚动条也可以移动。 */
    const applyCanvasPan = () => {
        space.style.left = `${baseSpaceLeft + panX}px`;
        space.style.top = `${baseSpaceTop + panY}px`;
    };

    /** 把缩放后的内容中心定位到当前只读视口中心。 */
    const centerViewport = (wrapWidth, wrapHeight) => {
        requestAnimationFrame(() => {
            containerEl.scrollLeft = Math.max(0, (wrapWidth - containerEl.clientWidth) / 2);
            containerEl.scrollTop = Math.max(0, (wrapHeight - containerEl.clientHeight) / 2);
        });
    };

    /** 按当前视口或手工比例重新计算画布缩放，不改变文档中的真实坐标和尺寸。 */
    const applyViewportScale = (shouldCenter = false) => {
        const viewportPadding = 24;
        const availableWidth = Math.max(1, containerEl.clientWidth - viewportPadding);
        const availableHeight = Math.max(1, containerEl.clientHeight - viewportPadding);
        const widthScale = availableWidth / canvasW;
        const heightScale = availableHeight / canvasH;
        const containScale = Math.min(widthScale, heightScale);
        const requestedScale = currentFitMode === 'manual' && Number.isFinite(currentScale)
            ? currentScale
            : currentFitMode === 'width'
            ? widthScale
            : currentFitMode === 'cover' ? Math.max(widthScale, heightScale) : containScale;
        const scale = Math.max(minimumScale, Math.min(maximumScale, requestedScale));
        currentScale = scale;
        const scaledWidth = Math.ceil(canvasW * scale);
        const scaledHeight = Math.ceil(canvasH * scale);
        const metadataGutter = Math.ceil(40 * scale);
        const wrapPadding = viewportPadding + metadataGutter * 2;
        const wrapWidth = Math.max(containerEl.clientWidth, scaledWidth + wrapPadding);
        const wrapHeight = Math.max(containerEl.clientHeight, scaledHeight + wrapPadding);
        scaleWrap.style.width = `${wrapWidth}px`;
        scaleWrap.style.height = `${wrapHeight}px`;
        space.style.position = 'absolute';
        baseSpaceLeft = Math.max(
            viewportPadding / 2 + metadataGutter,
            (wrapWidth - scaledWidth) / 2,
        );
        baseSpaceTop = Math.max(
            viewportPadding / 2 + metadataGutter,
            (wrapHeight - scaledHeight) / 2,
        );
        applyCanvasPan();
        space.style.transformOrigin = 'top left';
        space.style.transform = `scale(${scale})`;
        if (typeof onScaleChange === 'function') onScaleChange(scale);
        if (shouldCenter) centerViewport(wrapWidth, wrapHeight);
    };
    applyViewportScale(true);

    /** 切换到手工缩放，同时保持当前视口中心对应的画布位置不变。 */
    const applyManualScale = nextScale => {
        const previousScale = currentScale || 1;
        const previousLeft = Number.parseFloat(space.style.left) || 0;
        const previousTop = Number.parseFloat(space.style.top) || 0;
        const focalX = (containerEl.scrollLeft + containerEl.clientWidth / 2 - previousLeft) / previousScale;
        const focalY = (containerEl.scrollTop + containerEl.clientHeight / 2 - previousTop) / previousScale;
        currentFitMode = 'manual';
        currentScale = Math.max(minimumScale, Math.min(maximumScale, nextScale));
        applyViewportScale(false);
        requestAnimationFrame(() => {
            const nextLeft = Number.parseFloat(space.style.left) || 0;
            const nextTop = Number.parseFloat(space.style.top) || 0;
            containerEl.scrollLeft = Math.max(
                0,
                nextLeft + focalX * currentScale - containerEl.clientWidth / 2,
            );
            containerEl.scrollTop = Math.max(
                0,
                nextTop + focalY * currentScale - containerEl.clientHeight / 2,
            );
        });
    };

    const zoomController = {
        /** 按固定步长放大画布视图。 */
        zoomIn() {
            applyManualScale((currentScale || 1) * 1.2);
        },
        /** 按固定步长缩小画布视图。 */
        zoomOut() {
            applyManualScale((currentScale || 1) / 1.2);
        },
        /** 恢复为画布元素的真实尺寸。 */
        resetToActualSize() {
            applyManualScale(1);
        },
        /** 重新适配并居中展示全部元素。 */
        fitAll() {
            currentFitMode = 'contain';
            currentScale = null;
            panX = 0;
            panY = 0;
            applyViewportScale(true);
        },
        /** 清除所有视图偏移，并恢复默认的居中全览状态。 */
        resetView() {
            currentFitMode = 'contain';
            currentScale = null;
            panX = 0;
            panY = 0;
            containerEl.scrollLeft = 0;
            containerEl.scrollTop = 0;
            applyViewportScale(true);
        },
    };

    /** 使用 Command/Ctrl 与滚轮缩放只读画布，普通滚轮仍用于视口滚动。 */
    const handleCanvasZoomWheel = event => {
        if (!event.metaKey && !event.ctrlKey) return;
        event.preventDefault();
        if (event.deltaY < 0) zoomController.zoomIn();
        else if (event.deltaY > 0) zoomController.zoomOut();
    };
    containerEl.addEventListener('wheel', handleCanvasZoomWheel, { passive: false });

    let panSession = null;
    let suppressClickUntil = 0;
    containerEl.classList.add('canvas-preview-pan-enabled');

    /** 判断目标是否是应保留自身交互、不能触发画布拖动的控件。 */
    const isCanvasPanControl = target => target instanceof Element && Boolean(target.closest(
        'button, a, input, textarea, select, audio, video, .canvas-el-version-switcher',
    ));

    /** 开始记录指针位置，实际移动超过阈值后才视为拖动画布。 */
    const handleCanvasPanStart = event => {
        if ((event.pointerType === 'mouse' && event.button !== 0) || isCanvasPanControl(event.target)) return;
        panSession = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startPanX: panX,
            startPanY: panY,
            moved: false,
            captured: false,
        };
    };

    /** 根据指针位移平移画布，不依赖容器是否存在滚动范围。 */
    const handleCanvasPanMove = event => {
        if (!panSession || panSession.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - panSession.startX;
        const deltaY = event.clientY - panSession.startY;
        if (!panSession.moved && Math.hypot(deltaX, deltaY) < 4) return;
        if (!panSession.moved) {
            panSession.moved = true;
            try {
                containerEl.setPointerCapture?.(event.pointerId);
                panSession.captured = true;
            } catch (_) {
                panSession.captured = false;
            }
        }
        panX = panSession.startPanX + deltaX;
        panY = panSession.startPanY + deltaY;
        applyCanvasPan();
        containerEl.classList.add('is-canvas-panning');
        event.preventDefault();
    };

    /** 结束拖动，并短暂拦截拖动结束后浏览器合成的 click 事件。 */
    const handleCanvasPanEnd = event => {
        if (!panSession || panSession.pointerId !== event.pointerId) return;
        if (panSession.moved) suppressClickUntil = performance.now() + 250;
        const shouldReleasePointer = panSession.captured;
        panSession = null;
        containerEl.classList.remove('is-canvas-panning');
        if (shouldReleasePointer) {
            try {
                containerEl.releasePointerCapture?.(event.pointerId);
            } catch (_) {
                // 指针取消时浏览器可能已经自动释放捕获，无需额外处理。
            }
        }
    };

    containerEl.addEventListener('pointerdown', handleCanvasPanStart);
    containerEl.addEventListener('pointermove', handleCanvasPanMove);
    containerEl.addEventListener('pointerup', handleCanvasPanEnd);
    containerEl.addEventListener('pointercancel', handleCanvasPanEnd);
    containerEl.addEventListener('click', event => {
        if (performance.now() >= suppressClickUntil) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
    containerEl.addEventListener('dragstart', event => {
        if (event.target instanceof Element && event.target.closest('img')) event.preventDefault();
    });

    if (typeof ResizeObserver !== 'undefined') {
        currentCanvasPreviewResizeObserver?.disconnect();
        currentCanvasPreviewResizeObserver = new ResizeObserver(() => {
            applyViewportScale(currentFitMode !== 'manual');
        });
        currentCanvasPreviewResizeObserver.observe(containerEl);
    }
    return zoomController;
}

/**
 * 创建画布右侧面板外壳，并返回统一预览文档和视口。
 */
function createCanvasRightPanel(config, filePath) {
    if (!filePreviewMain) return null;
    filePreviewMain.classList.add('has-canvas-panel');
    const oldPanel = document.getElementById('canvasRightPanel');
    if (oldPanel) oldPanel.remove();

    const preview = normalizeMagicProjectForPreview(config);

    const panel = document.createElement('div');
    panel.id = 'canvasRightPanel';
    panel.className = 'canvas-right-panel';
    const panelHeader = document.createElement('div');
    panelHeader.className = 'canvas-panel-header';
    const heading = document.createElement('div');
    heading.className = 'canvas-panel-heading';
    const titleEl = document.createElement('span');
    titleEl.className = 'canvas-panel-title';
    titleEl.textContent = config.name || filePath;
    const versionEl = document.createElement('span');
    versionEl.className = 'canvas-panel-version';
    versionEl.textContent = `V${String(preview.version || '').split('.')[0] || '?'}`;
    heading.appendChild(titleEl);
    heading.appendChild(versionEl);
    const summaryEl = document.createElement('span');
    summaryEl.className = 'canvas-panel-count';
    summaryEl.textContent = [
        `${preview.elements.length} 个节点`,
        `${preview.connections.length} 条连线`,
        preview.usesPreviewLayout ? '调试布局' : '原始布局',
    ].join(' · ');
    panelHeader.appendChild(heading);
    panelHeader.appendChild(summaryEl);
    panel.appendChild(panelHeader);
    const viewport = document.createElement('div');
    viewport.className = 'canvas-right-viewport';
    panel.appendChild(viewport);
    filePreviewMain.appendChild(panel);
    return { preview, viewport };
}

async function addCanvasRightPanel(config, filePath) {
    const panelState = createCanvasRightPanel(config, filePath);
    if (!panelState) return;

    // 获取项目目录并渲染画布
    const projectDirHandle = await getProjectDirHandle(filePath);
    if (!projectDirHandle) {
        appendPreviewMessage(panelState.viewport, '无法访问项目目录，请检查文件系统权限。');
        return;
    }
    const resolveMediaUrl = (relPath) => resolveCanvasFileBlobUrl(projectDirHandle, relPath);
    await renderCanvasView(panelState.preview, resolveMediaUrl, panelState.viewport);
}

async function addApiCanvasRightPanel(config, filePath) {
    const panelState = createCanvasRightPanel(config, filePath);
    if (!panelState) return;

    const projectDirPath = String(filePath || '').split('/').filter(Boolean).slice(0, -1).join('/');
    const resolveMediaUrl = async relPath => appendPreviewRefreshToken(
        debugWorkspaceApi.rawUrl(joinWorkspacePath(projectDirPath, relPath)),
    );
    await renderCanvasView(panelState.preview, resolveMediaUrl, panelState.viewport);
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
            const isCanvasProjectFile = isMagicProjectJs(filePath);
            const canvasConfig = isCanvasProjectFile ? await parseMagicProjectConfig(text) : null;
            if (isCanvasProjectFile && canvasConfig?.type === 'design' && canvasConfig.canvas) {
                renderMagicProjectCodePreview(text, canvasConfig, filePath);
                setFilePreviewMeta(file, filePath, 'canvas', [
                    { label: '数据视图', value: '解压后 JSON' },
                    { label: '原始行数', value: String(lineCount) },
                    { label: '原始字符数', value: String(text.length) },
                ]);
                updateFilePreviewEditActions();
            } else {
                currentPreviewCopyText = text;
                setFilePreviewMeta(file, filePath, kind, textExtras);
            }
            if (!isCanvasProjectFile && isMarkdownPreviewFile(filePath)) {
                const previewTab = filePreviewTabs.get(filePath);
                renderMarkdownFileMode(text, previewTab?.markdownMode || 'rendered', filePath);
            }
            if (!isCanvasProjectFile && !isMarkdownPreviewFile(filePath)) {
                const pre = document.createElement('pre');
                pre.className = 'file-preview-content';
                pre.textContent = text;
                filePreviewBody.appendChild(pre);
            }

            // magic.project.js：按顶层版本解析后，在右侧使用统一模型预览 V1/V2/V3。
        }

        setFilePreviewWorkbenchVisible(true);
    } catch (e) {
        console.error('读取文件失败', e);
    }
}

const FILE_TREE_ICON_PATHS = {
    folderClosed: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l1.7 2H18.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M4 9.5h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>',
    folderOpen: '<path d="M3.5 8.5a2 2 0 0 1 2-2h4l1.5 2h7.5a2 2 0 0 1 1.94 2.48l-1.45 5.8a2 2 0 0 1-1.94 1.52H5.18a2 2 0 0 1-1.95-2.44l1.25-5.55A2 2 0 0 1 6.43 8.5H20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>',
    microApp: '<path d="M4.5 5.5h15v11h-15v-11Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M8 19h8M10 16.5 9.3 19M14 16.5l.7 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M8 9h3v3H8V9Zm5 0h3v3h-3V9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"></path>',
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

function createFileTreeIcon(name, isDir, isOpen, options = {}) {
    const icon = document.createElement('span');
    icon.className = 'ft-icon';
    updateFileTreeIcon(icon, name, isDir, isOpen, options);
    return icon;
}

function updateFileTreeIcon(icon, name, isDir, isOpen, options = {}) {
    if (!icon) return;
    const iconType = options.microApp ? 'microApp' : (isDir ? (isOpen ? 'folderOpen' : 'folderClosed') : getFileIconType(name));
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
