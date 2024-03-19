/** User Behavior Analysis Parser */
module.exports.userBehaviorAnalysisParser = function userBehaviorAnalysisParser(behaviorAnalysis) {
	// CNZZ User Behavior Analysis
	if (behaviorAnalysis?.strategy === "CNZZ") {
		return `
		<script>
			;(function () {
				var _czc = _czc || []
				window._czc = _czc

				function loadCnzzScript() {
					if (navigator.userAgent.toLowerCase().indexOf("dingtalk") > -1) {
						return
					}
					const cnzzScript = document.createElement("script")
					cnzzScript.async = true
					cnzzScript.src = "https://v1.cnzz.com/z.js?id=${behaviorAnalysis?.options?.id}&async=1"

					cnzzScript.onerror = function() {
						console.warn("[CNZZ Analytics] Script load failed, events cached in _czc")
					}
					document.head.appendChild(cnzzScript)
				}

				if (document.readyState === "complete") {
					loadCnzzScript()
				} else {
					window.addEventListener("load", loadCnzzScript, { once: true })
				}
			})()
		</script>`
	}

	// Google User Behavior Analysis
	if (behaviorAnalysis?.strategy === "Google") {
		return `
		<script>
			;(function () {
				window.dataLayer = window.dataLayer || []
				function gtag() {
					dataLayer.push(arguments)
				}
				window.gtag = gtag
				gtag("js", new Date())
				gtag("config", "${behaviorAnalysis?.options?.id}")

				function loadGtagScript() {
					if (navigator.userAgent.toLowerCase().indexOf("dingtalk") > -1) {
						return
					}
					const gtagScript = document.createElement("script")
					gtagScript.async = true
					gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=${behaviorAnalysis?.options?.id}"
					
					gtagScript.onerror = function() {
						console.warn("[Google Analytics] Script load failed, events cached in dataLayer")
					}
					
					document.head.appendChild(gtagScript)
				}

				if (document.readyState === "complete") {
					loadGtagScript()
				} else {
					window.addEventListener("load", loadGtagScript, { once: true })
				}
			})()
		</script>`
	}
}
