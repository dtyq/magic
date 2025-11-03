import { vi } from "vitest"

/* eslint-disable class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
const mockGlobalProperties = () => {
	// 创建XMLHttpRequest模拟 - 作为类
	class MockXMLHttpRequest {
		open = vi.fn()

		setRequestHeader = vi.fn()

		readyState = 4

		status = 200

		response = "{}"

		responseText = ""

		onload: any = null

		onloadstart: any = null

		onerror: any = null

		onabort: any = null

		ontimeout: any = null

		// 创建一个独立的 upload 对象，确保所有属性都可写
		upload: {
			addEventListener: any
			onloadstart: any
			onprogress: any
			onload: any
			onerror: any
			onabort: any
		}

		private loadHandlers: Array<() => void> = []

		constructor() {
			// 在构造函数中初始化 upload 对象，确保属性可写
			this.upload = {
				addEventListener: vi.fn(),
				onloadstart: null,
				onprogress: null,
				onload: null,
				onerror: null,
				onabort: null,
			}
		}

		// send 方法需要触发回调
		send = vi.fn(() => {
			// 异步触发 load 事件，模拟网络请求完成
			setTimeout(() => {
				// 触发 upload.onloadstart
				if (this.upload.onloadstart) {
					this.upload.onloadstart()
				}

				// 触发 upload.onload
				if (this.upload.onload) {
					this.upload.onload()
				}

				// 触发主 onload
				if (this.onload) {
					this.onload({
						target: this,
					})
				}

				// 触发所有通过 addEventListener 注册的 load 处理器
				this.loadHandlers.forEach((handler) => handler())
			}, 0)
		})

		addEventListener = vi.fn((event: string, handler: () => void) => {
			if (event === "load") {
				this.loadHandlers.push(handler)
			}
		})

		getResponseHeader = vi.fn().mockReturnValue("")

		getAllResponseHeaders = vi.fn().mockReturnValue("")

		abort = vi.fn()
	}

	// 创建FormData模拟 - 作为类
	class MockFormData {
		private data: Map<string, any> = new Map()

		append(key: string, value: any): void {
			this.data.set(key, value)
		}

		get(key: string): any {
			if (key === "options") {
				return '{"image":[{"type":"resize","params":{"width":100,"height":100}}]}'
			}
			return this.data.get(key)
		}

		getAll(key: string): any[] {
			return [this.data.get(key)]
		}

		has(key: string): boolean {
			return this.data.has(key)
		}

		delete(key: string): void {
			this.data.delete(key)
		}

		entries() {
			return this.data.entries()
		}

		keys() {
			return this.data.keys()
		}

		values() {
			return this.data.values()
		}
	}

	// 模拟Blob
	class MockBlob {
		content: Array<any>

		options: any

		size: number

		type: string

		constructor(content: Array<any> = [], options: any = {}) {
			this.content = content
			this.options = options
			this.size = content ? content.length : 0
			this.type = options?.type || ""
		}

		slice() {
			return { type: "application/octet-stream" }
		}

		text() {
			return Promise.resolve(this.content ? this.content.join("") : "")
		}

		arrayBuffer() {
			return Promise.resolve(new ArrayBuffer(8))
		}
	}

	// 确保全局File构造函数可用
	class MockFile extends MockBlob {
		name: string

		lastModified: number

		constructor(content: Array<any> = [], name: string = "", options: any = {}) {
			super(content, options)
			this.name = name
			this.type = options?.type || "application/octet-stream"
			this.lastModified = Date.now()
		}
	}

	// 创建URL对象模拟 - 作为构造函数
	class MockURL {
		protocol: string

		host: string

		hostname: string

		port: string

		pathname: string

		search: string

		hash: string

		href: string

		origin: string

		constructor(url: string, base?: string) {
			// 简单的URL解析
			let fullUrl = url

			// 如果提供了base且url是相对路径，则组合它们
			if (base && !url.match(/^https?:\/\//)) {
				// 简化处理：只处理base + path的情况
				const baseMatch = base.match(/^(https?:\/\/[^/]+)(\/.*)?$/)
				if (baseMatch) {
					const baseOrigin = baseMatch[1]
					const basePath = baseMatch[2] || "/"
					if (url.startsWith("/")) {
						fullUrl = baseOrigin + url
					} else {
						const lastSlash = basePath.lastIndexOf("/")
						const newPath = lastSlash >= 0 ? basePath.substring(0, lastSlash + 1) + url : "/" + url
						fullUrl = baseOrigin + newPath
					}
				}
			}

			const match = fullUrl.match(/^(https?:)\/\/([^:/?#]+)(:([0-9]+))?(\/[^?#]*)(\?[^#]*)?(#.*)?$/)

			if (match) {
				this.protocol = match[1] || ""
				this.hostname = match[2] || ""
				this.port = match[4] || ""
				this.host = this.port ? `${this.hostname}:${this.port}` : this.hostname
				this.pathname = match[5] || "/"
				this.search = match[6] || ""
				this.hash = match[7] || ""
			} else {
				// Fallback for simple URLs
				this.protocol = "https:"
				this.host = fullUrl.replace(/^https?:\/\//, "").split("/")[0]
				this.hostname = this.host.split(":")[0]
				this.port = ""
				this.pathname = "/"
				this.search = ""
				this.hash = ""
			}
			this.href = fullUrl
			this.origin = `${this.protocol}//${this.host}`
		}

		static createObjectURL = vi.fn().mockReturnValue("blob:mock-url")

		static revokeObjectURL = vi.fn()

		toString() {
			return this.href
		}
	}

	// 使用Object.defineProperty方式安全地添加到全局对象
	Object.defineProperty(global, "XMLHttpRequest", {
		value: MockXMLHttpRequest,
		writable: true,
	})

	Object.defineProperty(global, "FormData", {
		value: MockFormData,
		writable: true,
	})

	Object.defineProperty(global, "Blob", {
		value: MockBlob,
		writable: true,
	})

	Object.defineProperty(global, "File", {
		value: MockFile,
		writable: true,
	})

	Object.defineProperty(global, "URL", {
		value: MockURL,
		writable: true,
	})
}

// 初始化测试环境
mockGlobalProperties()

// 修补全局原型链，使instanceof检查正常工作
global.Object.prototype.constructor = function () {}

// 模拟esdk-obs-browserjs模块
vi.mock("esdk-obs-browserjs", async () => {
	const ObsClientMock = await import("./mocks/ObsClientMock")
	return ObsClientMock
})

// 模拟mime模块
vi.mock("mime", () => {
	const getTypeMock = function (filename: string): string {
		if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg"
		if (filename.endsWith(".png")) return "image/png"
		if (filename.endsWith(".txt")) return "text/plain"
		if (filename.endsWith(".html")) return "text/html"
		if (filename.endsWith(".pdf")) return "application/pdf"
		return "application/octet-stream"
	}

	const mime = {
		getType: vi.fn(getTypeMock),
	}

	return {
		default: mime,
		getType: vi.fn(getTypeMock),
	}
})

// 设置环境变量
process.env.NODE_ENV = "test"
