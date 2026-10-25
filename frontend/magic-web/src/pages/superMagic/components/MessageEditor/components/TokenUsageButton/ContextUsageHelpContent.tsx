import { useTranslation } from "react-i18next"
import { CONTEXT_USAGE_GUIDE_STYLES as styles } from "./ContextUsageGuideStyles"
import { ArrowRight, Check, Layers, MessageSquare, Sparkles } from "lucide-react"

export default function ContextUsageHelpContent() {
	const { t } = useTranslation("super")
	return (
		<article className={styles["article"]}>
			<p className={styles["article-intro"]}>
				<strong>{t("ui.tokenUsage.guide.content.autoLead")}</strong>
				<br />
				{t("ui.tokenUsage.guide.content.autoIntro")}
			</p>
			<div className={styles["visual"]}>
				<div className={styles["visual-title"]}>
					<span>{t("ui.tokenUsage.guide.content.flowTitle")}</span>
					<span>{t("ui.tokenUsage.guide.content.flowCaption")}</span>
				</div>
				<div className={styles["flow"]}>
					<div className={styles["paper"]}>
						<div className={styles["paper-title"]}>
							<MessageSquare size={16} />
							{t("ui.tokenUsage.guide.content.historyTitle")}
						</div>
						<div className={styles["history-lines"]}>
							<div className={styles["history-line"]}>
								{t("ui.tokenUsage.guide.content.historyRequirements")}
							</div>
							<div className={styles["history-line-short"]}>
								{t("ui.tokenUsage.guide.content.historyFiles")}
							</div>
							<div className={styles["history-line"]}>
								{t("ui.tokenUsage.guide.content.historyCompleted")}
							</div>
						</div>
						<div className={styles["recent"]}>
							{t("ui.tokenUsage.guide.content.historyLimit")}
						</div>
					</div>
					<ArrowRight size={16} className={styles["flow-arrow"]} aria-hidden />
					<div className={styles["paper"]}>
						<div className={styles["paper-title"]}>
							<Sparkles size={16} />
							{t("ui.tokenUsage.guide.content.summaryTitle")}
						</div>
						<div className={styles["summary-pills"]}>
							<span>{t("ui.tokenUsage.guide.content.summaryGoal")}</span>
							<span>{t("ui.tokenUsage.guide.content.summaryRequirements")}</span>
							<span>{t("ui.tokenUsage.guide.content.summaryConclusions")}</span>
							<span>{t("ui.tokenUsage.guide.content.summaryNext")}</span>
						</div>
						<div className={styles["recent"]}>
							{t("ui.tokenUsage.guide.content.summaryContinue")}
						</div>
					</div>
				</div>
			</div>
			<div className={styles["short-grid"]}>
				<div className={styles["short-item"]}>
					<Check size={16} />
					<div>
						<strong>{t("ui.tokenUsage.guide.content.keepFilesTitle")}</strong>
						<p>{t("ui.tokenUsage.guide.content.keepFiles")}</p>
					</div>
				</div>
				<div className={styles["short-item"]}>
					<Layers size={16} />
					<div>
						<strong>{t("ui.tokenUsage.guide.content.recoverTitle")}</strong>
						<p>{t("ui.tokenUsage.guide.content.recover")}</p>
					</div>
				</div>
			</div>
			<div className={styles["simple-note"]}>
				<Sparkles size={16} />
				<span>{t("ui.tokenUsage.guide.content.manualOptional")}</span>
			</div>
			<CompactionLesson />
		</article>
	)
}
function CompactionLesson() {
	const { t } = useTranslation("super")
	return (
		<div className={styles["lesson"]}>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.limitTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.limitDescription")}</p>
				<p>{t("ui.tokenUsage.guide.content.limitCost")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.recoveryTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.recoverySummary")}</p>
				<p>{t("ui.tokenUsage.guide.content.recoveryHistory")}</p>
				<p>{t("ui.tokenUsage.guide.content.recoveryTradeoff")}</p>
				<div className={styles["lesson-example"]}>
					<div className={styles["lesson-label"]}>
						{t("ui.tokenUsage.guide.content.reportTitle")}
					</div>
					<p>{t("ui.tokenUsage.guide.content.reportContinue")}</p>
					<p>{t("ui.tokenUsage.guide.content.reportHistory")}</p>
					<p>{t("ui.tokenUsage.guide.content.reportOriginal")}</p>
				</div>
				<p>{t("ui.tokenUsage.guide.content.historyLimits")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.filesTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.filesKept")}</p>
				<p>{t("ui.tokenUsage.guide.content.filesReread")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.waitingTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.waitingDescription")}</p>
				<p>{t("ui.tokenUsage.guide.content.waitingThreshold")}</p>
				<p>{t("ui.tokenUsage.guide.content.waitingUsage")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.manualTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.manualDescription")}</p>
				<p>{t("ui.tokenUsage.guide.content.manualTopic")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.memoryTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.memoryDescription")}</p>
				<p>{t("ui.tokenUsage.guide.content.memoryExample")}</p>
			</section>
		</div>
	)
}
