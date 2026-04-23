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
const CHAT_LOG_MAX = 300; // 最多保留条数
let chatLog = [];         // 消息数据列表
let isRestoring = false;  // 恢复阶段不触发二次保存

function saveChatLog() {
    if (isRestoring) return;
    try {
        // 超出上限时丢弃最早的记录
        if (chatLog.length > CHAT_LOG_MAX) chatLog = chatLog.slice(-CHAT_LOG_MAX);
        localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(chatLog));
    } catch (e) {
        console.warn('保存对话记录失败:', e);
    }
}

function pushLog(entry) {
    chatLog.push(entry);
    saveChatLog();
}

function clearChatLog() {
    chatLog = [];
    localStorage.removeItem(CHAT_LOG_KEY);
}

function restoreChatLog() {
    try {
        const saved = localStorage.getItem(CHAT_LOG_KEY);
        if (!saved) return;
        chatLog = JSON.parse(saved);
    } catch (e) {
        chatLog = [];
        return;
    }
    isRestoring = true;
    for (const entry of chatLog) {
        renderLogEntry(entry);
    }
    isRestoring = false;
    scrollToBottom();
}

function renderLogEntry(entry) {
    switch (entry.type) {
        case 'client':    renderClientEntry(entry); break;
        case 'ai':        showAIMessage(entry.content, entry.timestamp, true); break;
        case 'thinking':  showThinkingMessage(entry.content, entry.timestamp, true); break;
        case 'tool_call': showToolCallMessage(entry.tool, entry.eventType, entry.timestamp, true); break;
        case 'event':     showEventLog(entry.data, true); break;
        case 'system':    showSystemMessage(entry.text, true); break;
    }
}

function renderClientEntry(entry) {
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
    header.textContent = headerText;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = entry.prompt;
    messageDiv.appendChild(header);
    messageDiv.appendChild(content);
    messageList.appendChild(messageDiv);
}

// 定义示例文本常量
const EXAMPLE_TEXT = "我需要4月15日至23日从广东出发的北京7天行程，我和未婚妻的预算是2500-5000人民币。我们喜欢历史遗迹、隐藏的宝石和中国文化。我们想看看北京的长城，徒步探索城市。我打算在这次旅行中求婚，需要一个特殊的地点推荐。请提供详细的行程和简单的HTML旅行手册，包括地图，景点描述，必要的旅行提示，我们可以在整个旅程中参考。";

// DOM 元素
const serverUrlInput = document.getElementById('serverUrl');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const followUpBtn = document.getElementById('followUpBtn');
const continueBtn = document.getElementById('continueBtn');
const interruptBtn = document.getElementById('interruptBtn');
const loadExampleBtn = document.getElementById('loadExampleBtn');
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
const imChannelSelect = document.getElementById('imChannelSelect');
const imUserIdInput = document.getElementById('imUserIdInput');

// 初始化配置折叠面板
const configPanelToggle = document.getElementById('configPanelToggle');
const configPanelBody = document.getElementById('configPanelBody');
const configPanelArrow = document.getElementById('configPanelArrow');
if (configPanelToggle) {
    // 默认展开
    configPanelArrow.classList.add('open');
    configPanelToggle.addEventListener('click', () => {
        const isOpen = configPanelBody.style.display !== 'none';
        configPanelBody.style.display = isOpen ? 'none' : 'block';
        configPanelArrow.classList.toggle('open', !isOpen);
    });
}

// 消息类型枚举
const MessageType = {
    CHAT: "chat",
    INIT: "init"
};

