let isServiceWorkerReady = false;

// 在 service worker 激活时设置状态
self.addEventListener('activate', (event) => {
    console.log('[Background] Service Worker 已激活');
    isServiceWorkerReady = true;
});

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    console.log("[Background] 插件已安装,创建右键菜单");
    chrome.contextMenus.create({
        id: "generateCard",
        title: "生成分享卡片",
        contexts: ["selection"]
    });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "generateCard" && isServiceWorkerReady) {
        console.log("[Background] 用户通过右键菜单触发");
        generateCard(info.selectionText, tab.url);
    }
});

// 添加连接状态检查
chrome.runtime.onConnect.addListener((port) => {
    console.log('[Background] 建立新连接:', port.name);
    port.onDisconnect.addListener(() => {
        console.log('[Background] 连接断开:', port.name);
    });
});

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] 收到消息:', request);
    if (!isServiceWorkerReady) {
        console.error('[Background] Service Worker 未就绪');
        sendResponse({ error: 'Service Worker not ready' });
        return true;
    }

    if (request.action === "generateCard") {
        generateCard(request.text, request.url)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // 保持消息通道开放
    }
    return true;
});

// 生成卡片的函数
async function generateCard(text, url) {
    try {
        if (!text || !url) {
            throw new Error('无效的参数');
        }

        console.log("[Background] 开始生成卡片流程");
        console.log("[Background] 发送请求到本地服务器");
        
        const response = await fetch("http://localhost:5000/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                url: url
            })
        });
        
        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("[Background] 服务器返回成功");
        
        // 使用 chrome.runtime.sendMessage 发送消息到所有监听者
        try {
            chrome.runtime.sendMessage({
                action: "cardGenerated",
                imageUrl: data.imageUrl
            });
        } catch (e) {
            console.log("[Background] 发送消息失败，尝试存储结果");
            await chrome.storage.local.set({
                lastGeneratedCard: {
                    action: "cardGenerated",
                    imageUrl: data.imageUrl
                }
            });
        }
        
        return data;
        
    } catch (error) {
        console.error("[Background] 生成失败:", error);
        throw error;
    }
}
    