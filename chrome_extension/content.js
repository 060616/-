
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getSelection") {
            const selectedText = window.getSelection().toString();
            chrome.runtime.sendMessage({
                action: "generateCard",
                text: selectedText,
                url: window.location.href
            });
        }
    });