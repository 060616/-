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
                
                // 确保在这里return，不继续执行
                console.log("选中的文本:", info.selectionText);
                console.log("当前URL:", tab.url);
                
                await generateCard(info.selectionText, tab.url);
                
            } catch (error) {
                console.error("操作失败:", error);
                chrome.notifications.create({
                    type: 'basic',
                    title: '操作失败',
                    message: error.message,
                    iconUrl: 'icon.png'
                });
                return; // 确保错误时立即返回
            }
        }
    });
    
    // 处理来自content script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("background收到消息:", request);
        
        if (request.type === 'generateCard') {
            fetch('http://localhost:8000/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: request.text
                })
            })
            .then(response => {
                // 检查响应状态
                console.log('响应状态:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });
                return response.json();
            })
            .then(data => {
                // 详细检查返回的数据结构
                console.log('服务器返回的完整数据:', data);
                
                // 验证数据格式
                if (!data || typeof data !== 'object') {
                    throw new Error('服务器返回的数据格式无效');
                }
                
                // 检查imageUrl字段
                if (!data.imageUrl) {
                    console.error('缺少imageUrl字段，完整数据:', data);
                    throw new Error('服务器返回的数据缺少imageUrl字段');
                }
                
                // 验证imageUrl格式
                try {
                    new URL(data.imageUrl);
                } catch (e) {
                    console.error('imageUrl格式无效:', data.imageUrl);
                    throw new Error('图片URL格式无效');
                }
                
                sendResponse(data);
            })
            .catch(error => {
                console.error('详细错误信息:', {
                    message: error.message,
                    stack: error.stack,
                    data: error.response ? error.response.data : null
                });
                sendResponse({error: error.message});
            });
            return true; // 保持消息通道开放
        }
        if (request.action === 'getTabId') {
            sendResponse({ tabId: sender.tab.id });
            return true;
        }
    });
    
    // 生成卡片的函数
    async function generateCard(text, url) {
        console.log("开始生成卡片", {
            text: text.substring(0, 100) + "...", // 避免日志过长
            url,
            timestamp: new Date().toISOString()
        });
        try {
            // 检查服务器状态
            console.log("检查服务器状态...");
            const statusCheck = await fetch("http://localhost:8000/status");
            console.log("服务器状态检查结果:", {
                ok: statusCheck.ok,
                status: statusCheck.status,
                statusText: statusCheck.statusText
            });
            
            if (!statusCheck.ok) {
                throw new Error("服务器未启动或无法连接");
            }
            
            console.log("开始发送生成请求...");
            const response = await fetch("http://localhost:8000/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({text, url})
            });
            
            console.log("收到服务器响应:", {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            const data = await response.json();
            console.log("解析后的响应数据:", {
                hasImageUrl: !!data.imageUrl,
                dataKeys: Object.keys(data),
                timestamp: new Date().toISOString()
            });
            
            if (!data.imageUrl) {
                throw new Error("服务器返回的数据中没有图片URL");
            }
            
            // 广播生成成功消息
            chrome.runtime.sendMessage({
                action: "cardGenerated",
                imageUrl: data.imageUrl
            });
            
        } catch (error) {
            console.error("生成卡片详细错误信息:", {
                error: error.toString(),
                stack: error.stack,
                timestamp: new Date().toISOString(),
                requestInfo: {
                    text: text.substring(0, 100) + "...",
                    url
                }
            });
            throw error;
        }
    }
    