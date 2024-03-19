import { Login } from "@/opensource/types/login"
import { configStore } from "@/opensource/models/config"
import type { ThirdPartyLoginStrategy } from "../../types"

/** Is it a Lark environment */
export function isLark() {
	return window.tt?.requestAuthCode instanceof Function
}

export const LarkStrategy: ThirdPartyLoginStrategy = {
	/**
	 * @description Lark login free, obtain temporary authorization code (return third-party temporary authorization code for third-party login)
	 * @constructor
	 */
	getAuthCode: (deployCode: string): Promise<string> => {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve, reject) => {
			try {
				const { clusterConfig } = configStore.cluster
				if (!deployCode || !clusterConfig?.[deployCode]) {
					throw new Error(`Private deployment configuration exception`)
				}
				const { appId } =
					clusterConfig?.[deployCode]?.loginConfig?.[Login.LoginType.LarkScanCode] || {}
				if (!appId) {
					throw new Error(`Lark environment configuration exception.`)
				}
				window.tt?.requestAuthCode({
					appId,
					success: (response) => {
						resolve(response?.code)
					},
					fail: (error) => {
						console.error(error)
						throw new Error(`${error?.message} appId:${appId}`)
					},
				})
			} catch (error: any) {
				reject(`${error?.message} lark, deployCode: ${deployCode}`)
			}
		})
	},
}
