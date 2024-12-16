    // 创建右键菜单
    chrome.runtime.onInstalled.addListener(() => {
        console.log("扩展已安装，创建右键菜单");
        chrome.contextMenus.create({
            id: "generateCard",
            title: "生成分享卡片",
            contexts: ["selection"]
        });
    });
    
    // 添加消息队列管理
    const messageQueue = new Map(); // tabId -> Queue
    
    async function ensureContentScriptReady(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
                console.log('不支持的页面类型:', tab.url);
                return false;
            }

            let retries = 0;
            const maxRetries = 5;
            
            while (retries < maxRetries) {
                try {
                    console.log(`尝试连接content script (第${retries + 1}次)`);
                    console.log(`尝试发送ping消息到tabId: ${tabId}`);
                    const response = await chrome.tabs.sendMessage(tabId, { 
                        type: 'ping',
                        timestamp: Date.now() 
                    });
                    console.log('收到ping响应:', response);
                    
                    if (response?.status === 'ok' && response?.ready) {
                        console.log('content script就绪');
                        return true;
                    }
                    
                    console.log('content script还未就绪:', response);
                    retries++;
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.log(`连接失败 (${retries + 1}/${maxRetries}):`, error);
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.error("达到最大重试次数");
            return false;
            
        } catch (error) {
            console.error('检查tab时出错:', error);
            return false;
        }
    }
    
    // 处理右键菜单点击
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === "generateCard") {
            try {
                const isReady = await ensureContentScriptReady(tab.id);
                if (!isReady) {
                    throw new Error("无法连接到页面内容脚本");
                }
                
                console.log("选中的文本:", info.selectionText);
                console.log("当前URL:", tab.url);
                
                // 直接调用生成函数，不再发送消息给content script
                const result = await generateCard(info.selectionText, tab.url);
                
                // 生成成功后，发送预览消息
                if (result && result.imageData) {
                    await sendMessageWithConfirmation(tab.id, {
                        type: 'showPreview',
                        imageData: result.imageData
                    });
                }
                
            } catch (error) {
                console.error("操作失败:", error);
                chrome.notifications.create({
                    type: 'basic',
                    title: '操作失败',
                    message: error.message,
                    iconUrl: 'icon.png'
                });
            }
        }
    });
    
    // 添加获取域名的辅助函数
    function getDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            return url;
        }
    }
    
    // 修改后的generateCard函数
    async function generateCard(text, url) {
        try {
            // 获取当前页面标题
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            let title = '';
            
            try {
                const [{result}] = await chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: () => document.title
                });
                title = result || getDomainFromUrl(url);
            } catch (e) {
                title = getDomainFromUrl(url);
            }

            const response = await fetch('http://localhost:8000/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    url,
                    title
                })
            });

            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || !data.imageData) {
                throw new Error('服务器返回的数据格式无效');
            }

            // 直接返回 base64 数据，让 content script 处理
            return {
                imageData: data.imageData
            };
            
        } catch (error) {
            console.error("卡片生成失败，具体原因:", error);
            throw error;
        }
    }
    
    // 消息监听器只处理必要的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('收到消息:', message);
        
        // 处理来自content script的消息
        switch (message.type) {
            case 'previewShown':
                console.log('预览显示成功');
                break;
                
            case 'previewFailed':
                console.error('预览显示失败:', message.error);
                chrome.notifications.create({
                    type: 'basic',
                    title: '���览失败',
                    message: message.error,
                    iconUrl: 'icon.png'
                });
                break;
        }
        
        return true; // 保持消息通道开放
    });
    
    // 简化版的消息发送函数
    async function sendMessageWithConfirmation(tabId, message) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, message);
            
            if (response?.error) {
                throw new Error(response.error);
            }
            
            return response;
            
        } catch (error) {
            console.error('消息发送失败:', error);
            throw error;
        }
    }