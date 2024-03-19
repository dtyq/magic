// content_script.js

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLocalStorage") {
    try {
      const localStorageData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) { // Check key is not null
            const value = localStorage.getItem(key);
            localStorageData[key] = value;
        }
      }
      sendResponse({ success: true, data: localStorageData });
    } catch (e) {
      console.error("[Content Script] Error getting localStorage:", e);
      sendResponse({ success: false, error: e.message });
    }
    return true; // Indicates that the response is sent asynchronously (or synchronously)
  }

  if (request.action === "setLocalStorage") {
    try {
      const itemsToSet = request.data || [];
      let errors = [];
      let count = 0;
      itemsToSet.forEach(item => {
        try {
           if (typeof item === 'object' && item !== null && item.name !== undefined && item.value !== undefined) {
             localStorage.setItem(item.name, item.value);
             count++;
           } else {
             console.warn("[Content Script] Skipping invalid localStorage item:", item);
           }
        } catch (e) {
          console.error(`[Content Script] Error setting localStorage item "${item ? item.name : 'unknown'}":`, e);
          errors.push(`Failed to set ${item ? item.name : 'unknown'}: ${e.message}`);
        }
      });
      sendResponse({ success: errors.length === 0, errors: errors, count: count });
    } catch (e) {
       console.error("[Content Script] Error processing setLocalStorage:", e);
       sendResponse({ success: false, errors: [e.message], count: 0 });
    }
    return true; // Indicates asynchronous response
  }

  // Add more actions here if needed
});

// Optional: Announce that the content script is ready (useful for debugging)
// console.log("[Content Script] Ready to receive messages.");
