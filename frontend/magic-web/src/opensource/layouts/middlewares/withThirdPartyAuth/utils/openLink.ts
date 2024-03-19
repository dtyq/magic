import { throttle } from "lodash-es"
import { isMobile } from "@/opensource/utils/devices"
import { openInBrowserAndClose } from "../Strategy/DingTalkStrategy"

/**
 * 第三方平台打开链接的核心实现
 * @param url 链接
 * @param platform 平台
 */
const thirdPartyOpenLinkCore = (url: string, platform?: "dingtalk") => {
	console.log("thirdPartyOpenLink", url, platform)
	switch (platform) {
		case "dingtalk":
			if (isMobile) {
				window.history.pushState({}, "", url)
			} else {
				openInBrowserAndClose(url)
			}
			break
		default:
			window.open(url, "_blank")
			window.close()
	}
}

/**
 * 第三方平台打开链接（带节流处理）
 * @param url 链接
 * @param platform 平台
 * @description 使用节流处理防止短时间内多次调用，避免重复打开窗口
 */
export const thirdPartyOpenLink = throttle(thirdPartyOpenLinkCore, 2000, {
	leading: true,
	trailing: false,
})
