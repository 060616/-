import os

def create_extension_structure():
    """创建Chrome插件基本结构"""
    # 创建目录
    os.makedirs('chrome_extension', exist_ok=True)
    
    # manifest.json
    manifest = '''{
        "manifest_version": 3,
        "name": "网页内容卡片生成器",
        "version": "1.0",
        "description": "将选中的网页内容转换为精美卡片",
        "permissions": [
            "contextMenus",
            "storage",
            "scripting",
            "activeTab"
        ],
        "host_permissions": [
            "http://localhost:5000/*"
        ],
        "background": {
            "service_worker": "background.js"
        },
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": ["content.js"]
        }],
        "action": {
            "default_popup": "popup.html"
        }
    }'''
    
    # popup.html
    popup_html = '''<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>网页内容卡片生成器</title>
        <link rel="stylesheet" href="styles.css">
    </head>
    <body>
        <div class="container">
            <h2>网页内容卡片生成器</h2>
            <div class="preview-area">
                <img id="preview" style="display: none;">
            </div>
            <div class="controls">
                <button id="generate">生成卡片</button>
                <button id="save" style="display: none;">保存卡片</button>
            </div>
            <div id="status"></div>
        </div>
        <script src="popup.js"></script>
    </body>
    </html>'''
    
    # styles.css
    styles_css = '''
    .container {
        width: 300px;
        padding: 15px;
    }
    
    .preview-area {
        margin: 10px 0;
        min-height: 200px;
        border: 1px solid #ccc;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    
    .preview-area img {
        max-width: 100%;
        max-height: 300px;
    }
    
    .controls {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
    }
    
    button {
        padding: 8px 15px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    button:hover {
        background: #45a049;
    }
    
    #status {
        margin-top: 10px;
        color: #666;
    }'''
    
    # background.js
    background_js = '''
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
            console.log("Generating card for:", text, url);
            
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Card generated:", data);
            
            // 广播生成成功消息
            chrome.runtime.sendMessage({
                action: "cardGenerated",
                imageUrl: data.imageUrl
            }).catch(err => console.log("Broadcast error:", err));
            
        } catch (error) {
            console.error("Generation error:", error);
            chrome.runtime.sendMessage({
                action: "error",
                message: error.message
            }).catch(err => console.log("Error broadcast error:", err));
        }
    }
    '''
    
    # content.js
    content_js = '''
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getSelection") {
            const selectedText = window.getSelection().toString();
            chrome.runtime.sendMessage({
                action: "generateCard",
                text: selectedText,
                url: window.location.href
            });
        }
    });'''
    
    # popup.js
    popup_js = '''
    document.addEventListener('DOMContentLoaded', function() {
        const preview = document.getElementById('preview');
        const generateBtn = document.getElementById('generate');
        const saveBtn = document.getElementById('save');
        const status = document.getElementById('status');
        
        generateBtn.addEventListener('click', function() {
            status.textContent = "正在生成卡片...";
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: () => window.getSelection().toString()
                }, (results) => {
                    if (results && results[0] && results[0].result) {
                        chrome.runtime.sendMessage({
                            action: "generateCard",
                            text: results[0].result,
                            url: tabs[0].url
                        });
                    } else {
                        status.textContent = "请先选择文本";
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
    '''
    
    # 创建所有文件
    files = {
        'manifest.json': manifest,
        'popup.html': popup_html,
        'styles.css': styles_css,
        'background.js': background_js,
        'content.js': content_js,
        'popup.js': popup_js
    }
    
    for filename, content in files.items():
        with open(f'chrome_extension/{filename}', 'w', encoding='utf-8') as f:
            f.write(content)
    
    print("Chrome插件文件结构创建完成！")

if __name__ == '__main__':
    create_extension_structure()