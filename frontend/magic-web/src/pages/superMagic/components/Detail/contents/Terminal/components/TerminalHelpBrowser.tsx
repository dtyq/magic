import { useLayoutEffect, useRef, useState } from "react"
import { CircleCheck, Terminal, TextSearch } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HelpDialogContent } from "@/components/shadcn-composed/context-help/HelpDialog"
import { HelpNavigation } from "@/components/shadcn-composed/context-help/HelpNavigation"
import type { HelpDialogContentProps } from "@/components/shadcn-composed/context-help/types"
import TerminalHelpArticle, { type TerminalHelpArticleId } from "./TerminalHelpArticle"

/** 终端只提供自己的文章与目录；弹窗布局、目录拖动和窄屏行为由共享组件管理。 */
export default function TerminalHelpBrowser(props: HelpDialogContentProps) {
	const { t } = useTranslation("super")
	const [articleId, setArticleId] = useState<TerminalHelpArticleId>("overview")
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(["terminal"]))
	const contentRef = useRef<HTMLDivElement>(null)
	const previousArticleId = useRef(articleId)
	const titles: Record<TerminalHelpArticleId, string> = {
		overview: t("terminal.help.overview.title"),
		logs: t("terminal.help.logs.title"),
		status: t("terminal.help.status.title"),
	}
	useLayoutEffect(() => {
		const changed = previousArticleId.current !== articleId
		previousArticleId.current = articleId
		if (!changed) return
		// 先让共享布局显示窄屏正文，再把阅读焦点移入新文章；语言更新不重置位置。
		const frame = requestAnimationFrame(() => {
			const element = contentRef.current
			if (!element) return
			element.scrollTop = 0
			element
				.querySelector<HTMLElement>("[data-help-heading]")
				?.focus({ preventScroll: true })
		})
		return () => cancelAnimationFrame(frame)
	}, [articleId])

	return (
		<HelpDialogContent
			{...props}
			help={{
				...props.help,
				title: titles[articleId],
				renderBody: () => <TerminalHelpArticle articleId={articleId} />,
			}}
			articleKey={articleId}
			contentRef={contentRef}
			navigation={
				<HelpNavigation
					hint={t("terminal.help.catalogHint")}
					groups={[
						{
							id: "terminal",
							label: t("terminal.title"),
							items: [
								{
									id: "overview",
									articleId: "overview",
									label: titles.overview,
									icon: <Terminal size={16} />,
								},
								{
									id: "logs",
									articleId: "logs",
									label: titles.logs,
									icon: <TextSearch size={16} />,
								},
								{
									id: "status",
									articleId: "status",
									label: titles.status,
									icon: <CircleCheck size={16} />,
								},
							],
						},
					]}
					activeId={articleId}
					expanded={expanded}
					onSelect={(id) => {
						if (id === "overview" || id === "logs" || id === "status") setArticleId(id)
					}}
					onExpandedChange={(id, open) =>
						setExpanded((previous) => {
							const next = new Set(previous)
							if (open) next.add(id)
							else next.delete(id)
							return next
						})
					}
				/>
			}
		/>
	)
}
