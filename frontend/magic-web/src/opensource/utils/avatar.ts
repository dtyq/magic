import { isOssPublicImageUrl } from "./oss-image"
import { isTosPublicImageUrl, buildResizeProcess, buildFormatProcess } from "./tos-image"
import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("avatar")

export const getAvatarUrl = (avatar: string, height: number = 50) => {
	if (isTosPublicImageUrl(avatar)) {
		// 如果已经包含x-tos-process，则直接返回
		if (avatar.includes("x-tos-process")) {
			return avatar
		}

		try {
			return `${avatar}?x-tos-process=image/${buildResizeProcess({
				h: height * 2,
			})}/${buildFormatProcess({ format: "webp" })}`
		} catch (error) {
			logger.error("getAvatarUrl error", error)
			return avatar
		}
	}

	if (isOssPublicImageUrl(avatar)) {
		// 如果已经包含x-oss-process，则直接返回
		if (avatar.includes("x-oss-process")) {
			return avatar
		}

		try {
			return `${avatar}?x-oss-process=image/${buildResizeProcess({
				h: height * 2,
			})}/${buildFormatProcess({ format: "webp" })}`
		} catch (error) {
			logger.error("getAvatarUrl error", error)
			return avatar
		}
	}

	if (
		avatar.includes("static-legacy.dingtalk.com") &&
		!avatar.includes(`${height * 2}w_${height * 2}h`)
	) {
		return `${avatar}@${height * 2}w_${height * 2}h`
	}

	return avatar
}
