import { lazy } from "react"
import { CircleHelp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ContextHelp } from "@/components/shadcn-composed/context-help"

const ContextUsageHelpBrowser = lazy(() => import("./ContextUsageHelpBrowser"))

/** 复用全局帮助的简介、弹窗与焦点恢复；正文只在用户打开说明时加载。 */
export default function ContextUsageHelp() {
	const { t } = useTranslation("super")

	return (
		<ContextHelp
			mode="dialog"
			header={{
				title: t("ui.tokenUsage.guide.title"),
				description: t("ui.tokenUsage.guide.subtitle"),
			}}
			renderDialog={(props) => <ContextUsageHelpBrowser {...props} />}
			help={{
				title: t("ui.tokenUsage.help.title"),
				summary: t("ui.tokenUsage.help.summary"),
				tone: "neutral",
				renderBody: () => <p>{t("ui.tokenUsage.help.summary")}</p>,
			}}
		>
			<button
				type="button"
				aria-label={t("ui.tokenUsage.guide.label")}
				className="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-fill hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<CircleHelp size={16} aria-hidden />
				{t("ui.tokenUsage.guide.label")}
			</button>
		</ContextHelp>
	)
}
