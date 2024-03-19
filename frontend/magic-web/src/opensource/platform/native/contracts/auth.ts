import type { NativeDestroyFn } from "./types"

export type NativeThirdPartyPlatform = "DingTalk" | "WeWork" | "Lark" | "WeChat"

export interface NativeThirdPartyLoginParams {
	platform: NativeThirdPartyPlatform
	appId?: string
	appSecret?: string
	appKey?: string
	agentId?: string
	schema?: string
	redirectUri?: string
	universalLink?: string
	success?: (data: object) => void
	fail?: (error: { code: string; message: string }) => void
	complete?: (result: { status: number; data: object; message: string }) => void
}

export interface NativeThirdPartyLoginResult {
	platform: string
	auth: string
	code: number
	message: string
}

export interface AuthPort {
	thirdPartyLogin(params: NativeThirdPartyLoginParams): Promise<object>
	observeThirdPartyLoginResult(
		callback: (result: NativeThirdPartyLoginResult) => void,
	): NativeDestroyFn | undefined
}
