import { lazy } from "react"
import { BookOpen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ContextHelp } from "@/components/shadcn-composed/context-help"

const TerminalHelpBrowser = lazy(() => import("./TerminalHelpBrowser"))
const TerminalHelpArticle = lazy(() => import("./TerminalHelpArticle"))

/** 入口沿用共享帮助的弹窗、焦点恢复和加载边界，阅读正文只在打开时加载。 */
export function TerminalHelpButton({ showText }: { showText: boolean }) {
	const { t } = useTranslation("super")
	return (
		<ContextHelp
			mode="dialog"
			help={{
				title: t("terminal.help.overview.title"),
				summary: t("terminal.help.summary"),
				tone: "indigo",
				renderBody: () => <TerminalHelpArticle articleId="overview" />,
			}}
			renderDialog={(props) => <TerminalHelpBrowser {...props} />}
		>
			<Button
				variant="ghost"
				size="sm"
				className="h-8 gap-1.5 px-2 text-sm font-normal leading-5 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
				aria-label={t("terminal.guide")}
			>
				<BookOpen size={16} aria-hidden />
				{showText && t("terminal.guide")}
			</Button>
		</ContextHelp>
	)
}
