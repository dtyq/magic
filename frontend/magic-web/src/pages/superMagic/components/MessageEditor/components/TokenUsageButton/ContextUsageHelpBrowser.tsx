import { useLayoutEffect, useRef, useState } from "react"
import { ArrowRight, BookOpen, Brain, Gauge, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { HelpDialogContent } from "@/components/shadcn-composed/context-help/HelpDialog"
import {
	HelpNavigation,
	type HelpNavigationGroup,
} from "@/components/shadcn-composed/context-help/HelpNavigation"
import type {
	HelpDefinition,
	HelpDialogContentProps,
} from "@/components/shadcn-composed/context-help/types"
import { useUserFileHelp } from "@/pages/superMagic/components/UserSpace/useUserFileHelp"
import { useSkillFileHelp } from "@/pages/superMagic/components/TopicFilesButton/hooks/useSkillFileHelp"
import ContextUsageHelpContent from "./ContextUsageHelpContent"
import ContextUsageExplanation from "./ContextUsageExplanation"
import { CONTEXT_USAGE_GUIDE_STYLES as styles } from "./ContextUsageGuideStyles"

type ArticleId = "usage" | "compaction" | "memory" | "skills"
const ARTICLE_ICONS = { usage: Gauge, compaction: Sparkles, memory: Brain, skills: BookOpen }
const RELATED_ARTICLES: Record<ArticleId, readonly ArticleId[]> = {
	usage: ["compaction"],
	compaction: ["usage", "memory"],
	memory: [],
	skills: [],
}

/** 阅读会话复用全局目录、正文与文章定义，不参与应用路由或文件打开。 */
export default function ContextUsageHelpBrowser(props: HelpDialogContentProps) {
	const { t } = useTranslation("super")
	const { t: interfaceT } = useTranslation("interface")
	const [active, setActive] = useState<ArticleId>("compaction")
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(["conversation", "related"]),
	)
	const contentRef = useRef<HTMLDivElement>(null)
	const previous = useRef(active)
	const memory = useUserFileHelp(active === "memory" ? "memory" : undefined)
	const skill = useSkillFileHelp(active === "skills" ? "entry" : undefined)
	useLayoutEffect(() => {
		if (previous.current === active) return
		previous.current = active
		const frame = requestAnimationFrame(() => {
			const content = contentRef.current
			if (!content) return
			content.scrollTop = 0
			content
				.querySelector<HTMLElement>("[data-help-heading]")
				?.focus({ preventScroll: true })
		})
		return () => cancelAnimationFrame(frame)
	}, [active])
	const titles: Record<ArticleId, string> = {
		usage: t("ui.tokenUsage.guide.articles.usage"),
		compaction: t("ui.tokenUsage.guide.articles.compaction"),
		memory: t("ui.tokenUsage.guide.articles.memory"),
		skills: t("ui.tokenUsage.guide.articles.skills"),
	}
	const reading = {
		usage: {
			title: t("ui.tokenUsage.guide.readingTitles.usage"),
			description: t("ui.tokenUsage.guide.readingDescriptions.usage"),
		},
		compaction: {
			title: t("ui.tokenUsage.guide.readingTitles.compaction"),
			description: t("ui.tokenUsage.guide.readingDescriptions.compaction"),
		},
		memory: {
			title: t("ui.tokenUsage.guide.readingTitles.memory"),
			description: t("ui.tokenUsage.guide.readingDescriptions.memory"),
		},
		skills: { title: titles.skills, description: "" },
	}
	const groups: HelpNavigationGroup[] = [
		{
			id: "conversation",
			label: t("ui.tokenUsage.guide.conversation"),
			items: ["usage", "compaction"].map((id) => item(id as ArticleId)),
		},
		{
			id: "related",
			label: t("ui.tokenUsage.guide.related"),
			items: ["memory", "skills"].map((id) => item(id as ArticleId)),
		},
	]
	function item(id: ArticleId) {
		const Icon = ARTICLE_ICONS[id]
		return { id, articleId: id, label: titles[id], icon: <Icon size={16} /> }
	}
	const existing = memory?.help ?? skill?.help
	const help: HelpDefinition = existing ?? {
		title: titles[active],
		summary: props.help.summary,
		tone: "neutral",
		renderBody: () => (
			<>
				{active === "compaction" ? (
					<ContextUsageHelpContent />
				) : active === "usage" ? (
					<ContextUsageExplanation />
				) : (
					<p role="alert">{interfaceT("contextHelp.loadFailed")}</p>
				)}
				{RELATED_ARTICLES[active].length > 0 && (
					<section
						className={styles.related}
						aria-label={t("ui.tokenUsage.guide.recommended")}
					>
						<h3 className={styles["reading-heading"]}>
							<BookOpen size={16} aria-hidden />
							{t("ui.tokenUsage.guide.recommended")}
						</h3>
						<div className={styles["reading-grid"]}>
							{RELATED_ARTICLES[active].map((id) => {
								const Icon = ARTICLE_ICONS[id]
								return (
									<Button
										key={id}
										variant="outline"
										className={styles["reading-card"]}
										onClick={() => setActive(id)}
									>
										<span className={styles["reading-icon"]} aria-hidden>
											<Icon size={16} />
										</span>
										<span className={styles["reading-copy"]}>
											<span className={styles["reading-title"]}>
												{reading[id].title}
											</span>
											<span className={styles["reading-description"]}>
												{reading[id].description}
											</span>
										</span>
										<ArrowRight
											size={16}
											className={styles["reading-arrow"]}
											aria-hidden
										/>
									</Button>
								)
							})}
						</div>
					</section>
				)}
			</>
		),
	}
	return (
		<HelpDialogContent
			{...props}
			help={help}
			articleKey={active}
			contentRef={contentRef}
			navigation={
				<HelpNavigation
					hint={t("ui.tokenUsage.guide.navigationHint")}
					groups={groups}
					activeId={active}
					expanded={expanded}
					onSelect={(id) => {
						if (Object.hasOwn(ARTICLE_ICONS, id)) setActive(id as ArticleId)
					}}
					onExpandedChange={(id, open) =>
						setExpanded((current) => {
							const next = new Set(current)
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