// 上下文类型枚举
const ContextType = {
    NORMAL: "normal",
    FOLLOW_UP: "follow_up",
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

    let isResizingSidebar = false;
    let startX;
    let startWidth;

    // 从 localStorage 恢复侧边栏宽度
    const savedSidebarWidth = localStorage.getItem('sidebarWidth');
    if (savedSidebarWidth) {
        sidebar.style.width = savedSidebarWidth + 'px';
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

        if (isResizingInput) {
            // 向上拖拽是增加高度，所以是减去差值
            const newHeight = startHeight - (e.clientY - startY);
            // 限制最小和最大高度
            if (newHeight > 180 && newHeight < window.innerHeight * 0.8) {
                inputPanel.style.height = newHeight + 'px';
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

        if (isResizingInput) {
            isResizingInput = false;
            inputResizer.classList.remove('resizing');
            document.body.style.cursor = '';
            // 保存到 localStorage
            localStorage.setItem('inputHeight', inputPanel.style.height.replace('px', ''));
        }
    });
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
    // 初始化拖拽功能
    initResizers();

    // 初始化快捷键提示
    initSendHint();

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

    // 追问按钮事件
    followUpBtn.addEventListener('click', () => sendMessage(ContextType.FOLLOW_UP));

    // 继续按钮事件
    continueBtn.addEventListener('click', () => sendContinue());

    // 中断按钮事件
    interruptBtn.addEventListener('click', () => sendInterrupt());

    // 清除对话按钮事件
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            showConfirmDialog('确定要清除所有对话消息吗？', () => {
                clearChatLog();
                messageList.innerHTML = '';
                showSystemMessage('对话已清除');
            });
        });
    }

    // 加载示例文本按钮事件
    loadExampleBtn.addEventListener('click', loadExampleText);

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
        languageSelect.addEventListener('change', changeLanguage);
    }

    // 消息版本切换事件
    if (messageVersionSelect) {
        const savedVersion = localStorage.getItem('selectedMessageVersion');
        if (savedVersion !== null) {
            currentMessageVersion = savedVersion;
            messageVersionSelect.value = savedVersion;
        }
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
        console.log("找到历史按钮，添加事件监听");
        historyButton.addEventListener('click', function (e) {
            console.log("历史按钮被点击");
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
    }
    const imageModelGroup = document.getElementById('imageModelGroup');
    if (imageModelGroup) imageModelGroup.style.display = 'none';

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
        await sendHttpMessage(messageData);
        scrollToBottom();
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

    // 清空输入框
    messageInput.value = '';

    // 保存到历史记录
    saveMessageToHistory(message);

    // 发送HTTP请求
    await sendHttpMessage(chatMessage);

    // 滚动到底部
    scrollToBottom();
}

// 发送中断消息
async function sendInterrupt() {
    const interruptMessage = createChatMessage("", ContextType.INTERRUPT, "用户中断");

    // 显示客户端消息
    showClientMessage({
        ...interruptMessage,
        prompt: "[中断任务]"
    });

    // 发送HTTP请求
    await sendHttpMessage(interruptMessage);
}

// 发送继续消息
async function sendContinue() {
    const continueMessage = {
        message_id: generateTimestampId(),
        type: "continue"
    };

    // 显示客户端消息
    showClientMessage({
        type: "continue",
        prompt: "[继续]"
    });

    // 发送HTTP请求
    await sendHttpMessage(continueMessage);

    // 显示系统消息
    showSystemMessage("继续请求已发送");
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

        // 显示客户端消息
        showClientMessage({
            type: MessageType.INIT,
            prompt: "[初始化工作区]"
        });

        showSystemMessage("正在发送工作区初始化消息...");

        // 发送HTTP请求
        await sendHttpMessage(configData);
    } catch (error) {
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
    followUpBtn.disabled = !enabled;
    continueBtn.disabled = !enabled;
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
    });
    scrollToBottom();
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

    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(messageContent);
    messageList.appendChild(messageDiv);

    scrollToBottom();
}

// 显示系统消息
function showSystemMessage(text, _noLog = false) {
    if (!_noLog) pushLog({ type: 'system', text });
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = `[系统] ${text} (${new Date().toLocaleTimeString()})`;
    messageList.appendChild(messageDiv);
    scrollToBottom();
}

// 滚动到底部
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// 加载示例文本
function loadExampleText() {
    messageInput.value = EXAMPLE_TEXT;
    showSystemMessage("已加载示例文本");
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
        advancedFields.style.display = 'block';
        showSystemMessage("已切换到高级模式：粘贴完整 JSON 后点击「发送消息」");
    } else {
        normalFields.style.display = 'block';
        advancedFields.style.display = 'none';
        showSystemMessage("已切换到普通模式");
    }
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

