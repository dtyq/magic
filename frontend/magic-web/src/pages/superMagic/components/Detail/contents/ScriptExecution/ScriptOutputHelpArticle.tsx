import { useTranslation } from "react-i18next"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/shadcn-ui/accordion"
import ScriptExecutionLessonDemo from "./ScriptExecutionLessonDemo"
import ScriptExecutionLessonCode from "./ScriptExecutionLessonCode"
import ScriptExecutionLessonPractice from "./ScriptExecutionLessonPractice"
import ScriptExecutionLessonFlow from "./ScriptExecutionLessonFlow"
import ScriptExecutionLessonRetry from "./ScriptExecutionLessonRetry"
import ScriptExecutionLessonStreams from "./ScriptExecutionLessonStreams"
import ScriptExecutionLessonIntervention from "./ScriptExecutionLessonIntervention"
import ScriptExecutionLessonReading from "./ScriptExecutionLessonReading"

export const SCRIPT_OUTPUT_HELP_ARTICLES = [
	"python",
	"execution",
	"code",
	"streams",
	"errors",
	"intervention",
	"reading",
	"case",
] as const
export type ScriptOutputHelpArticleId = (typeof SCRIPT_OUTPUT_HELP_ARTICLES)[number]

interface ScriptLessonArticle {
	intro: string[]
	sections: { title: string; paragraphs: string[]; code?: string }[]
	overview: { lead: string; facts: { title: string; text: string }[]; detailsTitle: string }
}

/** 每章先讲核心关系并展示对应行为；完整解释可展开，业务案例只放在拓展章节。 */
export default function ScriptOutputHelpArticle({
	articleId,
}: {
	articleId: ScriptOutputHelpArticleId
}) {
	const { t } = useTranslation("super")
	const articles: Record<ScriptOutputHelpArticleId, ScriptLessonArticle> = {
		python: t("scriptExecution.help.articles.python.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		execution: t("scriptExecution.help.articles.execution.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		code: t("scriptExecution.help.articles.code.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		streams: t("scriptExecution.help.articles.streams.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		errors: t("scriptExecution.help.articles.errors.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		intervention: t("scriptExecution.help.articles.intervention.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		reading: t("scriptExecution.help.articles.reading.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
		case: t("scriptExecution.help.articles.case.detail", {
			returnObjects: true,
		}) as ScriptLessonArticle,
	}
	const article = articles[articleId]
	return (
		<article key={articleId} className="min-w-0 space-y-6 text-foreground">
			<p className="m-0 text-sm leading-6">{article.overview.lead}</p>
			{(articleId === "python" || articleId === "execution") && (
				<ScriptExecutionLessonFlow topic={articleId} />
			)}
			{articleId === "code" && (
				<>
					<ScriptExecutionLessonCode />
					<ScriptExecutionLessonDemo scenario="basic" height={260} />
				</>
			)}
			{articleId === "streams" && <ScriptExecutionLessonStreams />}
			{articleId === "errors" && <ScriptExecutionLessonRetry />}
			{articleId === "intervention" && <ScriptExecutionLessonIntervention />}
			{articleId === "reading" && <ScriptExecutionLessonReading />}
			{articleId === "case" && <ScriptExecutionLessonPractice />}
			{article.overview.facts.length > 0 && (
				<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
					{article.overview.facts.map(({ title, text }) => (
						<div
							key={title}
							className="space-y-1 border-l-2 border-[var(--help-accent)] pl-3"
						>
							<h3 className="m-0 text-sm font-medium">{title}</h3>
							<p className="m-0 text-xs leading-5 text-muted-foreground">{text}</p>
						</div>
					))}
				</div>
			)}
			<Accordion type="single" collapsible className="rounded-lg border px-4">
				<AccordionItem value="details">
					<AccordionTrigger>{article.overview.detailsTitle}</AccordionTrigger>
					<AccordionContent className="space-y-5 text-sm leading-6">
						{article.intro.map((text) => (
							<p key={text} className="m-0">
								{text}
							</p>
						))}
						{article.sections.map(({ title, paragraphs, code }) => (
							<section key={title} className="space-y-2">
								<h3 className="m-0 text-sm font-semibold">{title}</h3>
								{paragraphs.map((text) => (
									<p key={text} className="m-0">
										{text}
									</p>
								))}
								{code && (
									<pre className="m-0 whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 text-[13px] leading-6">
										<code>{code}</code>
									</pre>
								)}
							</section>
						))}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</article>
	)
}
