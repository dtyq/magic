// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extract-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileLabel = document.querySelector('.file-label');
  const importFileInput = document.getElementById('import-file');
  const importArea = document.getElementById('import-area');
  const statusArea = document.getElementById('status-area');
  const progressBarContainer = document.querySelector('.progress-bar-container');
  const progressBar = document.querySelector('.progress-bar');
  const extractLocalStorageCheckbox = document.getElementById('extract-localStorage');
  const extractCookiesCheckbox = document.getElementById('extract-cookies');

  // --- Status and Progress --- //

  function showStatus(message, type = 'success') { // type: 'success', 'error', 'warning'
    statusArea.textContent = message;
    statusArea.className = type; // Reset and apply class
    statusArea.style.display = 'block';
    setTimeout(() => {
      statusArea.style.display = 'none';
      statusArea.className = '';
    }, 5000);
  }

  function showProgress(show, percent = 0) {
    if (show) {
      progressBarContainer.style.display = 'block';
      progressBar.style.width = `${percent}%`;
    } else {
      progressBarContainer.style.display = 'none';
      progressBar.style.width = `0%`;
    }
  }

  function disableButtons(disabled = true) {
      extractBtn.disabled = disabled;
      importBtn.disabled = disabled;
      importFileLabel.style.pointerEvents = disabled ? 'none' : 'auto';
      importFileLabel.style.opacity = disabled ? '0.6' : '1';
  }

  // --- Helper: Get Active Tab --- //
  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("无法获取当前活动标签页。");
    }
    return tabs[0];
  }

  // --- Helper: Inject Content Script and Send Message --- //
  async function sendMessageToContentScript(tabId, message) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
       // Check if the error is because the content script isn't injected yet
       if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
           console.log("Content script not ready or injected, attempting injection...");
           try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content_script.js']
                });
                // Wait a very short moment for the script to initialize
                await new Promise(resolve => setTimeout(resolve, 100));
                // Retry sending the message
                const retryResponse = await chrome.tabs.sendMessage(tabId, message);
                console.log("Message sent successfully after injection.");
                return retryResponse;
           } catch (injectionError) {
                console.error("Error injecting content script:", injectionError);
                throw new Error(`无法注入或连接到内容脚本: ${injectionError.message}`);
           }
       } else {
          console.error("Error sending message to content script:", error);
          throw new Error(`与内容脚本通信失败: ${error.message}`);
       }
    }
  }

  // --- Helper: SameSite Mapping --- //
  const SameSiteStatus = {
      NO_RESTRICTION: 'no_restriction',
      LAX: 'lax',
      STRICT: 'strict',
      UNSPECIFIED: 'unspecified' // Though get returns no_restriction for None usually
  };

  const PlaywrightSameSite = {
      NONE: 'None',
      LAX: 'Lax',
      STRICT: 'Strict'
  };

  function mapChromeSameSiteToPlaywright(chromeStatus) {
    switch(chromeStatus) {
      case SameSiteStatus.STRICT:
        return PlaywrightSameSite.STRICT;
      case SameSiteStatus.LAX:
        return PlaywrightSameSite.LAX;
      case SameSiteStatus.NO_RESTRICTION:
      case SameSiteStatus.UNSPECIFIED: // Treat unspecified as None
      default:
        return PlaywrightSameSite.NONE;
    }
  }

  function mapPlaywrightSameSiteToChromeSet(playwrightStatus) {
    switch(playwrightStatus) {
      case PlaywrightSameSite.STRICT:
        return SameSiteStatus.STRICT;
      case PlaywrightSameSite.LAX:
        return SameSiteStatus.LAX;
      case PlaywrightSameSite.NONE:
      default: // Treat unknown as no_restriction
        return SameSiteStatus.NO_RESTRICTION;
        // Note: chrome.cookies.set technically accepts 'unspecified' but defaults to no_restriction behavior
    }
  }

  // --- Extraction Logic --- //

  async function handleExtract() {
    disableButtons(true);
    showProgress(true, 0);
    showStatus("正在提取数据...", 'warning');

    try {
      const activeTab = await getActiveTab();
      const tabId = activeTab.id;
      const tabUrl = activeTab.url;

      if (!tabUrl || !tabId) {
        throw new Error("无法获取有效的标签页信息。");
      }

      // Ensure URL is http/https for cookie/scripting access
      if (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) {
          throw new Error("此插件只能在 HTTP 或 HTTPS 页面上运行。");
      }

      let localStorageData = {};
      let cookieItems = [];

      // 1. Get localStorage (if checked)
      if (extractLocalStorageCheckbox.checked) {
        showProgress(true, 10);
        console.log("Requesting localStorage from content script...");
        const response = await sendMessageToContentScript(tabId, { action: "getLocalStorage" });
        console.log("Received localStorage response:", response);
        if (response && response.success) {
          // Format for storage_state
          localStorageData = Object.entries(response.data || {}).map(([name, value]) => ({ name, value }));
        } else {
          console.warn("从内容脚本获取 localStorage 失败:", response ? response.error : '未知错误');
          // Proceed without localStorage, maybe show warning later
        }
      } else {
          localStorageData = []; // Ensure it's an empty array if not checked
      }

      showProgress(true, 40);

      // 2. Get Cookies (if checked)
      if (extractCookiesCheckbox.checked) {
         console.log(`Requesting cookies for URL: ${tabUrl}`);
         try {
            // chrome.cookies.getAll requires a URL or domain
            const cookies = await chrome.cookies.getAll({ url: tabUrl });
            console.log(`Got ${cookies.length} cookies.`);
            // Map to storage_state format
            cookieItems = cookies.map(cookie => ({
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              expires: cookie.expirationDate ? cookie.expirationDate : -1, // Convert to seconds since epoch or -1
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: mapChromeSameSiteToPlaywright(cookie.sameSite)
            }));
         } catch (cookieError) {
             console.error("获取 Cookies 时出错:", cookieError);
             throw new Error(`获取 Cookies 失败: ${cookieError.message}`);
         }
      } else {
          cookieItems = []; // Ensure it's an empty array if not checked
      }

      showProgress(true, 80);

      // 3. Combine data
      const browserData = {
        cookies: cookieItems,
        origins: [
          {
            origin: new URL(tabUrl).origin,
            localStorage: localStorageData
          }
        ]
      };

      // 4. Convert to JSON and Download
      const dataStr = JSON.stringify(browserData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);

      const safeHostname = new URL(tabUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const filename = `storage_state-${safeHostname}-${timestamp}.json`;

      console.log(`Triggering download for: ${filename}`);
      try {
          await chrome.downloads.download({
            url: downloadUrl,
            filename: filename,
            saveAs: true // Prompt user where to save
          });
          // Note: We don't revokeObjectURL here immediately,
          // as the download might take time. Browser usually handles it.
          showProgress(true, 100);
          showStatus(`成功提取 ${localStorageData.length} 个 localStorage 项和 ${cookieItems.length} 个 cookie。已开始下载文件。`, 'success');

      } catch (downloadError) {
          console.error("下载文件时出错:", downloadError);
          showStatus(`提取数据成功，但下载文件失败: ${downloadError.message}`, 'error');
          // Clean up blob URL if download fails
          URL.revokeObjectURL(downloadUrl);
      }

    } catch (error) {
      console.error("提取处理过程中出错:", error);
      showStatus(`提取失败: ${error.message}`, 'error');
      showProgress(false);
    } finally {
      disableButtons(false);
       // Ensure progress bar hides even on error, after a short delay
      setTimeout(() => showProgress(false), 500);
    }
  }

  // --- Import Logic (Placeholder) --- //

  async function handleImport(dataStr) {
     disableButtons(true);
     showProgress(true, 0);
     showStatus("正在导入数据...", 'warning');
     console.log("Import requested...");

     if (!dataStr) {
        showStatus("没有可导入的数据。", 'error');
        disableButtons(false);
        showProgress(false);
        return;
     }

     try {
         const browserData = JSON.parse(dataStr);
         const activeTab = await getActiveTab();
         const tabId = activeTab.id;
         const tabUrl = activeTab.url;
         const currentOrigin = new URL(tabUrl).origin;

         if (!tabUrl || !tabId || (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://'))) {
             throw new Error("无法在当前标签页导入数据 (需要 HTTP/HTTPS 页面)。");
         }

         let totalOperations = 0;
         let completedOperations = 0;
         const errors = [];
         const warnings = [];

         // 1. Import LocalStorage
         let localStorageToImport = [];
         if (browserData.origins && Array.isArray(browserData.origins)) {
            const originData = browserData.origins.find(o => o.origin === currentOrigin);
            if (originData && originData.localStorage && Array.isArray(originData.localStorage)) {
                localStorageToImport = originData.localStorage;
                totalOperations += localStorageToImport.length;
            } else {
                warnings.push(`未找到与当前源 ${currentOrigin} 匹配的 localStorage 数据进行导入。`);
            }
         } else {
             warnings.push("数据格式错误：缺少 'origins' 数组。");
         }

         if (localStorageToImport.length > 0) {
            console.log(`Sending ${localStorageToImport.length} localStorage items to content script...`);
            const response = await sendMessageToContentScript(tabId, { action: "setLocalStorage", data: localStorageToImport });
            console.log("setLocalStorage response:", response);
            if (response && response.success) {
                completedOperations += response.count || 0;
                showProgress(true, (completedOperations / totalOperations) * 100 * 0.5); // LS is 50% of progress
            } else {
                errors.push(...(response.errors || ['设置 localStorage 时发生未知错误。']));
                completedOperations += response.count || 0; // Count successful ones even if some failed
            }
            if (response && response.errors && response.errors.length > 0) {
                warnings.push(...response.errors.map(e => `LocalStorage 设置失败: ${e}`));
            }
         }

         // 2. Import Cookies
         let cookiesToImport = [];
         if (browserData.cookies && Array.isArray(browserData.cookies)) {
             cookiesToImport = browserData.cookies;
             totalOperations += cookiesToImport.length;
         } else {
             warnings.push("数据格式错误：缺少 'cookies' 数组。");
         }

         for (const cookie of cookiesToImport) {
            if (typeof cookie !== 'object' || cookie === null || !cookie.name) {
                warnings.push(`跳过无效的 Cookie 对象: ${JSON.stringify(cookie)}`);
                completedOperations++; // Count as processed
                continue;
            }

            const cookieDetails = {
                url: tabUrl, // Crucial: Cookie URL must match the domain/path
                name: cookie.name,
                value: cookie.value || "", // Ensure value is a string
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                // Handle expirationDate: needs to be epoch seconds
                expirationDate: (cookie.expires && cookie.expires > 0) ? cookie.expires : undefined,
                // Apply mapping here for import before setting
                sameSite: mapPlaywrightSameSiteToChromeSet(cookie.sameSite)
            };

            // Clean up details: remove undefined keys which chrome.cookies.set doesn't like
            Object.keys(cookieDetails).forEach(key => {
                if (cookieDetails[key] === undefined || cookieDetails[key] === null) {
                    delete cookieDetails[key];
                }
            });
            // Ensure URL is set for context
            if (!cookieDetails.url) {
                cookieDetails.url = tabUrl;
            }

            // Attempt to remove existing cookie first to ensure overwrite
            try {
                await chrome.cookies.remove({ url: cookieDetails.url, name: cookieDetails.name });
            } catch (removeError) {
                // Ignore error if cookie didn't exist
                if (!removeError.message.includes("No cookie found")) {
                    console.warn(`移除旧 cookie '${cookieDetails.name}' 时出错 (可能不存在):`, removeError);
                }
            }

            // Set the new cookie
            try {
                console.log("Setting cookie:", cookieDetails);
                await chrome.cookies.set(cookieDetails);
            } catch (setCookieError) {
                console.error(`设置 cookie '${cookieDetails.name}' 时出错:`, setCookieError, "Details:", cookieDetails);
                errors.push(`设置 Cookie '${cookieDetails.name}' 失败: ${setCookieError.message}`);
            }
            completedOperations++;
            showProgress(true, 50 + (completedOperations / totalOperations) * 100 * 0.5); // Cookies are second 50%
         }

         // 3. Final Status
         showProgress(true, 100);
         let finalMessage = `导入完成。`;
         let finalType = 'success';

         if (warnings.length > 0) {
             finalMessage += ` (${warnings.length} 个警告)`;
             finalType = 'warning';
             console.warn("导入警告:", warnings);
         }
         if (errors.length > 0) {
             finalMessage = `导入过程中遇到 ${errors.length} 个错误。请检查控制台。`;
             finalType = 'error';
             console.error("导入错误:", errors);
         }
         showStatus(finalMessage, finalType);

     } catch (error) {
         console.error("导入处理过程中出错:", error);
         showStatus(`导入失败: ${error.message}`, 'error');
         showProgress(false);
         if (error instanceof SyntaxError) {
             showStatus(`导入失败: 无效的 JSON 数据。`, 'error');
         }
     } finally {
         disableButtons(false);
         // Ensure progress bar hides even on error, after a short delay
         setTimeout(() => showProgress(false), 500);
     }

  }

  // --- Event Listeners --- //

  if (extractBtn) {
    extractBtn.addEventListener('click', handleExtract);
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
        const dataStr = importArea.value;
        handleImport(dataStr);
    });
  }

  // Trigger hidden file input click when label is clicked
  if (importFileLabel && importFileInput) {
    importFileLabel.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          importArea.value = e.target.result; // Load file content into textarea
          showStatus('文件已加载到文本框，点击"导入数据"继续', 'success');
        };
        reader.onerror = (e) => {
          console.error("文件读取错误:", e);
          showStatus(`读取文件失败: ${e.target.error}`, 'error');
        };
        reader.readAsText(file);
      }
      // Reset file input so the same file can be selected again
      event.target.value = null;
    });
  }
});
