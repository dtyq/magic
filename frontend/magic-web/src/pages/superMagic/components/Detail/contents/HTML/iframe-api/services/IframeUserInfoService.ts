/**
 * IframeUserInfoService
 *
 * 处理 MAGIC_GET_USER_INFO_* 消息，向 iframe 提供当前登录用户的展示信息
 * （展示名、头像），便于 app 展示与表单默认值填充。
 * 纯 class，不依赖 React，由 useIframeUserInfo hook 持有实例。
 */

import {
	USER_INFO_MESSAGE_TYPES,
	USER_INFO_SCOPES,
	type HTMLAppConfig,
	type UserInfo,
	type UserInfoGetRequest,
	type UserInfoScope,
} from "../types"

export interface UserInfoAuthorizationRequest {
	appName: string
	scopes: UserInfoScope[]
	fields: string[]
	reason: string
}

export interface IframeUserInfoConfig {
	/** 向 iframe 发送消息的函数 */
	postToIframe: (message: object) => void
	/** 获取当前用户信息的函数 */
	getUserInfo: () => UserInfo | null
	/** Optional app.json permissions declaration. */
	appConfig?: HTMLAppConfig | null
	/** 请求敏感用户信息前的宿主侧授权确认。 */
	authorizeUserInfo?: (request: UserInfoAuthorizationRequest) => Promise<boolean>
}

export class IframeUserInfoService {
	private readonly cfg: IframeUserInfoConfig
	private authorizedScopesByApp = new Map<string, Set<UserInfoScope>>()

	constructor(cfg: IframeUserInfoConfig) {
		this.cfg = cfg
	}

	/**
	 * 主路由入口，由 useIframeUserInfo → IsolatedHTMLRenderer 的 handleMessage 调用。
	 * 返回 true 表示消息已被处理。
	 */
	async handleMessage(type: string, payload: unknown): Promise<boolean> {
		if (type === USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST) {
			await this.handleGetUserInfo(payload as UserInfoGetRequest)
			return true
		}
		return false
	}

	private async handleGetUserInfo(req: UserInfoGetRequest): Promise<void> {
		try {
			const scopes = this.normalizeScopes(req.scopes)
			if (!scopes) {
				this.cfg.postToIframe({
					type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
					requestId: req.requestId,
					success: false,
					error: "Invalid user info scope",
				})
				return
			}

			const undeclaredScopes = this.getUndeclaredSensitiveScopes(scopes)
			if (undeclaredScopes.length > 0) {
				this.cfg.postToIframe({
					type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
					requestId: req.requestId,
					success: false,
					error: `User info scope is not declared by this app: ${undeclaredScopes.join(", ")}`,
				})
				return
			}

			const authorizedScopes = this.getAuthorizedScopesForCurrentApp()
			const unauthorizedScopes = scopes.filter(
				(scope) => scope !== USER_INFO_SCOPES.DISPLAY && !authorizedScopes.has(scope),
			)
			if (unauthorizedScopes.length > 0) {
				const allowed = await this.requestAuthorization(unauthorizedScopes, req.reason)
				if (!allowed) {
					this.cfg.postToIframe({
						type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
						requestId: req.requestId,
						success: false,
						error: "User denied access to requested profile fields",
					})
					return
				}
				for (const scope of unauthorizedScopes) {
					authorizedScopes.add(scope)
				}
			}

			const userInfo = this.cfg.getUserInfo()
			if (!userInfo) {
				this.cfg.postToIframe({
					type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
					requestId: req.requestId,
					success: false,
					error: "User info is not available",
				})
				return
			}
			const safeUserInfo = this.pickUserInfoFields(userInfo, scopes)
			this.cfg.postToIframe({
				type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
				requestId: req.requestId,
				success: true,
				userInfo: safeUserInfo,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
				requestId: req.requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to get user info",
			})
		}
	}

	destroy(): void {
		this.authorizedScopesByApp.clear()
	}

	private getAuthorizedScopesForCurrentApp(): Set<UserInfoScope> {
		const appKey = this.getCurrentAppKey()
		let scopes = this.authorizedScopesByApp.get(appKey)
		if (!scopes) {
			scopes = new Set<UserInfoScope>()
			this.authorizedScopesByApp.set(appKey, scopes)
		}
		return scopes
	}

	private getCurrentAppKey(): string {
		const appConfig = this.cfg.appConfig
		if (!appConfig) return "__html_micro_app__"

		return JSON.stringify({
			type: appConfig.type || "",
			name: appConfig.name || "",
			version: appConfig.version || "",
			entry: appConfig.entry || "",
		})
	}

	private normalizeScopes(rawScopes: unknown): UserInfoScope[] | null {
		if (rawScopes === undefined) return [USER_INFO_SCOPES.DISPLAY]
		if (!Array.isArray(rawScopes)) return null

		const normalized = new Set<UserInfoScope>([USER_INFO_SCOPES.DISPLAY])
		const allowedScopes = new Set<string>(Object.values(USER_INFO_SCOPES))
		for (const scope of rawScopes) {
			if (typeof scope !== "string" || !allowedScopes.has(scope)) return null
			normalized.add(scope as UserInfoScope)
		}

		return Array.from(normalized)
	}

	private getDeclaredScopes(): Set<UserInfoScope> {
		const scopes = this.cfg.appConfig?.permissions?.userInfo?.scopes ?? [
			USER_INFO_SCOPES.DISPLAY,
		]
		return new Set<UserInfoScope>([USER_INFO_SCOPES.DISPLAY, ...scopes])
	}

	private getUndeclaredSensitiveScopes(scopes: UserInfoScope[]): UserInfoScope[] {
		const declaredScopes = this.getDeclaredScopes()
		return scopes.filter(
			(scope) => scope !== USER_INFO_SCOPES.DISPLAY && !declaredScopes.has(scope),
		)
	}

	private async requestAuthorization(scopes: UserInfoScope[], requestReason?: string) {
		if (!this.cfg.authorizeUserInfo) return false

		return this.cfg.authorizeUserInfo({
			appName: this.cfg.appConfig?.name || "HTML 微应用",
			scopes,
			fields: this.getFieldLabels(scopes),
			reason: requestReason || this.cfg.appConfig?.permissions?.userInfo?.reason || "",
		})
	}

	private getFieldLabels(scopes: UserInfoScope[]): string[] {
		const labels: string[] = []
		for (const scope of scopes) {
			if (scope === USER_INFO_SCOPES.NAME) {
				labels.push("昵称", "真实姓名")
			} else if (scope === USER_INFO_SCOPES.IDENTITY) {
				labels.push("用户 ID", "Magic ID")
			} else if (scope === USER_INFO_SCOPES.ORGANIZATION) {
				labels.push("组织编码")
			}
		}
		return labels
	}

	private pickUserInfoFields(userInfo: UserInfo, scopes: UserInfoScope[]): UserInfo {
		const result: UserInfo = {
			name: userInfo.name,
			avatar: userInfo.avatar,
		}

		if (scopes.includes(USER_INFO_SCOPES.NAME)) {
			result.nickname = userInfo.nickname || ""
			result.real_name = userInfo.real_name || ""
		}
		if (scopes.includes(USER_INFO_SCOPES.IDENTITY)) {
			result.user_id = userInfo.user_id || ""
			result.magic_id = userInfo.magic_id || ""
		}
		if (scopes.includes(USER_INFO_SCOPES.ORGANIZATION)) {
			result.organization_code = userInfo.organization_code || ""
		}

		return result
	}
}
