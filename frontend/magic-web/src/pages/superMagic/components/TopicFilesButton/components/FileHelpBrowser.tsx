import { useLayoutEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { HelpDialogContent } from "@/components/shadcn-composed/context-help/HelpDialog"
import { HelpLocation } from "@/components/shadcn-composed/context-help/HelpLocation"
import { HelpNavigation } from "@/components/shadcn-composed/context-help/HelpNavigation"
import type {
	HelpDefinition,
	HelpDialogContentProps,
} from "@/components/shadcn-composed/context-help/types"
import { useFileHelpArticle, useFileHelpCatalog } from "../hooks/useFileHelpArticle"
import type { FileHelpPresentation } from "../hooks/useSystemFileHelp"
import type { FileHelpContext } from "../utils/magic-system-folder"
import {
	getFileHelpMetadata,
	getFileHelpRelations,
	isFileHelpArticleId,
	type FileHelpArticleId,
	type FileHelpGroupId,
	type FileHelpReadingLink,
} from "../utils/file-help-catalog"

interface FileHelpBrowserProps extends HelpDialogContentProps {
	initialArticleId: FileHelpArticleId
	fileLocation?: FileHelpPresentation["fileLocation"]
}

const contextGroups: Record<FileHelpContext["kind"], FileHelpGroupId> = {
	project: "project",
	claw: "assistant",
	crew: "crew",
	user: "personal",
	unknown: "current",
}

/** 一个打开会话只管理当前文章；文件、空间和应用路由都不参与文章跳转。 */
export default function FileHelpBrowser({
	initialArticleId,
	fileLocation,
	help: initialHelp,
	...dialogProps
}: FileHelpBrowserProps) {
	const { t } = useTranslation("interface")
	const catalog = useFileHelpCatalog()
	const initialMetadata = getFileHelpMetadata(initialArticleId)
	const initialGroup = fileLocation ? contextGroups[fileLocation.context] : initialMetadata.group
	const [articleId, setArticleId] = useState(initialArticleId)
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set([...catalog.ancestors[initialArticleId], initialGroup]),
	)
	const contentRef = useRef<HTMLDivElement>(null)
	const previousArticleId = useRef(articleId)
	const article = useFileHelpArticle(articleId)
	const baseHelp: HelpDefinition =
		articleId === initialArticleId
			? { ...initialHelp, tone: getFileHelpMetadata(articleId).tone }
			: (article ?? {
					title: catalog.names[articleId],
					summary: t("contextHelp.loadFailed"),
					renderBody: () => <p role="alert">{t("contextHelp.loadFailed")}</p>,
				})
	const isInitial = articleId === initialArticleId
	const location =
		isInitial && fileLocation
			? {
					scope: catalog.groupLabels[initialGroup],
					path:
						fileLocation.path || initialHelp.identity?.name || catalog.names[articleId],
				}
			: catalog.locations[articleId]
	const identity = baseHelp.identity ?? article?.identity
	const help: HelpDefinition = {
		...baseHelp,
		identity: identity
			? {
					...identity,
					name:
						isInitial && initialHelp.identity
							? initialHelp.identity.name
							: catalog.names[articleId],
					location,
				}
			: undefined,
	}
	// 具体文件和项目类型仍可从原入口进入；只在本次阅读中展示，不扩张常驻分类。
	const metadata = getFileHelpMetadata(articleId)
	if (!metadata.path && !metadata.projectKind) {
		const groupId = isInitial && fileLocation ? initialGroup : metadata.group
		let group = catalog.groups.find((item) => item.id === groupId)
		if (!group) {
			group = { id: groupId, label: catalog.groupLabels[groupId], items: [] }
			catalog.groups.push(group)
		}
		const parent = metadata.navigationParent
			? catalog.articleNodes.get(metadata.navigationParent)
			: undefined
		const items = parent?.children ?? group.items
		items.push({
			id: articleId,
			articleId,
			label: help.identity?.name ?? catalog.names[articleId],
			path: location.path,
			icon: help.identity?.renderIcon(16),
		})
	}
	useLayoutEffect(() => {
		const changed = previousArticleId.current !== articleId
		previousArticleId.current = articleId
		// 只有选择另一篇文章才回到顶部；语言变化沿用当前文章和浏览器中的阅读位置。
		// 目录选项或相关阅读会被隐藏／替换；把键盘阅读位置移到新文章，且不改滚动位置。
		if (changed) {
			const frame = requestAnimationFrame(() => {
				const element = contentRef.current
				if (!element) return
				element.scrollTop = 0
				element
					.querySelector<HTMLElement>("[data-help-heading]")
					?.focus({ preventScroll: true })
			})
			return () => cancelAnimationFrame(frame)
		}
	}, [articleId])

	function select(id: string) {
		if (!isFileHelpArticleId(id) || id === articleId) return
		setArticleId(id)
		setExpanded(
			(previous) =>
				new Set([
					...previous,
					...catalog.ancestors[id],
					...(id === initialArticleId ? [initialGroup] : []),
				]),
		)
	}
	const seen = new Set<FileHelpArticleId>([articleId])
	function unique(links: FileHelpReadingLink[] = []) {
		return links.filter((link) => {
			if (!isFileHelpArticleId(link.id) || seen.has(link.id)) return false
			seen.add(link.id)
			return true
		})
	}
	const relations = getFileHelpRelations(articleId)
	const further = unique(relations.further)
	const recommended = unique(relations.recommended)
	return (
		<HelpDialogContent
			{...dialogProps}
			help={help}
			articleKey={articleId}
			contentRef={contentRef}
			navigation={
				<HelpNavigation
					groups={catalog.groups}
					activeId={articleId}
					expanded={expanded}
					onSelect={select}
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
			reading={{
				further: further.length ? (
					<aside className="space-y-2">
						<h3 className="text-xs font-medium text-muted-foreground">
							{t("contextHelp.furtherReading")}
						</h3>
						{further.map((link) => (
							<Button
								key={link.id}
								variant="link"
								className="h-auto justify-start whitespace-normal p-0 text-left text-sm text-[var(--help-accent)]"
								onClick={() => select(link.id)}
							>
								<HelpLocation {...catalog.locations[link.id]} />
								<ArrowRight size={14} aria-hidden />
							</Button>
						))}
					</aside>
				) : undefined,
				recommended: recommended.length ? (
					<section className="space-y-3">
						<h3 className="text-lg font-semibold">
							{t("contextHelp.recommendedReading")}
						</h3>
						<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
							{recommended.map((link) => (
								<Button
									key={link.id}
									variant="outline"
									onClick={() => select(link.id)}
									className="h-auto min-w-0 flex-col items-start gap-2 whitespace-normal rounded-xl p-4 text-left hover:border-[var(--help-accent)] hover:bg-[var(--help-soft)]"
								>
									<span className="flex w-full items-start justify-between gap-2 text-sm font-medium">
										<HelpLocation {...catalog.locations[link.id]} />
										<ArrowRight size={16} className="shrink-0" aria-hidden />
									</span>
									<span className="text-xs font-normal leading-5 text-muted-foreground">
										{catalog.reasons[link.reason]}
									</span>
								</Button>
							))}
						</div>
					</section>
				) : undefined,
			}}
		/>
	)
}
