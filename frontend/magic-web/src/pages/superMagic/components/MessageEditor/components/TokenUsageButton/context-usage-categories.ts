import { BookOpen, FileText, MessageSquare, Plug, ShieldCheck, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"

/** 卡片与教学图共用分类、颜色和静态翻译键，数字只取对应请求的快照。 */
export function useContextUsageCategories() {
	const { t } = useTranslation("super")
	return [
		{
			label: t("ui.tokenUsage.categories.system"),
			detail: t("ui.tokenUsage.categoryDescriptions.system"),
			field: "system_tokens",
			color: "#8d83c4",
			Icon: ShieldCheck,
		},
		{
			label: t("ui.tokenUsage.categories.tools"),
			detail: t("ui.tokenUsage.categoryDescriptions.tools"),
			field: "tool_definition_tokens",
			color: "#65a58c",
			Icon: Wrench,
		},
		{
			label: t("ui.tokenUsage.categories.skills"),
			detail: t("ui.tokenUsage.categoryDescriptions.skills"),
			field: "skill_tokens",
			color: "#b789ad",
			Icon: BookOpen,
		},
		{
			label: t("ui.tokenUsage.categories.mcp"),
			detail: t("ui.tokenUsage.categoryDescriptions.mcp"),
			field: "mcp_tokens",
			color: "#7e9cbd",
			Icon: Plug,
		},
		{
			label: t("ui.tokenUsage.categories.conversation"),
			detail: t("ui.tokenUsage.categoryDescriptions.conversation"),
			field: "conversation_tokens",
			color: "#d5a35e",
			Icon: MessageSquare,
		},
		{
			label: t("ui.tokenUsage.categories.other"),
			detail: t("ui.tokenUsage.categoryDescriptions.other"),
			field: "tool_result_tokens",
			color: "#9da7a4",
			Icon: FileText,
		},
	] as const
}
