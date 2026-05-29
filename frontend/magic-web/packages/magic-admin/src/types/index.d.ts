/**
 * ======================== 钉钉 JS-SDK 类型 ====================================
 */
export namespace DingTalk {
	export interface DingTalkSDKAPI {
		version: string
		biz: {
			util: {
				share: (params: {
					image?: string
					type: number
					title?: string
					url: string
					content?: string
					onSuccess: () => void
					onFail: () => void
				}) => void
			}
		}
	}
}

declare global {
	interface Window {
		/** 钉钉SDK */
		dd: DingTalk.DingTalkSDKAPI
	}
}
