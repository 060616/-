import os

def create_extension_structure():
    """创建Chrome插件基本结构"""
    # 创建目录
    os.makedirs('chrome_extension', exist_ok=True)
    
    # manifest.json
    manifest = '''{
        "manifest_version": 2,
        "name": "网页内容卡片生成器",
        "version": "1.0",
        "description": "将选中的网页内容转换为精美卡片",
        "permissions": ["contextMenus", "storage"],
        "background": {
            "scripts": ["background.js"],
            "persistent": false
        },
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": ["content.js"]
        }],
        "browser_action": {
            "default_popup": "popup.html"
        }
    }'''
    
    # 创建文件
    with open('chrome_extension/manifest.json', 'w', encoding='utf-8') as f:
        f.write(manifest) 