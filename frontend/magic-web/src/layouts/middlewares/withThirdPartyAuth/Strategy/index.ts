import type { RequestConfig } from "@/apis/core/HttpClient"
import { Login } from "@/types/login"
import { DingTalkLoginStrategy, isDingTalk } from "./DingTalkStrategy"
import { LarkStrategy, isLark } from "./LarkkStrategy"
import { WecomStrategy, isWecom } from "./WecomStrategy"

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
