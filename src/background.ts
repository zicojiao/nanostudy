// NanoStudy AI Assistant - Plasmo Background Script
// Main background script for extension lifecycle management

// Create context menu when extension is installed/enabled
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "nanostudy-askai",
    title: "Ask AI",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
  chrome.contextMenus.create({
    id: "nanostudy-quiz",
    title: "Generate Quiz",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
  chrome.contextMenus.create({
    id: "nanostudy-summarize",
    title: "Generate Summary",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
  chrome.contextMenus.create({
    id: "nanostudy-translate",
    title: "Translate Selection",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "nanostudy-summarize" && info.selectionText && tab?.windowId) {
    try {
      // Open the sidepanel
      await chrome.sidePanel.open({ windowId: tab.windowId });

      // Store the selected text in storage for the sidepanel to access
      await chrome.storage.local.set({
        selectedText: info.selectionText,
        timestamp: Date.now()
      });

      console.log('✅ Context menu triggered, text stored and sidepanel opened');
    } catch (error) {
      console.error('❌ Error handling context menu click:', error);
    }
  }
  if (info.menuItemId === "nanostudy-translate" && info.selectionText && tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      await chrome.storage.local.set({
        translateText: info.selectionText,
        translateTimestamp: Date.now()
      });
      console.log('✅ Translate menu triggered, text stored and sidepanel opened');
    } catch (error) {
      console.error('❌ Error handling translate menu click:', error);
    }
  }
  if (info.menuItemId === "nanostudy-askai" && info.selectionText && tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      await chrome.storage.local.set({
        askaiText: info.selectionText,
        askaiTimestamp: Date.now()
      });
      console.log('✅ Ask AI menu triggered, text stored and sidepanel opened');
    } catch (error) {
      console.error('❌ Error handling Ask AI menu click:', error);
    }
  }
  if (info.menuItemId === "nanostudy-quiz" && info.selectionText && tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      await chrome.storage.local.set({
        quizText: info.selectionText,
        quizTimestamp: Date.now()
      });
      console.log('✅ Quiz menu triggered, text stored and sidepanel opened');
    } catch (error) {
      console.error('❌ Error handling quiz menu click:', error);
    }
  }
});

// Listen for extension icon click to actively open sidepanel (Chrome 121+)
if (chrome.sidePanel && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      // Some older Chrome versions might not support sidePanel.open
      console.warn('sidePanel.open not supported in this Chrome version');
    }
  });
}

// Auto cleanup on extension suspend to prevent memory leaks
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending, cleaning up...');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "initiateScreenshot") {
    const handleInitiateScreenshot = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log("tabs", tabs);
        if (tabs.length > 0 && tabs[0].id) {
          // Send message to content script
          chrome.tabs.sendMessage(tabs[0].id, { type: "startScreenshot" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to content script:', chrome.runtime.lastError.message);
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Screenshot mode started in content script');
              sendResponse({ ok: true });
            }
          });
        } else {
          sendResponse({ ok: false, error: 'No active tab found' });
        }
      } catch (error) {
        console.error('Error in handleInitiateScreenshot:', error);
        sendResponse({ ok: false, error: error.message });
      }
    };
    handleInitiateScreenshot();
    return true; // Indicates we will send a response asynchronously
  }
  if (msg?.type === "captureRegion") {
    const { rect, devicePixelRatio } = msg
    const tabId = sender.tab?.id
    if (typeof tabId === "number") {
      chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        chrome.tabs.sendMessage(tabId, {
          type: "fullScreenshot",
          dataUrl,
          rect,
          devicePixelRatio
        })
      })
    } else {
      console.error("No valid tabId for captureRegion!", sender)
    }
    sendResponse({ ok: true })
    return true
  }
  if (msg?.type === "nanostudy-cropped-image" && msg.dataUrl) {
    // Forward the cropped image to sidepanel and other extension contexts
    chrome.runtime.sendMessage({
      type: "nanostudy-cropped-image",
      dataUrl: msg.dataUrl
    }).catch(err => {
      console.error('Error forwarding cropped image:', err);
    });
    sendResponse({ ok: true });
    return true;
  }
});