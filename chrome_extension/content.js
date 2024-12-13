// 添加调试日志，确认content script是否被加载
console.log("Content script loaded at:", new Date().toISOString());

// 全局状态管理
let currentTabId = null;
let isInitialized = false;
let isRuntimeReady = false;

// 检查runtime是否可用
function isRuntimeAvailable() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

// 等待获取tabId的函数
async function waitForTabId(maxRetries = 5, retryInterval = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (!isRuntimeAvailable()) {
                console.warn(`等待runtime可用 (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryInterval));
                continue;
            }

            const response = await chrome.runtime.sendMessage({ action: 'getTabId' });
            if (response && response.tabId) {
                console.log('成功获取tabId:', response.tabId);
                return response.tabId;
            }
        } catch (error) {
            console.warn(`尝试获取tabId失败 (${i + 1}/${maxRetries}):`, error);
        }
        await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
    throw new Error('无法获取tabId');
}

// 安全的消息发送函数
async function safeSendMessage(message) {
    if (!isInitialized) {
        console.error('扩展尚未初始化完成，无法发送消息');
        return;
    }
    
    if (!isRuntimeAvailable()) {
        console.warn('Chrome runtime 不可用');
        return;
    }
    
    try {
        console.log('[DEBUG] 准备发送消息:', {
            message,
            tabId: currentTabId
        });
        
        const response = await chrome.runtime.sendMessage({
            ...message,
            tabId: currentTabId
        });
        
        console.log('[DEBUG] 消息发送成功，响应:', response);
        return response;
        
    } catch (error) {
        console.warn('[ERROR] 消息发送失败:', {
            error: error.toString(),
            tabId: currentTabId
        });
    }
}

// 初始化函数
async function initialize() {
    if (isInitialized) {
        console.log('已经完成初始化');
        return;
    }

    console.log('开始初始化...');
    
    try {
        // 等待获取tabId
        currentTabId = await waitForTabId();
        isRuntimeReady = true;
        
        // 设置���始化完成标志
        isInitialized = true;
        console.log('初始化完成，tabId:', currentTabId);
        
        // 通知background script初始化完成
        await safeSendMessage({
            action: "contentScriptReady",
            status: "initialized"
        });
        
    } catch (error) {
        console.error('初始化失败:', error);
        // 可以在这里添加重试逻辑或者用户提示
    }
}

// 页面加载完成时初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化');
    initialize().catch(error => {
        console.error('初始化过程出错:', error);
    });
});

// 修改现有的事件监听器，添加初始化检查
document.addEventListener('visibilitychange', () => {
    if (!isInitialized) {
        console.warn('扩展尚未初始化完成，忽略visibilitychange事件');
        return;
    }

    if (document.visibilityState === 'visible') {
        safeSendMessage({
            action: "contentScriptVisible"
        });
    } else {
        safeSendMessage({
            action: "contentScriptHidden"
        });
    }
});

// 导出状态检查函数（可选）
window.checkExtensionStatus = () => {
    return {
        isInitialized,
        currentTabId,
        isRuntimeReady
    };
};

// 在消息监听器中添加更详细的日志
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[DEBUG] content script收到消息:', {
        message,
        sender,
        timestamp: new Date().toISOString(),
        initStatus: isInitialized,
        currentTab: currentTabId
    });

    if (message.action === "cardGenerated") {
        console.log('[DEBUG] 收到卡片生成完成消息:', message);
        // ... 处理逻辑
        sendResponse({ status: 'received' });
        return true;
    }

    if (message.type === 'ping') {
        console.log('收到ping消息，准备响应');
        const response = {
            status: 'ok',
            ready: isInitialized,
            timestamp: Date.now()
        };
        console.log('发送pong响应:', response);
        sendResponse(response);
        return true;
    }
});