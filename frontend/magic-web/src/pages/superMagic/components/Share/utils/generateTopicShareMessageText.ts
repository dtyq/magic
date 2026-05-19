import type { TFunction } from "i18next"
import { userStore } from "@/models/user"

interface GenerateTopicShareMessageTextParams {
	topicTitle?: string
	shareUrl: string
	t: TFunction<"super", undefined>
}

/**
 * 生成话题分享信息文本
 */
export function generateTopicShareMessageText(params: GenerateTopicShareMessageTextParams): string {
	const { topicTitle, shareUrl, t } = params

	const displayTopicTitle = topicTitle || t("common.untitledTopic")
	const displayName =
		userStore.user.userInfo?.nickname || userStore.user.userInfo?.real_name || ""
	const lines = [
		t("share.shareMessageTopic"),
		t("share.shareMessageTopicName", { topicTitle: displayTopicTitle }),
		t("share.shareMessageTopicLink", { shareUrl }),
		t("share.shareMessageTopicTip"),
		t("share.createdBy.footerLine", {
			brand: t("share.createdBy.brand"),
			username: displayName,
		}),
	]
	return lines.join("\n")
}