// 显示历史消息
function showMessageHistory() {
    const dropdown = document.getElementById('messageHistoryDropdown');

    // 清空现有内容
    dropdown.innerHTML = '';

    if (messageHistory.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'history-item empty';
        emptyItem.textContent = '暂无历史消息';
        dropdown.appendChild(emptyItem);
        return;
    }

    // 添加清空按钮
    const clearButton = document.createElement('div');
    clearButton.className = 'history-item clear-all';
    clearButton.innerHTML = '<span>🗑️ 清空所有历史</span>';
    clearButton.addEventListener('click', function (e) {
        e.stopPropagation();
        showConfirmDialog('确定要清空所有历史消息吗？', function () {
            clearMessageHistory();
            toggleHistoryDropdown(false);
            showSystemMessage('历史消息已清空');
        });
    });
    dropdown.appendChild(clearButton);

    // 添加历史消息项
    messageHistory.forEach((historyMessage, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const messagePreview = historyMessage.length > 50 ?
            historyMessage.substring(0, 50) + '...' : historyMessage;

        historyItem.innerHTML = `
      <div class="history-message" title="${historyMessage}">
        ${messagePreview}
      </div>
      <div class="history-actions">
        <button class="history-btn edit" title="编辑">✏️</button>
        <button class="history-btn delete" title="删除">🗑️</button>
      </div>
    `;

        // 点击消息内容使用该消息
        const messageDiv = historyItem.querySelector('.history-message');
        messageDiv.addEventListener('click', function (e) {
            e.stopPropagation();
            messageInput.value = historyMessage;
            toggleHistoryDropdown(false);
            showSystemMessage('已加载历史消息');
        });

        // 编辑按钮
        const editBtn = historyItem.querySelector('.edit');
        editBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            editHistoryItem(index);
        });

        // 删除按钮
        const deleteBtn = historyItem.querySelector('.delete');
        deleteBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showConfirmDialog('确定要删除这条历史消息吗？', function () {
                deleteHistoryItem(index);
                showMessageHistory(); // 刷新显示
                showSystemMessage('历史消息已删除');
            });
        });

        dropdown.appendChild(historyItem);
    });
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

    // 创建编辑界面
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

    // 替换dropdown内容
    dropdown.innerHTML = '';
    dropdown.appendChild(editContainer);

    // 聚焦到textarea并选中文本
    textarea.focus();
    textarea.select();
}

// 切换历史下拉框显示
function toggleHistoryDropdown(show) {
    const dropdown = document.getElementById('messageHistoryDropdown');

    if (show) {
        dropdown.style.display = 'block';
        // 添加点击外部关闭的事件监听器
        setTimeout(() => {
            document.addEventListener('click', closeHistoryDropdownOnClickOutside);
        }, 100);
    } else {
        dropdown.style.display = 'none';
        // 移除事件监听器
        document.removeEventListener('click', closeHistoryDropdownOnClickOutside);
    }
}

// 点击外部关闭历史下拉框
function closeHistoryDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('messageHistoryDropdown');
    const historyBtn = document.getElementById('historyBtn');

    if (!dropdown.contains(event.target) && event.target !== historyBtn) {
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
        showSystemMessage("正在建立WebSocket连接...");

        websocket = new WebSocket(wsUrl);

        websocket.onopen = handleWebSocketOpen;
        websocket.onmessage = handleWebSocketMessage;
        websocket.onclose = handleWebSocketClose;
        websocket.onerror = handleWebSocketError;

    } catch (error) {
        showSystemMessage(`WebSocket连接失败: ${error.message}`);
        updateSubscribeButtonState('disconnected');
    }
}

function disconnectWebSocket() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    isWebSocketConnected = false;
    updateSubscribeButtonState('disconnected');
    showSystemMessage("WebSocket连接已断开");
}

function handleWebSocketOpen(event) {
    isWebSocketConnected = true;
    updateSubscribeButtonState('connected');
    showSystemMessage("WebSocket连接已建立，开始接收消息");
    // 通知所有等待连接的发送操作
    wsOpenCallbacks.splice(0).forEach(cb => cb.resolve());
}

