// 添加调试日志，确认content script是否被加载
console.log("Content script loaded at:", new Date().toISOString());

// 添加更清晰的状态管理
let isContentScriptReady = false;
let pageFullyLoaded = false;

// DOM加载完成时
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM加载完成");
    isContentScriptReady = true;
    // 通知background script
    chrome.runtime.sendMessage({
        action: "contentScriptReady",
        tabId: window.tabId
    }).catch(() => console.log("通知background失败"));
});

// 页面完全加载时
window.addEventListener('load', () => {
    console.log("页面完全加载");
    pageFullyLoaded = true;
    // 再次通知以确保状态同步
    chrome.runtime.sendMessage({
        action: "pageFullyLoaded",
        tabId: window.tabId
    }).catch(() => console.log("通知background失败"));
});

// 改进消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("content script收到消息:", request);
    
    if (request.type === 'ping') {
        console.log("响应ping消息，当前状态:", {
            isContentScriptReady,
            pageFullyLoaded
        });
        sendResponse({ 
            status: 'ok',
            ready: isContentScriptReady,
            pageLoaded: pageFullyLoaded
        });
        return true;
    }
});

// 使用 pagehide 替代 unload
window.addEventListener('pagehide', () => {
    isContentScriptReady = false;
    // 通知background script
    chrome.runtime.sendMessage({
        action: "contentScriptUnloading",
        tabId: window.tabId
    }).catch(() => {});
});

// 添加 visibilitychange 事件处理
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        isContentScriptReady = false;
        chrome.runtime.sendMessage({
            action: "contentScriptHidden",
            tabId: window.tabId
        }).catch(() => {});
    } else if (document.visibilityState === 'visible') {
        isContentScriptReady = true;
        chrome.runtime.sendMessage({
            action: "contentScriptVisible",
            tabId: window.tabId
        }).catch(() => {});
    }
});