import type { RequestConfig } from "@/infrastructure/network/http/clients"
import { Login } from "@/types/login"
import { DingTalkLoginStrategy, isDingTalk } from "./DingTalkStrategy"
import { LarkStrategy, isLark } from "./LarkkStrategy"
import { WecomStrategy, isWecom } from "./WecomStrategy"

/**
 * Determine whether the current platform supports background account verification without interrupting the page.
 * WeCom can only be probed after an OAuth callback code is present; otherwise its strategy requires a full-page redirect.
 */
export async function canBackgroundProbe(): Promise<boolean> {
	if (isDingTalk() || isLark()) return true

	try {
		if (!(await isWecom())) return false

		const searchParams = new URL(window.location.href).searchParams
		return searchParams.get("state") === "wecom" && Boolean(searchParams.get("code"))
	} catch {
		return false
	}
}

export async function getAuthCode(
	deployCode: string,
	options?: Pick<RequestConfig, "skipAppInitWait">,
): Promise<{ authCode: string; platform: Login.LoginType }> {
	try {
		if (isDingTalk()) {
			const authCode = await DingTalkLoginStrategy.getAuthCode(deployCode, options)
			return {
				authCode,
				platform: Login.LoginType.DingTalkAvoid,
			}
		}
		if (isLark()) {
			const authCode = await LarkStrategy.getAuthCode(deployCode, options)
			return {
				authCode,
				platform: Login.LoginType.LarkAvoid,
			}
		}
		if (await isWecom()) {
			const authCode = await WecomStrategy.getAuthCode(undefined, options)
			return {
				authCode,
				platform: Login.LoginType.WecomScanCode,
			}
		}
		throw new Error("There is currently no login free access in the current environment")
	} catch (error: any) {
		throw new Error(error?.message)
	}
}
