/**
 * View Transition API 移动端调试工具
 * 用于诊断移动端 View Transition 不生效的问题
 */

export interface ViewTransitionDebugInfo {
	// 浏览器信息
	userAgent: string
	isMobile: boolean
	platform: string

	// API 支持情况
	isViewTransitionSupported: boolean
	isDocumentStartViewTransitionAvailable: boolean
	isCSSViewTransitionSupported: boolean

	// 系统设置
	prefersReducedMotion: boolean

	// 性能相关
	devicePixelRatio: number
	screenSize: { width: number; height: number }

	// 具体浏览器版本
	browserInfo: {
		name: string
		version: string
		engine: string
	}
}

/**
 * 获取浏览器信息
 */
function getBrowserInfo(): ViewTransitionDebugInfo["browserInfo"] {
	const userAgent = navigator.userAgent

	// 检测浏览器类型和版本
	let name = "Unknown"
	let version = "Unknown"
	let engine = "Unknown"

	if (userAgent.includes("Chrome")) {
		name = "Chrome"
		const match = userAgent.match(/Chrome\/(\d+)/)
		version = match ? match[1] : "Unknown"
		engine = "Blink"
	} else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
		name = "Safari"
		const match = userAgent.match(/Version\/(\d+)/)
		version = match ? match[1] : "Unknown"
		engine = "WebKit"
	} else if (userAgent.includes("Firefox")) {
		name = "Firefox"
		const match = userAgent.match(/Firefox\/(\d+)/)
		version = match ? match[1] : "Unknown"
		engine = "Gecko"
	} else if (userAgent.includes("Samsung")) {
		name = "Samsung Internet"
		const match = userAgent.match(/SamsungBrowser\/(\d+)/)
		version = match ? match[1] : "Unknown"
		engine = "Blink"
	}

	return { name, version, engine }
}

/**
 * 检测移动设备
 */
function getIsMobile(): boolean {
	if (typeof window === "undefined") return false

	return (
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent,
		) || window.innerWidth <= 768
	)
}

/**
 * 检测 CSS View Transition 支持
 */
function checkCSSViewTransitionSupport(): boolean {
	if (typeof CSS === "undefined") return false

	try {
		// 检查 CSS.supports 是否支持 view-transition-name
		return CSS.supports("view-transition-name", "test")
	} catch {
		return false
	}
}

/**
 * 获取完整的调试信息
 */
export function getViewTransitionDebugInfo(): ViewTransitionDebugInfo {
	if (typeof window === "undefined") {
		return {
			userAgent: "Server Side",
			isMobile: false,
			platform: "server",
			isViewTransitionSupported: false,
			isDocumentStartViewTransitionAvailable: false,
			isCSSViewTransitionSupported: false,
			prefersReducedMotion: false,
			devicePixelRatio: 1,
			screenSize: { width: 0, height: 0 },
			browserInfo: { name: "Unknown", version: "Unknown", engine: "Unknown" },
		}
	}

	return {
		userAgent: navigator.userAgent,
		isMobile: getIsMobile(),
		platform: navigator.platform,
		isViewTransitionSupported:
			typeof document !== "undefined" && "startViewTransition" in document,
		isDocumentStartViewTransitionAvailable: typeof document?.startViewTransition === "function",
		isCSSViewTransitionSupported: checkCSSViewTransitionSupport(),
		prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		devicePixelRatio: window.devicePixelRatio,
		screenSize: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		browserInfo: getBrowserInfo(),
	}
}

/**
 * 打印调试信息到控制台
 */
