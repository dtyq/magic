import { Terminal as TerminalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	HelpArticle,
	type HelpArticleProps,
} from "@/components/shadcn-composed/context-help/HelpArticle"

export type TerminalHelpArticleId = "overview" | "logs" | "status"
type TerminalHelpDetail = Pick<HelpArticleProps, "usage" | "example" | "note" | "guide">

export default function TerminalHelpArticle({ articleId }: { articleId: TerminalHelpArticleId }) {
	const { t } = useTranslation("super")
	let detail: TerminalHelpDetail
	switch (articleId) {
		case "overview":
			detail = t("terminal.help.overview.detail", {
				returnObjects: true,
			}) as TerminalHelpDetail
			break
		case "logs":
			detail = t("terminal.help.logs.detail", { returnObjects: true }) as TerminalHelpDetail
			break
		case "status":
			detail = t("terminal.help.status.detail", { returnObjects: true }) as TerminalHelpDetail
			break
	}
	return <HelpArticle {...detail} visual="flow" sampleIdentity={<TerminalIcon size={16} />} />
}
