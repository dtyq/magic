import type { ThirdPartyLoginStrategy } from "../../types"
import { loadWecomSDK } from "@/lib/wecom"

/** Is it a Wecom environment */
export async function isWecom() {
	const ww = await loadWecomSDK()
	return ww.env.isWeCom
}

export const WecomStrategy: ThirdPartyLoginStrategy = {
	/**
	 * @description Lark login free, obtain temporary authorization code (return third-party temporary authorization code for third-party login)
	 * @constructor
	 */
	getAuthCode: (): Promise<string> => {
		/**
		 * 鉴于企业微信获取临时授权码的特殊性，不能通过JS-SDK获取，而是构造授权地址后通过重定向携带零售授权码的方式注入，
		 * 所以这里就不需要获取集群配置，直接获取query中的授权码，且 state === wecom 的情况下才生效。
		 * 企业微信管理后台中对应用配置的首页地址为：
		 * https://open.weixin.qq.com/connect/oauth2/authorize?appid=CORPID&redirect_uri=REDIRECT_URI&response_type=code&scope=snsapi_base&state=STATE&agentid=AGENTID#wechat_redirect
		 */
		return new Promise((resolve, reject) => {
			try {
				const url = new URL(window.location.href)
				const searchParams = url.searchParams
				const state = searchParams.get("state")
				const code = searchParams.get("code")
				if (state === "wecom" && code) {
					resolve(code)
				} else {
					throw new Error(`login failed, state: ${state}, code:${code}`)
				}
			} catch (error: any) {
				reject(`${error?.message} wecom`)
			}
		})
	},
}