export function debugViewTransitionSupport(): ViewTransitionDebugInfo {
	const info = getViewTransitionDebugInfo()

	console.group("🔍 View Transition API 调试信息")
	console.log("📱 设备信息:", {
		isMobile: info.isMobile,
		platform: info.platform,
		screenSize: info.screenSize,
		devicePixelRatio: info.devicePixelRatio,
	})

	console.log("🌐 浏览器信息:", info.browserInfo)
	console.log("📋 User Agent:", info.userAgent)

	console.log("✅ API 支持情况:", {
		isViewTransitionSupported: info.isViewTransitionSupported,
		isDocumentStartViewTransitionAvailable: info.isDocumentStartViewTransitionAvailable,
		isCSSViewTransitionSupported: info.isCSSViewTransitionSupported,
	})

	console.log("⚙️ 系统设置:", {
		prefersReducedMotion: info.prefersReducedMotion,
	})

	// 给出具体建议
	if (!info.isViewTransitionSupported) {
		console.warn("❌ View Transition API 不被支持")

		const { name, version } = info.browserInfo
		const suggestions = []

		if (name === "Safari" && parseInt(version) < 18) {
			suggestions.push("Safari 18+ 才支持 View Transition API")
		}
		if (name === "Chrome" && parseInt(version) < 111) {
			suggestions.push("Chrome 111+ 才支持 View Transition API")
		}
		if (name === "Firefox") {
			suggestions.push("Firefox 暂不支持 View Transition API")
		}

		if (suggestions.length > 0) {
			console.log("💡 建议:", suggestions)
		}
	} else {
		console.log("✅ View Transition API 受支持!")
	}

	if (info.prefersReducedMotion) {
		console.warn("⚠️ 用户偏好减少动画，View Transition 可能被禁用")
	}

	console.groupEnd()

	return info
}

/**
 * 测试 View Transition 功能
 */
export function testViewTransition(): Promise<boolean> {
	return new Promise((resolve) => {
		const info = getViewTransitionDebugInfo()

		if (!info.isViewTransitionSupported) {
			console.warn("❌ View Transition API 不支持，测试跳过")
			resolve(false)
			return
		}

		console.log("🧪 开始测试 View Transition...")

		try {
			// 创建一个简单的测试
			const testElement = document.createElement("div")
			testElement.style.cssText = `
				position: fixed;
				top: -100px;
				left: -100px;
				width: 1px;
				height: 1px;
				background: red;
				view-transition-name: test-transition;
			`
			document.body.appendChild(testElement)

			const transition = document.startViewTransition(() => {
				testElement.style.background = "blue"
			})

			transition.finished
				.then(() => {
					console.log("✅ View Transition 测试成功!")
					document.body.removeChild(testElement)
					resolve(true)
				})
				.catch((error) => {
					console.error("❌ View Transition 测试失败:", error)
					document.body.removeChild(testElement)
					resolve(false)
				})
		} catch (error) {
			console.error("❌ View Transition 测试异常:", error)
			resolve(false)
		}
	})
}

/**
 * 移动端兼容性检查器
 */
export function checkMobileCompatibility(): {
	isCompatible: boolean
	issues: string[]
	recommendations: string[]
} {
	const info = getViewTransitionDebugInfo()
	const issues: string[] = []
	const recommendations: string[] = []

	if (!info.isMobile) {
		return {
			isCompatible: true,
			issues: ["当前不是移动设备"],
			recommendations: ["在移动设备上测试以获得准确结果"],
		}
	}

	// 检查浏览器兼容性
	const { name, version } = info.browserInfo

	if (name === "Safari" && parseInt(version) < 18) {
		issues.push(`Safari ${version} 不支持 View Transition API`)
		recommendations.push("升级到 Safari 18+ 或使用 Chrome/Edge")
	}

	if (name === "Chrome" && parseInt(version) < 111) {
		issues.push(`Chrome ${version} 不支持 View Transition API`)
		recommendations.push("升级到 Chrome 111+")
	}

	if (name === "Firefox") {
		issues.push("Firefox 暂不支持 View Transition API")
		recommendations.push("使用 Chrome、Safari 或 Edge")
	}

	if (name === "Samsung Internet" && parseInt(version) < 23) {
		issues.push(`Samsung Internet ${version} 不支持 View Transition API`)
		recommendations.push("升级到 Samsung Internet 23+")
	}

	// 检查系统设置
	if (info.prefersReducedMotion) {
		issues.push("系统设置偏好减少动画")
		recommendations.push("检查系统设置中的动画选项")
	}

	// 检查性能相关
	if (info.devicePixelRatio > 3) {
		recommendations.push("高分辨率设备，建议优化动画性能")
	}

	const isCompatible = issues.length === 0

	return {
		isCompatible,
		issues,
		recommendations,
	}
}

// 开发环境下自动运行调试
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
	// 延迟执行，确保页面加载完成
	setTimeout(() => {
		if (window.location.search.includes("debug-view-transition")) {
			debugViewTransitionSupport()
			checkMobileCompatibility()
		}
	}, 1000)
}