function handleWebSocketMessage(event) {
    try {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (parseError) {
            showEventLog({ error: "无法解析JSON", raw_data: event.data });
            scrollToBottom();
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
                // 工具调用事件：before_tool_call 时先渲染思考块（如有），再渲染工具块
                // v2 新格式：tool 嵌入 tool_calls[i].tool（支持批量多个）；after 事件 tool 仍在顶层
                const smsgToolDirect = smsg.tool;
                const smsgToolsFromCalls = smsg.tool_calls
                    ? smsg.tool_calls.filter(tc => tc.tool).map(tc => tc.tool)
                    : [];
                const hasToolInfo = smsgToolDirect || smsgToolsFromCalls.length > 0;
                if (hasToolInfo && (eventType === 'before_tool_call' || eventType === 'after_tool_call')) {
                    if (eventType === 'before_tool_call' && smsg.reasoning_content) {
                        showThinkingMessage(smsg.reasoning_content, payload.send_timestamp);
                    }
                    if (eventType === 'before_tool_call' && smsg.content) {
                        showAIMessage(smsg.content, payload.send_timestamp);
                    }
                    // after 事件顶层 tool 优先；before 事件遍历 tool_calls 里所有带 tool 的条目
                    const toolsToRender = smsgToolDirect ? [smsgToolDirect] : smsgToolsFromCalls;
                    for (const t of toolsToRender) {
                        showToolCallMessage(t, eventType, payload.send_timestamp);
                    }
                } else if (smsg.role === 'assistant') {
                    if (smsg.reasoning_content) {
                        showThinkingMessage(smsg.reasoning_content, payload.send_timestamp);
                    }
                    if (smsg.content) {
                        showAIMessage(smsg.content, payload.send_timestamp);
                    }
                    if (!smsg.content && !smsg.reasoning_content) {
                        showEventLog(data);
                    }
                } else {
                    // role=tool 等其他角色（after_main_agent_run 等），折叠为事件日志
                    showEventLog(data);
                }
            } else {
                showEventLog(data);
            }
        } else if (eventType === 'after_agent_reply' && content) {
            // v1 消息格式
            if (contentType === 'content') {
                // AI 正式回复 → 白色气泡
                showAIMessage(content, payload.send_timestamp);
            } else if (contentType === 'reasoning') {
                // 思考过程 → 折叠的思考块
                showThinkingMessage(content, payload.send_timestamp);
            } else {
                showEventLog(data);
            }
        } else if (eventType === 'before_tool_call' || eventType === 'after_tool_call') {
            // 工具调用事件 → 紧凑的工具调用块，detail 默认折叠
            const tool = payload && payload.tool;
            if (tool) {
                showToolCallMessage(tool, eventType, payload.send_timestamp);
            } else {
                showEventLog(data);
            }
        } else {
            // 其余所有事件 → 折叠日志条目
            showEventLog(data);
        }
        scrollToBottom();
    } catch (error) {
        showSystemMessage(`处理WebSocket消息时出错: ${error.message}`);
    }
}

