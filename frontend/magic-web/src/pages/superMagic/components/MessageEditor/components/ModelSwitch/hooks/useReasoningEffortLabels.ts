import { useTranslation } from "react-i18next"
import type { ReasoningEffort } from "../types"

/** 七档思考强度的展示文案，桌面选择器与移动端选择页共用；键保持字面量便于 i18n 工具识别。 */
export function useReasoningEffortLabels() {
	const { t } = useTranslation("super")
	const labels: Record<ReasoningEffort, string> = {
		none: t("messageEditor.modelSwitch.reasoning.none"),
		minimal: t("messageEditor.modelSwitch.reasoning.minimal"),
		low: t("messageEditor.modelSwitch.reasoning.low"),
		medium: t("messageEditor.modelSwitch.reasoning.medium"),
		high: t("messageEditor.modelSwitch.reasoning.high"),
		xhigh: t("messageEditor.modelSwitch.reasoning.xhigh"),
		max: t("messageEditor.modelSwitch.reasoning.max"),
	}
	return {
		labels,
		defaultLabel: t("messageEditor.modelSwitch.reasoning.default"),
		title: t("messageEditor.modelSwitch.reasoning.label"),
	}
}
