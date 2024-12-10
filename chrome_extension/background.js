    // 创建右键菜单
    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "generateCard",
            title: "生成分享卡片",
            contexts: ["selection"]
        });
    });
    
    // 处理右键菜单点击
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "generateCard") {
            // 直接使用选中的文本
            generateCard(info.selectionText, tab.url);
        }
    });
    
    // 处理来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "generateCard") {
            generateCard(request.text, request.url);
        }
        return true;
    });
    
    // 生成卡片的函数
    async function generateCard(text, url) {
        try {
            // 检查服务器状态
            const statusCheck = await fetch("http://localhost:5000/status").catch(() => null);
            if (!statusCheck || !statusCheck.ok) {
                throw new Error("服务器未启动或无法连接");
            }

            console.log("Generating card for:", text, url);
            
            const response = await fetch("http://localhost:8000/generate", {
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
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `服务器错误 (${response.status})`);
            }
            
            const data = await response.json();
            console.log("服务器返回数据:", data);
            
            // 修正这里的属性名
            if (!data.imageUrl) {  // 之前是 imageUrl1
                throw new Error("服务器返回的数据中没有图片URL");
            }

            // 广播生成成功消息
            chrome.runtime.sendMessage({
                action: "cardGenerated",
                imageUrl: data.imageUrl
            });
            
        } catch (error) {
            console.error("生成卡片时出错:", error);
            chrome.runtime.sendMessage({
                action: "error",
                message: `生成失败: ${error.message}`
            });
        }
    }
    