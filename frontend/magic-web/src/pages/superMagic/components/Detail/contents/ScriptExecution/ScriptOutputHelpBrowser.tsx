import { useLayoutEffect, useRef, useState } from "react"
import {
	AlignLeft,
	BookOpen,
	Code2,
	FileCode2,
	Hand,
	Play,
	Search,
	TriangleAlert,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { HelpDialogContent } from "@/components/shadcn-composed/context-help/HelpDialog"
import { HelpNavigation } from "@/components/shadcn-composed/context-help/HelpNavigation"
import type { HelpDialogContentProps } from "@/components/shadcn-composed/context-help/types"
import ScriptOutputHelpArticle, {
	SCRIPT_OUTPUT_HELP_ARTICLES,
	type ScriptOutputHelpArticleId,
} from "./ScriptOutputHelpArticle"

const ARTICLE_ICONS = {
	python: FileCode2,
	execution: Play,
	code: Code2,
	streams: AlignLeft,
	errors: TriangleAlert,
	intervention: Hand,
	reading: Search,
	case: BookOpen,
} satisfies Record<ScriptOutputHelpArticleId, typeof Code2>

/** 章节属于脚本学习场景；共享 Helper 继续负责弹窗、目录尺寸与窄屏切换。 */
export default function ScriptOutputHelpBrowser(props: HelpDialogContentProps) {
	const { t } = useTranslation("super")
	const [articleId, setArticleId] = useState<ScriptOutputHelpArticleId>("python")
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(["foundations", "results", "further"]),
	)
	const titles: Record<ScriptOutputHelpArticleId, string> = {
		python: t("scriptExecution.help.articles.python.title"),
		execution: t("scriptExecution.help.articles.execution.title"),
		code: t("scriptExecution.help.articles.code.title"),
		streams: t("scriptExecution.help.articles.streams.title"),
		errors: t("scriptExecution.help.articles.errors.title"),
		intervention: t("scriptExecution.help.articles.intervention.title"),
		reading: t("scriptExecution.help.articles.reading.title"),
		case: t("scriptExecution.help.articles.case.title"),
	}
	function item(id: ScriptOutputHelpArticleId) {
		const Icon = ARTICLE_ICONS[id]
		return { id, articleId: id, label: titles[id], icon: <Icon size={16} /> }
	}
	const contentRef = useRef<HTMLDivElement>(null)
	const previousArticleId = useRef(articleId)
	useLayoutEffect(() => {
		const changed = previousArticleId.current !== articleId
		previousArticleId.current = articleId
		if (!changed) return
		// 切章回到正文开头；共享布局先关闭窄屏目录，再将焦点移入新文章。
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
				renderBody: () => <ScriptOutputHelpArticle articleId={articleId} />,
			}}
			articleKey={articleId}
			contentRef={contentRef}
			navigation={
				<HelpNavigation
					hint={t("scriptExecution.help.catalogHint")}
					groups={[
						{
							id: "foundations",
							label: t("scriptExecution.help.groups.foundations"),
							items: [item("python"), item("execution"), item("code")],
						},
						{
							id: "results",
							label: t("scriptExecution.help.groups.results"),
							items: [
								item("streams"),
								item("errors"),
								item("intervention"),
								item("reading"),
							],
						},
						{
							id: "further",
							label: t("scriptExecution.help.groups.further"),
							items: [item("case")],
						},
					]}
					activeId={articleId}
					expanded={expanded}
					onSelect={(id) => {
						const selected = SCRIPT_OUTPUT_HELP_ARTICLES.find(
							(article) => article === id,
						)
						if (selected) setArticleId(selected)
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
