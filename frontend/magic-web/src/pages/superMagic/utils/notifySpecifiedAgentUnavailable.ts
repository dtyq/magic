import i18n from "i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	isSingleTopicHostProject,
	resolveIframeHostTopicMode,
	type SingleTopicHostProject,
} from "./isSingleTopicHostProject"

const TOAST_KEY = "html-iframe-specified-agent-unavailable"

/** 单话题宿主忽略指定员工时提示用户，消息仍发到当前会话。 */
export function notifySpecifiedAgentUnavailable(
	requestedAgentId?: string,
	project?: SingleTopicHostProject | null,
): void {
	if (!requestedAgentId?.trim()) return
	if (!isSingleTopicHostProject(project)) return
	if (requestedAgentId === resolveIframeHostTopicMode(project)) return

	magicToast.warning({
		key: TOAST_KEY,
		content: i18n.t("htmlEditor.specifiedAgentUnavailable", { ns: "super" }),
		duration: 4000,
	})
}
