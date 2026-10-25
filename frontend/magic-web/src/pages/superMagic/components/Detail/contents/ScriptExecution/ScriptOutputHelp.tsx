import { lazy } from "react"
import { CircleHelp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ContextHelp } from "@/components/shadcn-composed/context-help"
import { Button } from "@/components/shadcn-ui/button"

const ScriptOutputHelpArticle = lazy(() => import("./ScriptOutputHelpArticle"))
const ScriptOutputHelpBrowser = lazy(() => import("./ScriptOutputHelpBrowser"))

/** 复用共享阅读面板与焦点恢复；说明正文只在打开问号时加载。 */
export default function ScriptOutputHelp() {
	const { t } = useTranslation("super")
	return (
		<ContextHelp
			mode="dialog"
			header={{
				title: t("scriptExecution.help.title"),
				description: t("scriptExecution.help.description"),
			}}
			renderDialog={(props) => <ScriptOutputHelpBrowser {...props} />}
			help={{
				title: t("scriptExecution.help.title"),
				summary: t("scriptExecution.help.summary"),
				tone: "indigo",
				renderBody: () => <ScriptOutputHelpArticle articleId="python" />,
			}}
		>
			<Button
				variant="ghost"
				size="icon"
				aria-label={t("scriptExecution.help.label")}
				className="size-9 shrink-0 text-muted-foreground hover:text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
			>
				<CircleHelp size={17} aria-hidden />
			</Button>
		</ContextHelp>
	)
}
