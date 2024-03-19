// 全局变量
let messageHistory = []; // 存储用户发送过的消息历史
let currentTaskMode = "plan"; // 当前任务模式，默认为 plan（保留兼容性）
let currentAgentMode = "magic"; // 当前Agent模式，默认为 magic
let currentFileName = ""; // 存储当前上传的文件名

// WebSocket相关变量
let websocket = null;
let isWebSocketConnected = false;

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
const modelIdInput = document.getElementById('modelIdInput');

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
    PPT: "ppt",
    DATA_ANALYSIS: "data_analysis",
    MAGIC: "magic",
    MEETING: "meeting",
    SUMMARY: "summary",
    SUMMARY_CHAT: "summary-chat",
    SUMMARY_VIDEO: "summary-video",
    SUPER_MAGIC: "super-magic"
};

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
    // 先加载历史记录
    loadMessageHistory();
    console.log("DOM加载完成，已加载历史记录，数量:", messageHistory.length);

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

    // 加载示例文本按钮事件
    loadExampleBtn.addEventListener('click', loadExampleText);

    // Agent模式切换事件
    if (agentModeSelect) {
        agentModeSelect.addEventListener('change', changeAgentMode);
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
    // 不再提供默认配置，只显示提示信息
    uploadConfigContent.value = "请上传配置文件";
    // 禁用文本区域编辑，强制通过文件上传
    uploadConfigContent.readOnly = true;
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

        // 显示响应
        showServerMessage(responseData);

        // 检查响应状态
        if (responseData.code === 1000) {
            showSystemMessage(`发送成功: ${responseData.message}`);
        } else if (responseData.code === 2000) {
            showSystemMessage(`发送失败: ${responseData.message}`);
        }

        return responseData;
    } catch (error) {
        showSystemMessage(`连接失败: ${error.message}。请检查服务器地址是否正确。`);
        return null;
    }
}

// 发送消息
async function sendMessage(contextType = ContextType.NORMAL) {
    const message = messageInput.value.trim();
    if (!message) {
        showSystemMessage("请输入消息内容");
        return;
    }

    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
        showSystemMessage("请输入服务器地址");
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
            showSystemMessage(`配置文件 "${file.name}" 上传成功`);
        } catch (error) {
            showSystemMessage(`文件格式错误: ${error.message}`);
            uploadConfigContent.value = "请上传配置文件";
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
        attachment: [],
        metadata: {}
    };

    // Add model_id field if provided
    const modelId = modelIdInput.value.trim();
    if (modelId) {
        message.model_id = modelId;
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
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message client';

    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    const agentMode = message.agent_mode ? message.agent_mode.toUpperCase() : 'N/A';
    const modelId = message.model_id ? ` - Model: ${message.model_id}` : '';
    messageHeader.textContent = `客户端消息 (${new Date().toLocaleTimeString()}) - Agent模式: ${agentMode}${modelId}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message.prompt;

    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(messageContent);
    messageList.appendChild(messageDiv);

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
function showSystemMessage(text) {
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

// 切换Agent模式
function changeAgentMode() {
    const selectedMode = agentModeSelect.value;
    currentAgentMode = selectedMode;

    const modeNames = {
        'magic': 'Magic模式',
        'general': 'General模式',
        'ppt': 'PPT模式',
        'data_analysis': '数据分析模式',
        'summary': '总结模式'
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
}

function handleWebSocketMessage(event) {
    try {
        let displayData;

        // 尝试解析JSON
        try {
            displayData = JSON.parse(event.data);
        } catch (parseError) {
            // 如果解析失败，创建一个包含原始数据的对象
            displayData = {
                error: "无法解析JSON",
                raw_data: event.data
            };
        }

        // 直接传递对象给showServerMessage函数
        // showServerMessage内部会自动格式化为易读的JSON
        showServerMessage(displayData);
        scrollToBottom();
    } catch (error) {
        showSystemMessage(`处理WebSocket消息时出错: ${error.message}`);
    }
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
