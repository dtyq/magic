/**
 * Early browser compatibility pre-check and upgrade prompt.
 * Zero-dependency, pure ES5 script to prevent blank screen crashes on outdated browsers.
 */
;(function initBrowserCompatCheck() {
	try {
		/**
		 * Minimum supported browser versions configuration.
		 * Centralized for easy maintenance and readability.
		 */
		var MIN_VERSIONS = {
			Chrome: 111,
			Edge: 111,
			Firefox: 114,
			Safari: 16.4,
		}

		var urlSearch = window.location.search || ""
		var isDebugForceShow =
			urlSearch.indexOf("mock_browser_outdated=true") !== -1 || !!window.__FORCE_BROWSER_WARNING__
	var isDebugForceDisable = urlSearch.indexOf("disable_browser_warning=true") !== -1

	/**
	 * Checks whether the browser warning is disabled by a global configuration.
	 * Supports window.DISABLE_BROWSER_WARNING, window.CONFIG.ENABLE_BROWSER_WARNING, or ?disable_browser_warning=true.
	 *
	 * @returns {boolean} True if warning should be suppressed
	 */
	function isWarningDisabled() {
		try {
			if (isDebugForceDisable) {
				return true
			}
			if (typeof window.DISABLE_BROWSER_WARNING !== "undefined" && window.DISABLE_BROWSER_WARNING) {
				return true
			}
			if (
				window.CONFIG &&
				typeof window.CONFIG.ENABLE_BROWSER_WARNING !== "undefined" &&
				!window.CONFIG.ENABLE_BROWSER_WARNING
			) {
				return true
			}
		} catch (e) {}
		return false
	}

	if (isWarningDisabled()) {
		return
	}

	var STORAGE_KEY_14D = "MAGIC_BROWSER_WARN_SUPPRESSED_UNTIL"
	var STORAGE_KEY_TEMP = "MAGIC_BROWSER_WARN_TEMP_UNTIL"
	var STORAGE_KEY_SESSION = "MAGIC_BROWSER_WARN_SESSION_IGNORED"

	/** DOM ids of the parts this script owns, used for container-scoped lookups. */
	var MODAL_ID = "__browser_compat_modal__"
	var CONTINUE_BUTTON_ID = "__btn_browser_continue__"
	var SUPPRESS_CHECKBOX_ID = "__chk_browser_14d__"
	var DINGTALK_TIP_ID = "__dingtalk_browser_tip__"

	/**
	 * Whether the warning has already been rendered in this document.
	 * Guards the modal against a duplicated `DOMContentLoaded` (see renderWarningModal).
	 */
	var hasRenderedWarning = false

	/**
	 * Verifies if user has previously opted to suppress the warning or has already confirmed in this session.
	 * Prevents duplicate prompts when navigating across pages (e.g. login page -> home page).
	 *
	 * @returns {boolean} True if suppressed in browser storage
	 */
	function isSuppressedByStorage() {
		// When force-debugging outdated browser prompt, bypass storage suppression
		if (isDebugForceShow) {
			return false
		}
		try {
			// Check 14-day persistent suppression
			if (window.localStorage) {
				var suppressUntil = parseInt(window.localStorage.getItem(STORAGE_KEY_14D), 10)
				if (suppressUntil && Date.now() < suppressUntil) {
					return true
				}
				// Check short-term suppression to prevent login -> home page bounce
				var tempUntil = parseInt(window.localStorage.getItem(STORAGE_KEY_TEMP), 10)
				if (tempUntil && Date.now() < tempUntil) {
					return true
				}
			}
			// Check current tab session suppression
			if (window.sessionStorage && window.sessionStorage.getItem(STORAGE_KEY_SESSION)) {
				return true
			}
		} catch (e) {}
		return false
	}

	if (isSuppressedByStorage()) {
		return
	}

	/**
	 * Detects DingTalk on Android. Its webview offers no way to switch browsers on its
	 * own, so the warning needs to point at DingTalk's own top-right menu.
	 *
	 * @returns {boolean} True when the page is opened inside DingTalk on Android
	 */
	function isDingTalkAndroid() {
		var ua = navigator.userAgent || ""
		return /dingtalk/i.test(ua) && /android/i.test(ua)
	}

	/**
	 * Feature detection for essential modern JavaScript and browser APIs.
	 * If essential modern features are missing, the modern React bundle cannot execute.
	 *
	 * @returns {boolean} True if essential modern features are available
	 */
	function checkEssentialFeatures() {
		try {
			return !!(
				window.Promise &&
				window.fetch &&
				window.Symbol &&
				window.URL &&
				window.Proxy &&
				window.MutationObserver &&
				document.querySelector &&
				Object.assign &&
				Array.prototype.includes
			)
		} catch (e) {
			return false
		}
	}

	/**
	 * Determines browser name, major version, and compatibility state.
	 * Covers Edge, Chrome (including iOS CriOS), Firefox (including iOS FxiOS), Safari, and legacy IE.
	 *
	 * @returns {{ name: string, version: number, isOutdated: boolean }} Compatibility evaluation
	 */
	function detectBrowserCompatibility() {
		var ua = navigator.userAgent || ""
		var name = "Unknown"
		var version = 0
		var isOutdated = false

		var isIE = ua.indexOf("MSIE ") !== -1 || ua.indexOf("Trident/") !== -1
		var isLegacyEdge = ua.indexOf("Edge/") !== -1
		var isIOS = /iP(hone|od|ad)/.test(ua)

		if (isIE) {
			isOutdated = true
			name = "Internet Explorer"
			var ieMatch = ua.match(/(MSIE\s|rv:)([\d.]+)/)
			version = ieMatch ? parseInt(ieMatch[2], 10) : 11
		} else if (isLegacyEdge) {
			isOutdated = true
			name = "Edge (Legacy)"
			var legacyMatch = ua.match(/Edge\/(\d+)/)
			version = legacyMatch ? parseInt(legacyMatch[1], 10) : 18
		} else if (ua.indexOf("Edg/") !== -1 || ua.indexOf("EdgiOS/") !== -1) {
			name = "Edge"
			var edgeMatch = ua.match(/Edg(iOS)?\/(\d+)/)
			version = edgeMatch ? parseInt(edgeMatch[2], 10) : 0
			if (version < MIN_VERSIONS.Edge) isOutdated = true
		} else if (ua.indexOf("Chrome/") !== -1 || ua.indexOf("CriOS/") !== -1) {
			name = "Chrome"
			var chromeMatch = ua.match(/(Chrome|CriOS)\/(\d+)/)
			version = chromeMatch ? parseInt(chromeMatch[2], 10) : 0
			if (version < MIN_VERSIONS.Chrome) isOutdated = true
		} else if (ua.indexOf("Firefox/") !== -1 || ua.indexOf("FxiOS/") !== -1) {
			name = "Firefox"
			var ffMatch = ua.match(/(Firefox|FxiOS)\/(\d+)/)
			version = ffMatch ? parseInt(ffMatch[2], 10) : 0
			if (version < MIN_VERSIONS.Firefox) isOutdated = true
		} else if (
			ua.indexOf("Safari/") !== -1 &&
			ua.indexOf("Chrome") === -1 &&
			ua.indexOf("Android") === -1
		) {
			name = "Safari"
			var safariMatch = ua.match(/Version\/(\d+(\.\d+)?)/)
			if (safariMatch) {
				version = parseFloat(safariMatch[1])
			} else if (isIOS) {
				var osMatch = ua.match(/OS (\d+)_(\d+)/)
				version = osMatch ? parseFloat(osMatch[1] + "." + osMatch[2]) : 0
			}
			if (version < MIN_VERSIONS.Safari) isOutdated = true
		} else if (isIOS) {
			// Handle iOS in-app WebViews (e.g. WeChat, DingTalk) that lack "Safari/" token
			name = "Safari (iOS WebView)"
			var iosMatch = ua.match(/OS (\d+)_(\d+)/)
			version = iosMatch ? parseFloat(iosMatch[1] + "." + iosMatch[2]) : 0
			if (version < MIN_VERSIONS.Safari) isOutdated = true
		} else {
			name = "Browser"
			if (!checkEssentialFeatures()) {
				isOutdated = true
			}
		}

		if (!checkEssentialFeatures()) {
			isOutdated = true
		}

		return {
			name: name,
			version: version,
			isOutdated: isOutdated,
		}
	}

	var compat = detectBrowserCompatibility()

	// If debug force-show is active, mock an outdated Chrome environment for testing
	if (isDebugForceShow && !compat.isOutdated) {
		compat = {
			name: "Chrome",
			version: MIN_VERSIONS.Chrome - 1,
			isOutdated: true,
		}
	}

	if (!compat.isOutdated) {
		return
	}

	/**
	 * Constructs and mounts the warning modal on the document body.
	 *
	 * Renders at most once per document. Legacy browsers get the page in es-module-shims
	 * shim mode (server/middleware/seoMiddleware/getHtmlTemplate.js), and es-module-shims
	 * re-dispatches `DOMContentLoaded` after the import map is ready, so this listener does
	 * fire twice. A second render used to stack a duplicate overlay and, because both
	 * renders shared one element id, the visible button ended up without a click handler.
	 */
	function renderWarningModal() {
		if (hasRenderedWarning || document.getElementById(MODAL_ID)) {
			return
		}
		hasRenderedWarning = true

		if (isWarningDisabled() || isSuppressedByStorage()) {
			return
		}
		var lang = (navigator.language || navigator.userLanguage || "").toLowerCase()
		var isZh = lang.indexOf("zh") !== -1

		/**
		 * Download recommendations for both supported browsers, ordered by what the
		 * user's region can actually reach: mainland China promotes Edge first and
		 * points Chrome at the mirror domain, other regions promote Chrome first.
		 */
		var downloadLinks = isZh
			? [
					{
						url: "https://www.microsoft.com/zh-cn/edge/download",
						text: "下载 Microsoft Edge 官方版",
					},
					{
						url: "https://www.google.cn/chrome/",
						text: "下载 Google Chrome 官方版",
					},
			  ]
			: [
					{
						url: "https://www.google.com/chrome/",
						text: "Download Google Chrome",
					},
					{
						url: "https://www.microsoft.com/edge/download",
						text: "Download Microsoft Edge",
					},
			  ]

		/** Builds the stacked download links while keeping the recommended order. */
		var downloadLinksHtml = ""
		for (var linkIndex = 0; linkIndex < downloadLinks.length; linkIndex++) {
			downloadLinksHtml +=
				'<a href="' +
				downloadLinks[linkIndex].url +
				'" target="_blank" rel="noopener noreferrer" ' +
				'style="display:block;color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;' +
				(linkIndex > 0 ? "margin-top:8px;" : "") +
				'">' +
				downloadLinks[linkIndex].text +
				" &rarr;</a>"
		}

		var tips = isZh
			? [
					"Chrome " + MIN_VERSIONS.Chrome + " 或更高版本",
					"Edge " + MIN_VERSIONS.Edge + " 或更高版本",
					"Firefox " + MIN_VERSIONS.Firefox + " 或更高版本",
					"Safari " + MIN_VERSIONS.Safari + " 或更高版本",
			  ]
			: [
					"Chrome " + MIN_VERSIONS.Chrome + " or higher",
					"Edge " + MIN_VERSIONS.Edge + " or higher",
					"Firefox " + MIN_VERSIONS.Firefox + " or higher",
					"Safari " + MIN_VERSIONS.Safari + " or higher",
			  ]

		var tipListHtml = ""
		for (var i = 0; i < tips.length; i++) {
			tipListHtml += "<li>" + tips[i] + "</li>"
		}

		var text = isZh
			? {
					title: "浏览器版本过低",
					desc: "检测到您正在使用较旧版本的浏览器，建议使用以下浏览器以获得最佳体验：",
					recommendTitle: "推荐下载：",
					warn: "继续使用旧版浏览器可能导致页面白屏、样式错乱或部分功能异常。",
					ignore14d: "最近 14 天不再提示",
					btnContinue: "继续使用（可能存在兼容性问题）",
					dingtalkTip:
						"当前在钉钉内打开：点击右上角「···」并选择「在浏览器中打开」，可获得完整体验。",
			  }
			: {
					title: "Browser Outdated",
					desc: "Your browser is out of date. Please use one of the following for the best experience:",
					recommendTitle: "Recommended:",
					warn: "Using an outdated browser may lead to unexpected errors or blank screens.",
					ignore14d: "Don't remind me again for 14 days",
					btnContinue: "Continue anyway",
					dingtalkTip:
						'Opened inside DingTalk: tap "···" at the top-right and choose "Open in browser" for the full experience.',
			  }

		/** Guidance block rendered only when the page runs inside DingTalk on Android. */
		var dingtalkTipHtml = isDingTalkAndroid()
			? '<div id="' +
			  DINGTALK_TIP_ID +
			  '" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;' +
			  'font-size:13px;color:#1d4ed8;line-height:1.5;margin-bottom:14px;">' +
			  text.dingtalkTip +
			  "</div>"
			: ""

		var modalContainer = document.createElement("div")
		modalContainer.id = MODAL_ID
		modalContainer.style.cssText =
			"position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);" +
			"z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
			"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC',sans-serif;" +
			"padding:16px;box-sizing:border-box;"

		modalContainer.innerHTML =
			'<div style="background:#ffffff;border-radius:12px;padding:24px;width:100%;max-width:440px;' +
			'max-height:90vh;overflow-y:auto;box-shadow:0 12px 32px rgba(0,0,0,0.18);box-sizing:border-box;text-align:left;">' +
			'<div style="font-size:18px;font-weight:600;color:#111827;margin-bottom:8px;">' +
			text.title +
			"</div>" +
			'<div style="font-size:14px;color:#4b5563;line-height:1.5;margin-bottom:10px;">' +
			text.desc +
			"</div>" +
			dingtalkTipHtml +
			'<ul style="font-size:13px;color:#6b7280;margin:0 0 14px 20px;padding:0;line-height:1.6;">' +
			tipListHtml +
			"</ul>" +
			'<div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin-bottom:16px;">' +
			'<div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:500;">' +
			text.recommendTitle +
			"</div>" +
			downloadLinksHtml +
			"</div>" +
			'<div style="font-size:12px;color:#dc2626;margin-bottom:18px;line-height:1.4;">' +
			text.warn +
			"</div>" +
			'<div style="margin-bottom:16px;display:flex;align-items:center;">' +
			'<input type="checkbox" id="' +
			SUPPRESS_CHECKBOX_ID +
			'" style="width:16px;height:16px;margin:0 8px 0 0;cursor:pointer;vertical-align:middle;" />' +
			'<label for="' +
			SUPPRESS_CHECKBOX_ID +
			'" style="font-size:13px;color:#4b5563;cursor:pointer;user-select:none;">' +
			text.ignore14d +
			"</label>" +
			"</div>" +
			'<button id="' +
			CONTINUE_BUTTON_ID +
			'" style="width:100%;height:38px;background:#111827;color:#ffffff;' +
			'border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:500;outline:none;">' +
			text.btnContinue +
			"</button>" +
			"</div>"

		/**
		 * Handles click on continue button, saving user choice to avoid duplicate popups.
		 */
		function onContinue() {
			// Container-scoped lookup: a document-wide one could read another overlay's checkbox.
			var chk = modalContainer.querySelector("#" + SUPPRESS_CHECKBOX_ID)
			var is14DaysChecked = chk && chk.checked
			try {
				if (is14DaysChecked && window.localStorage) {
					// Suppress for 14 days
					var expireAt = Date.now() + 14 * 24 * 60 * 60 * 1000
					window.localStorage.setItem(STORAGE_KEY_14D, expireAt.toString())
				} else if (window.localStorage) {
					// Suppress for 24 hours to ensure no duplicate prompt across login -> home transitions
					var tempExpire = Date.now() + 24 * 60 * 60 * 1000
					window.localStorage.setItem(STORAGE_KEY_TEMP, tempExpire.toString())
				}
				if (window.sessionStorage) {
					window.sessionStorage.setItem(STORAGE_KEY_SESSION, "true")
				}
			} catch (e) {}

			if (modalContainer.parentNode) {
				modalContainer.parentNode.removeChild(modalContainer)
			}
		}

		if (document.body) {
			document.body.appendChild(modalContainer)
			// Bind through the container: `document.getElementById` would return the first
			// matching button in the document, leaving this modal's button inert.
			var btn = modalContainer.querySelector("#" + CONTINUE_BUTTON_ID)
			if (btn) {
				btn.onclick = onContinue
			}
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", renderWarningModal)
	} else {
		renderWarningModal()
	}
	} catch (e) {
		// Fail-safe: Any unexpected exception must never block downstream page scripts.
	}
})()
