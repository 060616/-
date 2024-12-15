// 添加调试日志，确认content script是否被加载
console.log("Content script loaded at:", new Date().toISOString());

// 全局状态管理
let currentTabId = null;
let isInitialized = false;
let isRuntimeReady = false;

// 重试配置
const INIT_RETRY_CONFIG = {
    maxRetries: 3,
    retryInterval: 1000,
    currentRetry: 0
};

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
async function initialize(retryConfig = INIT_RETRY_CONFIG) {
    if (isInitialized) {
        console.log('已经完成初始化');
        return;
    }

    console.log('开始初始化...尝试���数:', retryConfig.currentRetry + 1);
    
    try {
        // 等待获取tabId
        currentTabId = await waitForTabId();
        isRuntimeReady = true;
        
        // 设置初始化完成标志
        isInitialized = true;
        console.log('初始化完成，tabId:', currentTabId);
        
        // 通知background script初始化完成
        await safeSendMessage({
            action: "contentScriptReady",
            status: "initialized"
        });
        
    } catch (error) {
        console.error('初始化失败:', error);
        
        // 自动重试逻辑
        if (retryConfig.currentRetry < retryConfig.maxRetries) {
            console.log(`将在 ${retryConfig.retryInterval}ms 后重试初始化...`);
            setTimeout(() => {
                initialize({
                    ...retryConfig,
                    currentRetry: retryConfig.currentRetry + 1
                });
            }, retryConfig.retryInterval);
        } else {
            console.error('初始化重试次数已达上限，放弃初始化');
            // 这里可以触发一个事件通知UI层显示错误状态
            window.dispatchEvent(new CustomEvent('extension-init-failed', {
                detail: { error: error.message }
            }));
        }
    }
}

// 立即开始初始��
initialize().catch(console.error);

// 添加事件分发机制
const eventBus = {
    listeners: new Map(),
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    },
    
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    },
    
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] 事件处理错误 (${event}):`, error);
                }
            });
        }
    }
};

// 修改消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('content script收到消息:', message);

    if (message.type === 'ping') {
        handlePingMessage(sendResponse);
        return true;
    }
    
    if (message.type === 'showPreview') {
        handlePreviewMessage(message, sendResponse);
        return true;
    }
});

// 处理ping消息
function handlePingMessage(sendResponse) {
    console.log('收到ping消息，准备响应');
    const response = {
        status: 'ok',
        ready: isInitialized,
        timestamp: Date.now()
    };
    console.log('发送pong响应:', response);
    sendResponse(response);
}

// Display模块（原display.js的功能）
const Display = (() => {
    // DOM引用存储
    const domRefs = new WeakMap();

    // 创建预览容器
    function createPreviewContainer() {
        const container = document.createElement('div');
        container.className = 'card-preview-container';
        container.innerHTML = `
            <div class="card-preview-content">
                <img class="card-preview-image" alt="预览图片">
                <button class="card-preview-close">关闭</button>
                <div class="card-preview-error"></div>
            </div>
        `;
        document.body.appendChild(container);
        return container;
    }

    // 图片加载函数
    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = url;
        });
    }

    // 错误处理
    function handlePreviewError(error) {
        console.error('[Display] 预览显示失败:', error);
        
        const refs = domRefs.get(window);
        if (refs) {
            const errorEl = refs.container.querySelector('.card-preview-error');
            errorEl.textContent = '预览加载失败,请重试';
            errorEl.style.display = 'block';
        }
        
        window.dispatchEvent(new CustomEvent('card-preview-error', {
            detail: { error, type: 'PREVIEW_ERROR' }
        }));
    }

    // 绑定事件
    function bindEvents() {
        const refs = domRefs.get(window);
        if (!refs) return;
        
        refs.closeButton.addEventListener('click', () => {
            refs.container.classList.remove('visible');
        });
        
        // 添加错误恢复机制
        window.addEventListener('card-preview-retry', () => {
            const errorEl = refs.container.querySelector('.card-preview-error');
            errorEl.style.display = 'none';
        });
    }

    return {
        initialize() {
            try {
                const container = createPreviewContainer();
                domRefs.set(window, {
                    container,
                    previewImage: container.querySelector('.card-preview-image'),
                    closeButton: container.querySelector('.card-preview-close')
                });
                
                bindEvents();
                
            } catch (error) {
                console.error('[Display] 初始化失败:', error);
                window.dispatchEvent(new CustomEvent('card-preview-error', {
                    detail: { error, type: 'INIT_ERROR' }
                }));
            }
        },

        async showPreview(imageUrl) {
            try {
                const refs = domRefs.get(window);
                if (!refs) {
                    throw new Error('DOM引用未初始化');
                }
                
                const { container, previewImage } = refs;
                
                // 显示加载状态
                container.classList.add('loading');
                
                // 加载图片
                await loadImage(imageUrl);
                
                // 更新图片并显示
                previewImage.src = imageUrl;
                container.classList.remove('loading');
                container.classList.add('visible');
                
            } catch (error) {
                handlePreviewError(error);
            }
        }
    };
})();

// 修改消息监听器中的预览处理
async function handlePreviewMessage(message, sendResponse) {
    try {
        if (!message.imageUrl) {
            throw new Error('缺少图片URL');
        }
        
        // 使用Display模块的showPreview方法
        await Display.showPreview(message.imageUrl);
        
        sendResponse({ status: 'ok' });
        
    } catch (error) {
        console.error('[Preview] 显示预览失败:', error);
        sendResponse({ 
            status: 'error',
            error: error.message
        });
    }
}

// 在DOMContentLoaded中初始化Display模块
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，初始化显示模块');
    Display.initialize();
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

// 将export语句改为window对象属性
window.getInitializationStatus = function() {
    return {
        isInitialized,
        currentTabId,
        isRuntimeReady,
        retryCount: INIT_RETRY_CONFIG.currentRetry
    };
};