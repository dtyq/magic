import { lazy, useLayoutEffect, useRef, useState } from "react"
import { ArrowRight, CircleHelp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ContextHelp } from "@/components/shadcn-composed/context-help"
import { HelpDialogContent } from "@/components/shadcn-composed/context-help/HelpDialog"
import { HelpNavigation } from "@/components/shadcn-composed/context-help/HelpNavigation"
import { Button } from "@/components/shadcn-ui/button"
import { getModelHelpArticle, useModelHelpCatalog, type ModelHelpArticleId } from "./catalog"

const ModelHelpArticle = lazy(() => import("./ModelHelpArticle"))

/** 业务入口拥有文章选择，外框标题、正文与目录始终来自同一篇文章。 */
export function ModelHelp({ code }: { code: string }) {
	const { t } = useTranslation("super")
	const catalog = useModelHelpCatalog()
	const [articleId, setArticleId] = useState<ModelHelpArticleId>(() => getModelHelpArticle(code))
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(["models"]))
	const contentRef = useRef<HTMLDivElement>(null)
	const previousArticleId = useRef(articleId)
	const article = catalog[articleId]
	const articleIds = Object.keys(catalog) as ModelHelpArticleId[]
	useLayoutEffect(() => {
		if (previousArticleId.current === articleId) return
		previousArticleId.current = articleId
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
		<ContextHelp
			mode="dialog"
			header={article.header}
			help={{
				title: article.title,
				summary: article.summary,
				tone: "indigo",
				renderBody: (reading) => (
					<>
						<ModelHelpArticle articleId={articleId} />
						{reading?.recommended && (
							<section className="mt-6 space-y-2 border-t pt-5">
								<h3 className="text-sm font-semibold">
									{t("modelRecovery.help.recommended")}
								</h3>
								{reading.recommended}
							</section>
						)}
					</>
				),
			}}
			renderDialog={(props) => (
				<HelpDialogContent
					{...props}
					articleKey={articleId}
					contentRef={contentRef}
					reading={{
						recommended: articleIds
							.filter((id) => id !== articleId)
							.map((id) => (
								<Button
									key={id}
									variant="link"
									className="h-auto p-0"
									onClick={() => setArticleId(id)}
								>
									{catalog[id].title}
									<ArrowRight size={16} />
								</Button>
							)),
					}}
					navigation={
						<HelpNavigation
							hint={t("modelRecovery.help.catalogHint")}
							groups={[
								{
									id: "models",
									label: t("modelRecovery.help.catalogTitle"),
									items: articleIds.map((id) => {
										const ItemIcon = catalog[id].icon
										return {
											id,
											articleId: id,
											label: catalog[id].title,
											icon: <ItemIcon size={16} />,
										}
									}),
								},
							]}
							activeId={articleId}
							expanded={expanded}
							onSelect={(id) => {
								if (Object.hasOwn(catalog, id))
									setArticleId(id as ModelHelpArticleId)
							}}
							onExpandedChange={(id, open) =>
								setExpanded(open ? new Set([id]) : new Set())
							}
						/>
					}
				/>
			)}
		>
			<Button
				variant="link"
				size="sm"
				className="h-auto shrink-0 gap-1 px-0 text-xs font-normal [@media(pointer:coarse)]:min-h-11"
			>
				<CircleHelp size={16} aria-hidden />
				{t("modelRecovery.why")}
			</Button>
		</ContextHelp>
	)
}
