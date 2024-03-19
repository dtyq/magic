/**
 * ======================== 飞书 JS-SDK 类型 ====================================
 */
export namespace Lark {
	interface LarkQRLoginResponse {
		matchOrigin: (origin: string) => boolean
		matchData: (data: { tmp_code: string; errMsg: string }) => boolean
	}

	interface LarkQRLoginRequest {
		id: string
		goto: string
		width?: number
		height?: number
		style?: string
	}

	export type LarkQRLogin = (params: LarkQRLoginRequest) => LarkQRLoginResponse

	interface LarkRequestAuthCode {
		appId: string
		success: (params: { code: string }) => void
		fail: (error: any) => void
	}

	export interface LarkSDK {
		requestAuthCode: (params: LarkRequestAuthCode) => Promise<any>
	}
}
