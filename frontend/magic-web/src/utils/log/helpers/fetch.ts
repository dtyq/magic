// Logger 内部使用专用的 fetch 实例
class FetchHelper {
	private readonly originalFetch: typeof window.fetch

	constructor() {
		// 在插件初始化前保存原始 fetch
		this.originalFetch = window.fetch
	}

	getInstance() {
		return this.originalFetch
	}

	// Logger 内部统一使用原始 fetch
	public async internalFetch(...args: Parameters<typeof window.fetch>) {
		return this.originalFetch.apply(window, args)
	}
}

export const fetch = new FetchHelper()
