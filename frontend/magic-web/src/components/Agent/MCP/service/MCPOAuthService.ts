import { FlowApi } from "@/apis"
import { generateCallbackUrl } from "@/components/Agent/MCP/helpers"

export interface MCPOAuthRequireField {
	field_name: string
	field_value?: string
}

export interface MCPOAuthStatus {
	auth_config: { is_authenticated: boolean; oauth_url: string }
	auth_type: 0 | 1
	require_fields: Array<MCPOAuthRequireField>
}

export class MCPOAuthService {
	private api: typeof FlowApi
	private qrRefreshTimer?: NodeJS.Timeout
	private pollTimer?: NodeJS.Timeout
	private abortController: AbortController
	private isDestroyed = false

	// 回调函数类型定义
	private callbacks: {
		onLoadingChange?: (loading: boolean) => void
		onSuccess?: (response: MCPOAuthStatus) => void
		onError?: (error: any) => void
		onStatusUpdate?: (response: MCPOAuthStatus) => void
	} = {}

	constructor(api: typeof FlowApi) {
		this.api = api
		this.abortController = new AbortController()
	}

	/**
	 * 设置回调函数
	 * @param callbacks 回调函数集合
	 */
	setCallbacks(callbacks: {
		onLoadingChange?: (loading: boolean) => void
		onSuccess?: (response: MCPOAuthStatus) => void
		onError?: (error: any) => void
		onStatusUpdate?: (response: MCPOAuthStatus) => void
	}) {
		this.callbacks = { ...this.callbacks, ...callbacks }
	}

	/**
	 * 开始二维码流程
	 */
	async start(id: string) {
		if (this.isDestroyed) return

		try {
			this.startPolling(id)
		} catch (error) {
			this.callbacks.onError?.(error)
		}
	}

	/**
	 * 开始轮询授权状态
	 * @param id MCP id
	 */
	private async startPolling(id: string) {
		if (this.isDestroyed) return

		try {
			const result = await this.api.getMCPUserSettings(
				{
					code: id,
					redirectUrl: generateCallbackUrl(),
				},
				{
					signal: this.abortController.signal,
				},
			)

			this.callbacks.onStatusUpdate?.(result)

			if (result.auth_config.is_authenticated) {
				// 授权成功，清理定时器并触发回调
				this.clearTimers()
				this.callbacks.onSuccess?.(result)
			} else {
				// 继续轮询
				this.pollTimer = setTimeout(() => {
					this.startPolling(id)
				}, 2000)
			}
		} catch (error) {
			if (!this.abortController.signal.aborted) {
				this.callbacks.onError?.(error)
			}
		}
	}

	/**
	 * 清理所有定时器
	 */
	private clearTimers() {
		if (this.qrRefreshTimer) {
			clearTimeout(this.qrRefreshTimer)
			this.qrRefreshTimer = undefined
		}
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	/**
	 * 停止并清理所有资源
	 */
	destroy() {
		this.isDestroyed = true
		this.abortController.abort()
		this.clearTimers()
	}

	/**
	 * 重新开始整个流程
	 */
	restart(id: string) {
		this.destroy()
		this.abortController = new AbortController()
		this.isDestroyed = false
		this.start(id)
	}
}
