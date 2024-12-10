    document.addEventListener('DOMContentLoaded', function() {
        const preview = document.getElementById('preview');
        const generateBtn = document.getElementById('generate');
        const saveBtn = document.getElementById('save');
        const status = document.getElementById('status');
        
        generateBtn.addEventListener('click', function() {
            preview.style.display = "none";
            saveBtn.style.display = "none";
            status.textContent = "正在连接服务器...";
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: () => window.getSelection().toString()
                }, (results) => {
                    if (results && results[0] && results[0].result) {
                        status.textContent = "正在生成卡片...";
                        chrome.runtime.sendMessage({
                            action: "generateCard",
                            text: results[0].result,
                            url: tabs[0].url
                        });
                    } else {
                        status.textContent = "请先选择要生成卡片的文本内容";
                    }
                });
            });
        });
        
        saveBtn.addEventListener('click', function() {
            const link = document.createElement('a');
            link.download = 'share-card.png';
            link.href = preview.src;
            link.click();
        });
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log("Popup received message:", request);
            if (request.action === "cardGenerated") {
                preview.src = request.imageUrl;
                preview.style.display = "block";
                saveBtn.style.display = "block";
                status.textContent = "卡片生成成功！";
            } else if (request.action === "error") {
                status.textContent = "生成失败：" + request.message;
            }
        });
    });
    