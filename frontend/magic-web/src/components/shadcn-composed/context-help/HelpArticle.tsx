import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Info, Layers, MessageSquare, Sparkles, Users } from "lucide-react"
import { HelpIllustration, type HelpIllustrationProps, type HelpStep } from "./HelpIllustration"
import type { HelpReadingLinks } from "./types"

const BENEFIT_ICONS = [Sparkles, Users, Layers]

export interface HelpGuide {
	title?: string
	benefits?: Array<{ title: string; description: string }>
	context: string
	diagramTitle: string
	steps: HelpStep[]
	exampleContent: string
	result: string
	actions?: string
	tipsTitle?: string
	tips?: string[]
}

export interface HelpArticleProps {
	usage: string
	example: string
	note: string
	guide: HelpGuide
	visual: HelpIllustrationProps["variant"]
	illustration?: ReactNode
	sampleIdentity?: ReactNode
	reading?: HelpReadingLinks
}

/** 文件等用途说明共用阅读层级；内容由所属业务提供，简介在面板标题下展示。 */
export function HelpArticle({
	usage,
	example,
	note,
	guide,
	visual,
	illustration,
	sampleIdentity,
	reading,
}: HelpArticleProps) {
	const { t } = useTranslation("interface")
	return (
		<article className="space-y-8">
			<section className="space-y-2">
				<h3 className="text-2xl font-semibold leading-[1.4] tracking-[-0.5px] [@container_help-article_(min-width:500px)]:text-[29px]">
					{guide.title ?? t("contextHelp.usage")}
				</h3>
				<p className="whitespace-pre-line">{usage}</p>
				<p className="text-muted-foreground">{guide.context}</p>
			</section>
			{guide.benefits?.length ? (
				<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-3">
					{guide.benefits.map((benefit, index) => {
						const Icon = BENEFIT_ICONS[index % BENEFIT_ICONS.length]
						return (
							<div
								key={benefit.title}
								className="rounded-xl border bg-gradient-to-br from-[var(--help-soft)] to-background to-75% p-4"
							>
								<Icon
									size={21}
									aria-hidden
									className="mb-3 text-[var(--help-accent)]"
								/>
								<h4 className="mb-1 font-medium">{benefit.title}</h4>
								<p className="text-xs leading-6 text-muted-foreground">
									{benefit.description}
								</p>
							</div>
						)
					})}
				</div>
			) : null}
			{illustration ?? (
				<HelpIllustration title={guide.diagramTitle} steps={guide.steps} variant={visual} />
			)}
			{reading?.further}
			<section className="space-y-2">
				<h3 className="text-lg font-semibold">{t("contextHelp.example")}</h3>
				<div className="flex items-start gap-3 rounded-r-xl border-l-[3px] border-[var(--help-accent)] bg-[var(--help-soft)] p-4">
					<MessageSquare
						size={16}
						aria-hidden
						className="mt-1.5 shrink-0 text-[var(--help-accent)]"
					/>
					<p>{example}</p>
				</div>
				<div className="overflow-hidden rounded-lg border">
					<div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
						{sampleIdentity ?? <FileText size={16} aria-hidden />}
						{t("contextHelp.sampleContent")}
					</div>
					<pre className="whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-[1.9]">
						{guide.exampleContent}
					</pre>
				</div>
				<p>{guide.result}</p>
			</section>
			{guide.actions && (
				<section className="space-y-2">
					<h3 className="font-semibold">{t("contextHelp.actions")}</h3>
					<p>{guide.actions}</p>
				</section>
			)}
			{guide.tips?.length ? (
				<aside className="space-y-3 rounded-xl border bg-[var(--help-soft)] p-5">
					<h3 className="font-semibold">{guide.tipsTitle ?? t("contextHelp.note")}</h3>
					{guide.tips.map((tip) => (
						<p key={tip}>{tip}</p>
					))}
				</aside>
			) : null}
			<aside className="space-y-2 rounded-lg border bg-muted/30 p-4 text-muted-foreground">
				<h3 className="flex items-center gap-2 font-medium text-foreground">
					<Info size={16} aria-hidden />
					{t("contextHelp.note")}
				</h3>
				<p>{note}</p>
			</aside>
			{reading?.recommended}
		</article>
	)
}
