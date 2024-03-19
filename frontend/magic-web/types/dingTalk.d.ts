/**
 * ======================== 钉钉 JS-SDK 类型 ====================================
 */
export namespace DingTalk {
	interface DTFrameDOMOptions {
		id: string
		width: number
		height: number
	}

	interface DTFrameLoginOptions {
		redirect_uri: string
		client_id: string
		scope: string
		response_type: string
		prompt: string
	}

	type DTFrameLoginSuccessCallback = (result: {
		authCode: string
		redirectUrl: string
		state: string
	}) => void

	type DTFrameLoginErrorCallback = (errorMsg: string) => void

	export type DTFrameLoginAPI = (
		domOpt: DTFrameDOMOptions,
		options: DTFrameLoginOptions,
		success: DTFrameLoginSuccessCallback,
		fail: DTFrameLoginErrorCallback,
	) => void

	interface RequestAuthCodeParams {
		corpId: string
		clientId: string
		success: (res: { code: string }) => void
		fail: (err: any) => void
	}

	export interface DingTalkSDKAPI {
		version: string
		biz: {
			util: {
				openLink: (params: {
					url: string
					onSuccess: () => void
					onFail: (err: any) => void
				}) => void

				share: (params: {
					image: string
					type: number
					title: string
					url: string
					content: string
					onSuccess: () => void
					onFail: () => void
				}) => void
			}

			

			navigation: {
				close: (params: { onSuccess: () => void; onFail: (err: any) => void }) => void
			}
		}
		requestAuthCode: (params: RequestAuthCodeParams) => void
	}
}
