// 全局变量
let messageHistory = []; // 存储用户发送过的消息历史
let currentTaskMode = "plan"; // 当前任务模式，默认为 plan（保留兼容性）
let currentAgentMode = "magic"; // 当前Agent模式，默认为 magic
let currentLanguage = "zh_CN"; // 当前语言，默认中文
let currentFileName = ""; // 存储当前上传的文件名
let isAdvancedMode = false; // 高级模式开关，开启后直接发送原始 JSON

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
        case 'event':     showEventLog(entry.data, true); break;
        case 'system':    showSystemMessage(entry.text, true); break;
    }
}

function renderClientEntry(entry) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message client';
    const header = document.createElement('div');
    header.className = 'message-header';
    const agentMode = entry.agentMode ? entry.agentMode.toUpperCase() : 'N/A';
    const modelId = entry.modelId ? ` - Model: ${entry.modelId}` : '';
    header.textContent = `客户端消息 (${entry.time}) - Agent模式: ${agentMode}${modelId}`;
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
const advancedModeToggle = document.getElementById('advancedModeToggle');
const rawJsonInput = document.getElementById('rawJsonInput');
const languageSelect = document.getElementById('languageSelect');

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
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                sendMessage(ContextType.NORMAL);
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

    // 启用消息按钮（不再需要先测试连接）
    toggleMessageControls(true);

    // 设置默认配置
    setupDefaultConfigs();

    // 初始隐藏文件名显示
    currentFileNameDisplay.style.display = 'none';
});

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

    // 创建聊天消息
    const chatMessage = createChatMessage(message, contextType);

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

    // Add model_id field if provided
    const modelId = modelIdInput.value.trim();
    if (modelId) {
        message.model_id = modelId;
    }

    // magiclaw 模式下从输入框读取 agent_code 注入 dynamic_config
    if (currentAgentMode === 'magiclaw' && agentCodeInput) {
        const agentCode = agentCodeInput.value.trim();
        if (agentCode) {
            message.dynamic_config = { agent_code: agentCode };
        }
    }

    // Add remark field if provided
    if (remark !== null) {
        message.remark = remark;
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
    pushLog({
        type: 'client',
        prompt: message.prompt || '',
        agentMode: message.agent_mode || '',
        modelId: message.model_id || '',
        time,
    });
    renderClientEntry({
        type: 'client',
        prompt: message.prompt || '',
        agentMode: message.agent_mode || '',
        modelId: message.model_id || '',
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

        if (eventType === 'after_agent_reply' && content) {
            if (contentType === 'content') {
                // AI 正式回复 → 白色气泡
                showAIMessage(content, payload.send_timestamp);
            } else if (contentType === 'reasoning') {
                // 思考过程 → 折叠的思考块
                showThinkingMessage(content, payload.send_timestamp);
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

// 将内容按 ```html 块拆分，返回渲染好的 DOM 片段数组
function buildRenderedView(content) {
    const fragment = document.createDocumentFragment();
    const codeBlockRegex = /```(?:html|HTML)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const before = content.slice(lastIndex, match.index);
        if (before.trim()) fragment.appendChild(renderMarkdown(before));

        // ```html 块 → iframe
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-iframe-wrapper';
        const iframe = document.createElement('iframe');
        iframe.className = 'ai-iframe';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        iframe.srcdoc = match[1];
        iframe.onload = () => {
            try {
                const h = iframe.contentDocument.body.scrollHeight;
                if (h > 0) iframe.style.height = Math.min(h + 20, 600) + 'px';
            } catch (e) {}
        };
        wrapper.appendChild(iframe);
        fragment.appendChild(wrapper);
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

// ── 工作区文件树 ──────────────────────────────────────────────────────────────

const filetreeContainer = document.getElementById('filetreeContainer');
const selectWorkspaceBtn = document.getElementById('selectWorkspaceBtn');
const refreshTreeBtn = document.getElementById('refreshTreeBtn');
const mountDirInput = document.getElementById('mountDirInput');
const applyMountDirBtn = document.getElementById('applyMountDirBtn');
const filePreviewOverlay = document.getElementById('filePreviewOverlay');
const filePreviewName = document.getElementById('filePreviewName');
const filePreviewContent = document.getElementById('filePreviewContent');
const filePreviewClose = document.getElementById('filePreviewClose');

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
        if (workspaceDirHandle) await renderFileTree();
    });
}

// 关闭预览
if (filePreviewClose) {
    filePreviewClose.addEventListener('click', () => {
        filePreviewOverlay.style.display = 'none';
    });
}
if (filePreviewOverlay) {
    filePreviewOverlay.addEventListener('click', (e) => {
        if (e.target === filePreviewOverlay) filePreviewOverlay.style.display = 'none';
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
        } else {
            node.addEventListener('click', async (e) => {
                e.stopPropagation();
                await previewFile(entry, fullPath);
            });
        }
    }
}

// 预览文件内容
async function previewFile(fileHandle, filePath) {
    try {
        const file = await fileHandle.getFile();
        const MAX_SIZE = 512 * 1024; // 512KB
        let text;
        if (file.size > MAX_SIZE) {
            const slice = file.slice(0, MAX_SIZE);
            text = await slice.text() + '\n\n... (文件过大，仅显示前 512KB) ...';
        } else {
            text = await file.text();
        }
        filePreviewName.textContent = filePath;
        filePreviewContent.textContent = text;
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