// 将文本片段用 marked 渲染为 markdown，marked 不可用时降级为纯文本
function renderMarkdown(text) {
    const div = document.createElement('div');
    div.className = 'ai-markdown';
    try {
        div.innerHTML = (typeof marked !== 'undefined')
            ? marked.parse(text)
            : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } catch (e) {
        div.textContent = text;
    }
    return div;
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

// 显示 AI 回复消息气泡，支持 markdown 渲染与原文切换
function showAIMessage(content, timestamp, _noLog = false) {
    if (!_noLog) pushLog({ type: 'ai', content, timestamp });

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

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ai-toggle-btn';
    toggleBtn.textContent = '原文';

    header.appendChild(headerText);
    header.appendChild(toggleBtn);
    messageDiv.appendChild(header);

    // 渲染视图（默认显示）
    const renderedView = document.createElement('div');
    renderedView.className = 'ai-rendered-view';
    renderedView.appendChild(buildRenderedView(content));

    // 原文视图（隐藏）
    const rawView = document.createElement('div');
    rawView.className = 'ai-raw-view';
    rawView.style.display = 'none';
    rawView.textContent = content;

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

    messageList.appendChild(messageDiv);
}

// 显示思考过程（折叠展示）
function showThinkingMessage(content, timestamp, _noLog = false) {
    if (!_noLog) pushLog({ type: 'thinking', content, timestamp });
    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    const wrapper = document.createElement('div');
    wrapper.className = 'thinking-block';

    const summary = document.createElement('div');
    summary.className = 'thinking-summary';
    summary.textContent = `▼ 思考过程 (${timeStr})`;
    summary.addEventListener('click', () => {
        const isHidden = detail.style.display === 'none';
        detail.style.display = isHidden ? 'block' : 'none';
        summary.textContent = (isHidden ? '▼' : '▶') + ` 思考过程 (${timeStr})`;
    });

    const detail = document.createElement('div');
    detail.className = 'thinking-detail';
    detail.textContent = content;

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    messageList.appendChild(wrapper);
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
function showToolCallMessage(tool, eventType, timestamp, _noLog = false) {
    if (!_noLog) pushLog({ type: 'tool_call', tool, eventType, timestamp });

    const timeStr = timestamp
        ? new Date(timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    const isRunning = tool.status === 'running';
    const action = tool.action || tool.name || '工具调用';
    const remark = tool.remark || '';
    const detail = tool.detail || null;

    const wrapper = document.createElement('div');
    wrapper.className = `tool-call-block ${isRunning ? 'tool-call-running' : 'tool-call-finished'}`;

    const header = document.createElement('div');
    header.className = 'tool-call-header';

    const statusDot = document.createElement('span');
    statusDot.className = 'tool-call-status-dot';

    const actionSpan = document.createElement('span');
    actionSpan.className = 'tool-call-action';
    actionSpan.textContent = action;

    header.appendChild(statusDot);
    header.appendChild(actionSpan);

    if (remark) {
        const remarkSpan = document.createElement('span');
        remarkSpan.className = 'tool-call-remark';
        remarkSpan.textContent = remark;
        header.appendChild(remarkSpan);
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'tool-call-time';
    timeSpan.textContent = timeStr;
    header.appendChild(timeSpan);

    wrapper.appendChild(header);

    if (detail) {
        // ask_user：渲染交互卡片
        if (detail.type === 'ask_user' && detail.data) {
            const qid = detail.data.question_id;
            if (eventType === 'after_tool_call' && qid && askUserCardRegistry.has(qid)) {
                // 已有卡片：就地更新状态，不新增 wrapper
                finalizeAskUserCard(askUserCardRegistry.get(qid), detail.data);
                return;
            }
            renderAskUserCard(detail.data, wrapper);
        } else {
            // 其余工具：折叠 JSON 详情
            const arrow = document.createElement('span');
            arrow.className = 'tool-call-arrow';
            arrow.textContent = '▶';
            header.appendChild(arrow);

            const detailEl = document.createElement('pre');
            detailEl.className = 'tool-call-detail';
            detailEl.style.display = 'none';
            detailEl.textContent = JSON.stringify(detail, null, 2);

            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const isHidden = detailEl.style.display === 'none';
                detailEl.style.display = isHidden ? 'block' : 'none';
                arrow.textContent = isHidden ? '▼' : '▶';
            });

            wrapper.appendChild(detailEl);
        }
    }

    messageList.appendChild(wrapper);
}

// 显示折叠的事件日志条目
function showEventLog(data, _noLog = false) {
    if (!_noLog) pushLog({ type: 'event', data });
    const payload = data && data.payload;
    const eventType = data.label || (payload && payload.event) || '未知事件';
    const timeStr = (payload && payload.send_timestamp)
        ? new Date(payload.send_timestamp * 1000).toLocaleTimeString()
        : new Date().toLocaleTimeString();

    const wrapper = document.createElement('div');
    wrapper.className = 'event-log';

    const summary = document.createElement('div');
    summary.className = 'event-log-summary';
    summary.textContent = `▶ [${timeStr}] ${eventType}`;
    summary.addEventListener('click', () => {
        detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
        summary.textContent = (detail.style.display === 'none' ? '▶' : '▼') + ` [${timeStr}] ${eventType}`;
    });

    const detail = document.createElement('pre');
    detail.className = 'event-log-detail';
    detail.style.display = 'none';
    detail.textContent = JSON.stringify(data, null, 2);

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    messageList.appendChild(wrapper);
}

function handleWebSocketClose(event) {
    isWebSocketConnected = false;
    updateSubscribeButtonState('disconnected');

    if (event.wasClean) {
        showSystemMessage("WebSocket连接正常关闭");
    } else {
        showSystemMessage(`WebSocket连接意外断开 (code: ${event.code})`);
    }
}

function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    wsOpenCallbacks.splice(0).forEach(cb => cb.reject(new Error('WebSocket连接失败')));

    // 根据错误类型提供不同的用户提示
    let errorMessage = "WebSocket连接发生错误";
    let suggestions = "";

    if (error.type === 'error') {
        errorMessage = "无法建立WebSocket连接";
        suggestions = "请检查服务器地址是否正确，服务器是否运行正常";
    }

    showSystemMessage(`${errorMessage}。${suggestions}`);
    updateSubscribeButtonState('error');
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
const filePreviewOverlay = document.getElementById('filePreviewOverlay');
const filePreviewName = document.getElementById('filePreviewName');
const filePreviewBody = document.getElementById('filePreviewBody');
const filePreviewMeta = document.getElementById('filePreviewMeta');
const filePreviewClose = document.getElementById('filePreviewClose');

/** 媒体/PDF 预览用的 blob URL，关闭或切换预览时需 revoke */
let filePreviewObjectUrl = null;

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
    revokeFilePreviewObjectUrl();
    revokeCanvasBlobUrls();
    const canvasPanel = document.getElementById('canvasRightPanel');
    if (canvasPanel) canvasPanel.remove();
    const canvasModal = document.getElementById('canvasMediaModal');
    if (canvasModal) canvasModal.remove();
    const dialog = filePreviewOverlay?.querySelector('.file-preview-dialog');
    if (dialog) dialog.classList.remove('has-canvas-panel');
    if (filePreviewMeta) filePreviewMeta.innerHTML = '';
    if (filePreviewOverlay) filePreviewOverlay.style.display = 'none';
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
    for (const row of rows) {
        if (!row) continue;
        const wrap = document.createElement('div');
        wrap.className = 'file-preview-meta-row';
        const lab = document.createElement('div');
        lab.className = 'file-preview-meta-label';
        lab.textContent = row.label;
        const val = document.createElement('div');
        val.className = 'file-preview-meta-value';
        val.textContent = row.value;
        wrap.appendChild(lab);
        wrap.appendChild(val);
        metaEl.appendChild(wrap);
    }
}

function setFilePreviewMeta(file, filePath, kind, extraRows) {
    if (!filePreviewMeta) return;
    const base = buildBasePreviewMetaRows(file, filePath, kind);
    const rows = extraRows && extraRows.length ? base.concat(extraRows) : base;
    renderFilePreviewMetaRows(filePreviewMeta, rows);
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

// 更新按钮状态
function updateSelectBtn(state) {
    selectBtnState = state;
    if (!selectWorkspaceBtn) return;
    if (state === 'active') {
        selectWorkspaceBtn.title = '切换项目根目录';
        selectWorkspaceBtn.textContent = '📂';
        selectWorkspaceBtn.style.color = 'var(--wechat-green)';
    } else if (state === 'need-auth') {
        const dirHint = mountDirName || '根目录';
        selectWorkspaceBtn.title = `点击重新授权读取 ${dirHint}`;
        selectWorkspaceBtn.textContent = '🔓';
        selectWorkspaceBtn.style.color = 'var(--wechat-warning)';
    } else {
        selectWorkspaceBtn.title = '选择项目根目录';
        selectWorkspaceBtn.textContent = '📂';
        selectWorkspaceBtn.style.color = '';
    }
}

// 激活文件树（已有 handle）
// 若配置了挂载目录且根目录下存在对应子目录，则自动进入该子目录
async function activateFiletree(handle) {
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
    await activateFiletree(rootDirHandle);
    showSystemMessage(`挂载目录已切换为: ${mountDirName || '(根目录)'}`);
}

// 页面加载时尝试恢复上次的目录
(async () => {
    // 初始化挂载目录输入框
    if (mountDirInput) mountDirInput.value = mountDirName;

    const saved = await loadHandle();
    if (!saved) return;
    try {
        // 检查权限，已授权则静默恢复
        const perm = await saved.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
            await activateFiletree(saved);
            return;
        }
        // 权限过期，提示用户点击重新授权
        rootDirHandle = saved;
        updateSelectBtn('need-auth');
        if (filetreeContainer) {
            const dirHint = mountDirName || '根目录';
            filetreeContainer.innerHTML = `<div class="filetree-empty">点击 🔓 重新授权读取 ${dirHint}</div>`;
        }
    } catch (e) {
        console.warn('恢复目录句柄失败', e);
    }
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
                const perm = await rootDirHandle.requestPermission({ mode: 'read' });
                if (perm === 'granted') {
                    await activateFiletree(rootDirHandle);
                    return;
                }
            }
            // active / default 状态：直接弹出选择器，支持切换到新项目
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            await activateFiletree(handle);
        } catch (e) {
            if (e.name !== 'AbortError') console.error('授权目录失败', e);
        }
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
if (filePreviewOverlay) {
    filePreviewOverlay.addEventListener('click', (e) => {
        if (e.target === filePreviewOverlay) hideFilePreview();
    });
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

        const icon = document.createElement('span');
        icon.className = 'ft-icon';
        icon.textContent = isDir ? (expandedDirs.has(fullPath) ? '▾' : '▸') : getFileIcon(entry.name);

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
                    icon.textContent = '▸';
                } else {
                    expandedDirs.add(fullPath);
                    childContainer.innerHTML = '';
                    await buildTreeNodes(entry, childContainer, fullPath, depth + 1);
                    childContainer.style.display = 'block';
                    icon.textContent = '▾';
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
                await previewFile(entry, fullPath);
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
    const dialog = filePreviewOverlay.querySelector('.file-preview-dialog');
    if (dialog) dialog.classList.add('has-canvas-panel');

    const oldPanel = document.getElementById('canvasRightPanel');
    if (oldPanel) oldPanel.remove();

    const main = filePreviewOverlay.querySelector('.file-preview-main');
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

    main.appendChild(panel);

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
    if (!filePreviewBody || !filePreviewName || !filePreviewOverlay) return;
    try {
        const file = await fileHandle.getFile();
        revokeFilePreviewObjectUrl();
        revokeCanvasBlobUrls();
        // 清理上次可能残留的右侧画布面板
        const oldPanel = document.getElementById('canvasRightPanel');
        if (oldPanel) oldPanel.remove();
        const dialog = filePreviewOverlay?.querySelector('.file-preview-dialog');
        if (dialog) dialog.classList.remove('has-canvas-panel');
        filePreviewBody.innerHTML = '';
        if (filePreviewMeta) filePreviewMeta.innerHTML = '';
        filePreviewName.textContent = filePath;

        const kind = getWorkspacePreviewKind(filePath, file);

        if (kind === 'unsupported') {
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
            setFilePreviewMeta(file, filePath, kind, textExtras);
            const pre = document.createElement('pre');
            pre.className = 'file-preview-content';
            pre.textContent = text;
            filePreviewBody.appendChild(pre);

            // magic.project.js：解析画布配置后在右侧自动展开画布面板
            if (isMagicProjectJs(filePath)) {
                const config = parseMagicProjectConfig(text);
                if (config?.canvas) {
                    addCanvasRightPanel(config, filePath);
                }
            }
        }

        filePreviewOverlay.style.display = 'flex';
    } catch (e) {
        console.error('读取文件失败', e);
    }
}

// 根据扩展名返回图标
function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        md: '📝', json: '{}', js: 'JS', ts: 'TS', py: '🐍',
        txt: '📄', yaml: '⚙', yml: '⚙', sh: '>', html: '🌐',
        css: '🎨', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼',
        svg: '🖼', pdf: '📕', zip: '📦', env: '🔑',
    };
    return map[ext] || '📄';
}
