let port;

document.addEventListener('DOMContentLoaded', function() {
    console.log("[Popup] 弹窗已加载");
    
    // 建立持久连接
    port = chrome.runtime.connect({ name: "popup" });
    
    const generateBtn = document.getElementById('generate');
    const saveBtn = document.getElementById('save');
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');
    
    // 检查是否有存储的卡片
    chrome.storage.local.get(['lastGeneratedCard'], function(result) {
        if (result.lastGeneratedCard) {
            console.log("[Popup] 发现存储的卡片,正在加载");
            handleCardGenerated(result.lastGeneratedCard);
            chrome.storage.local.remove('lastGeneratedCard');
        }
    });
    
    generateBtn.addEventListener('click', async function() {
        try {
            console.log("[Popup] 点击生成按钮");
            status.textContent = "正在生成卡片...";
            preview.style.display = "none";
            saveBtn.style.display = "none";
            
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: () => window.getSelection().toString()
            });
            
            if (results && results[0] && results[0].result) {
                console.log("[Popup] 获取到选中文本");
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: "generateCard",
                        text: results[0].result,
                        url: tabs[0].url
                    }, resolve);
                });
                
                if (response && response.error) {
                    throw new Error(response.error);
                }
            } else {
                console.log("[Popup] 未选中文本");
                status.textContent = "请先选择文本";
            }
        } catch (error) {
            console.error("[Popup] 错误:", error);
            status.textContent = "生成失败: " + error.message;
        }
    });
    
    // 监听消息
    chrome.runtime.onMessage.addListener((message) => {
        console.log("[Popup] 收到消息:", message);
        if (message.action === "cardGenerated") {
            handleCardGenerated(message);
        } else if (message.action === "error") {
            status.textContent = "生成失败: " + message.message;
        }
    });
});

function handleCardGenerated(message) {
    const preview = document.getElementById('preview');
    const saveBtn = document.getElementById('save');
    const status = document.getElementById('status');
    
    preview.src = message.imageUrl;
    preview.style.display = "block";
    saveBtn.style.display = "block";
    status.textContent = "生成成功！";
}
    