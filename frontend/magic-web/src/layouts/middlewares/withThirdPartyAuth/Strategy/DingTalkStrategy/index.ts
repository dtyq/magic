import { compareVersions } from "@/lib/dingTalkAPI"
import { Login } from "@/types/login"
import { configStore } from "@/models/config"
import type { ThirdPartyLoginStrategy } from "../../types"

/** Is it a DingTalk environment */
export function isDingTalk() {
	// 检测是否在钉钉环境中
	const ua = navigator.userAgent.toLowerCase()
	return /dingtalk/i.test(ua)
}

// 通过浏览器打开链接并关闭钉钉窗口
export function openInBrowserAndClose(url: string | URL | undefined) {
	if (!url) {
		url = window.location.href
	}

	if (isDingTalk() && window.dd) {
		window.dd.biz.util.openLink({
			url: url.toString(),
			onSuccess: function () {
				console.log(`已通过浏览器打开链接: ${url}`)
				// 成功打开浏览器后关闭钉钉窗口
				setTimeout(function () {
					closeDingTalkWindow()
				}, 100) // 延迟500毫秒后关闭窗口，确保浏览器已打开
			},
			onFail: function (err) {
				console.error(`通过浏览器打开链接失败: ${JSON.stringify(err)}`, true)
			},
		})
	} else {
		// 非钉钉环境，尝试直接打开
		try {
			window.open(url, "_blank")
			console.log(`已尝试打开链接: ${url}`)
		} catch (err: any) {
			console.log(`打开链接失败: ${err?.message}`, true)
		}
	}
}

// 关闭钉钉当前窗口
export function closeDingTalkWindow() {
	if (isDingTalk() && window.dd) {
		window.dd.biz.navigation.close({
			onSuccess: function () {
				console.log("已关闭钉钉窗口")
			},
			onFail: function (err: any) {
				console.log(`关闭钉钉窗口失败: ${JSON.stringify(err)}`, true)
			},
		})
	} else {
		console.log("当前不在钉钉环境中，无法关闭钉钉窗口", true)
	}
}

export const DingTalkLoginStrategy: ThirdPartyLoginStrategy = {
	/**
	 * @description DingTalk login free, obtain temporary authorization code (return third-party temporary authorization code for third-party login)
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
				const { corpId, appKey } =
					clusterConfig?.[deployCode]?.loginConfig?.[Login.LoginType.DingTalkAvoid] || {}
				if (!corpId || !appKey) {
					throw new Error(`DingTalk auto login fail corpId: ${corpId}, appKey: ${appKey}`)
				}
				/** Prioritize determining whether the API usage version of DingTalk JSSDK is too low */
				if (!window.dd) {
					throw new Error("window.dd is not defined")
				}
				if (compareVersions(window.dd.version ?? "", "7.0.45") < 0) {
					throw new Error(
						`DingTalk version is too low(${window.dd.version}), please upgrade to the latest version`,
					)
				}
				window.dd.requestAuthCode({
					corpId,
					clientId: appKey,
					success: (res) => {
						resolve(res.code)
					},
					fail: (err) => {
						reject(
							`${err?.message} corpId:${corpId}, appKey:${appKey} dingtalk, deployCode: ${deployCode}`,
						)
					},
				})
			} catch (error: any) {
				reject(`${error?.message} dingtalk, deployCode: ${deployCode}`)
			}
		})
	},
}
