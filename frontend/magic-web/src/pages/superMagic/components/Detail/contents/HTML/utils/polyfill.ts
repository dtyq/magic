/**
 * JavaScript Polyfill 工具函数
 * 用于在 HTML 内容中注入必要的 polyfill 脚本
 */

/**
 * 生成 Array/String/TypedArray.prototype.at() polyfill 脚本
 * Source - https://stackoverflow.com/a/70557417
 * Posted by CertainPerformance
 * Retrieved 2025-12-12, License - CC BY-SA 4.0
 *
 * @returns polyfill 脚本字符串
 */
export function generateAtPolyfillScript(): string {
	return `
(function() {
	// 检查是否已经存在 at 方法，避免重复定义
	if (Array.prototype.at && String.prototype.at) {
		// 检查 TypedArray 是否也支持 at
		const TypedArray = Reflect.getPrototypeOf(Int8Array);
		if (TypedArray && TypedArray.prototype.at) {
			return; // 所有类型都已支持，无需 polyfill
		}
	}

	function at(n) {
		// ToInteger() abstract op
		n = Math.trunc(n) || 0;
		// Allow negative indexing from the end
		if (n < 0) n += this.length;
		// OOB access is guaranteed to return undefined
		if (n < 0 || n >= this.length) return undefined;
		// Otherwise, this is just normal property access
		return this[n];
	}

	const TypedArray = Reflect.getPrototypeOf(Int8Array);
	for (const C of [Array, String, TypedArray]) {
		if (C && C.prototype && !C.prototype.at) {
			try {
				Object.defineProperty(C.prototype, "at", {
					value: at,
					writable: true,
					enumerable: false,
					configurable: true
				});
			} catch (e) {
				// WebView 中 prototype 属性可能不可配置
			}
		}
	}
})();
`
}

/**
 * 为 HTML 内容注入 at() polyfill 脚本
 * @param htmlContent 原始 HTML 内容
 * @returns 注入脚本后的 HTML 内容
 */
export function injectAtPolyfillScript(htmlContent: string): string {
	const polyfillScript = generateAtPolyfillScript()

	if (!polyfillScript) {
		return htmlContent
	}

	let finalContent = htmlContent

	// 在 head 标签中注入 polyfill 脚本（在其他脚本之前）
	const headEndIndex = finalContent.indexOf("</head>")
	if (headEndIndex !== -1) {
		const scriptTag = `<script data-injected="at-polyfill">${polyfillScript}</script>`
		finalContent =
			finalContent.slice(0, headEndIndex) + scriptTag + finalContent.slice(headEndIndex)
	} else {
		// 如果没有 head 标签，在 html 开始处注入
		const htmlStartIndex = finalContent.indexOf("<html")
		if (htmlStartIndex !== -1) {
			const htmlTagEndIndex = finalContent.indexOf(">", htmlStartIndex) + 1
			const scriptTag = `<script data-injected="at-polyfill">${polyfillScript}</script>`
			finalContent =
				finalContent.slice(0, htmlTagEndIndex) +
				scriptTag +
				finalContent.slice(htmlTagEndIndex)
		} else {
			// 如果连 html 标签都没有，在内容开头注入
			const scriptTag = `<script data-injected="at-polyfill">${polyfillScript}</script>`
			finalContent = scriptTag + finalContent
		}
	}

	return finalContent
}
