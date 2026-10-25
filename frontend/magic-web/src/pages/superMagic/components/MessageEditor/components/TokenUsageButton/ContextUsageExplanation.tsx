import { useTranslation } from "react-i18next"
import { CONTEXT_USAGE_GUIDE_STYLES as styles } from "./ContextUsageGuideStyles"
import { Brain, Gauge, Sparkles } from "lucide-react"
import { useContextUsageCategories } from "./context-usage-categories"

// 此图仅解释正文中的教学示例；实时卡片使用请求快照，不能引用这些比例。
const EXAMPLE_INPUT_SHARES = [8, 14, 10, 20, 20, 28] as const

export default function ContextUsageExplanation() {
	const { t } = useTranslation("super")
	const categories = useContextUsageCategories()
	return (
		<article className={styles["article"]}>
			<p className={styles["article-intro"]}>{t("ui.tokenUsage.guide.content.usageIntro")}</p>
			<div className={styles["visual"]}>
				<div className={styles["visual-title"]}>
					<span>{t("ui.tokenUsage.guide.content.inputsTitle")}</span>
					<span>{t("ui.tokenUsage.guide.content.inputsCaption")}</span>
				</div>
				<div className={styles["capacity-inputs"]}>
					{categories.map(({ label, field, detail, color, Icon }) => (
						<div key={field} className={styles["capacity-input"]}>
							<Icon size={16} style={{ color }} />
							<div>
								<strong>{label}</strong>
								<p>{detail}</p>
							</div>
						</div>
					))}
				</div>
				<div className={styles["simple-note"]}>
					<Brain size={16} />
					<span>{t("ui.tokenUsage.guide.content.inputsPurpose")}</span>
				</div>
			</div>
			<h3>{t("ui.tokenUsage.guide.content.budgetTitle")}</h3>
			<div className={styles["visual"]}>
				<div className={styles["budget-labels"]}>
					<strong>{t("ui.tokenUsage.guide.content.examplePercent")}</strong>
					<span>{t("ui.tokenUsage.guide.content.exampleCapacity")}</span>
				</div>
				<div className={styles["budget-track"]}>
					{categories.map(({ field, color }, index) => (
						<span
							key={field}
							style={{
								background: color,
								width: `${(61 * EXAMPLE_INPUT_SHARES[index]) / 100}%`,
							}}
						/>
					))}
					<span className={styles["budget-marker"]} />
				</div>
				<div className={styles["budget-labels"]}>
					<span>{t("ui.tokenUsage.guide.content.exampleUsed")}</span>
					<span>{t("ui.tokenUsage.guide.content.exampleThreshold")}</span>
				</div>
				<p className={styles["visual-caption"]}>
					{t("ui.tokenUsage.guide.content.exampleCaption")}
				</p>
			</div>
			<div className={styles["short-grid"]}>
				<div className={styles["short-item"]}>
					<Gauge size={16} />
					<div>
						<strong>{t("ui.tokenUsage.guide.content.tokenTitle")}</strong>
						<p>{t("ui.tokenUsage.guide.content.tokenDescription")}</p>
					</div>
				</div>
				<div className={styles["short-item"]}>
					<Sparkles size={16} />
					<div>
						<strong>{t("ui.tokenUsage.guide.content.nearLimitTitle")}</strong>
						<p>{t("ui.tokenUsage.guide.content.nearLimitDescription")}</p>
					</div>
				</div>
			</div>
			<UsageLesson />
		</article>
	)
}
function UsageLesson() {
	const { t } = useTranslation("super")
	return (
		<div className={styles["lesson"]}>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.inputsLessonTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.inputsLessonDescription")}</p>
				<p>{t("ui.tokenUsage.guide.content.inputsLessonGrowth")}</p>
				<div className={styles["lesson-example"]}>
					<div className={styles["lesson-label"]}>
						{t("ui.tokenUsage.guide.content.filesNoteTitle")}
					</div>
					<p>{t("ui.tokenUsage.guide.content.filesNote")}</p>
				</div>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.tokensLessonTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.tokensLessonDescription")}</p>
				<p>{t("ui.tokenUsage.guide.content.tokensLessonK")}</p>
				<p>{t("ui.tokenUsage.guide.content.tokensLessonReading")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.numbersTitle")}</h3>
				<div className={styles["lesson-table"]}>
					<div className={styles["lesson-table-head"]}>
						<span>{t("ui.tokenUsage.guide.content.numbersColumn")}</span>
						<span>{t("ui.tokenUsage.guide.content.numbersMeaningColumn")}</span>
					</div>
					<div>
						<strong>{t("ui.tokenUsage.guide.content.numbersUsage")}</strong>
						<span>{t("ui.tokenUsage.guide.content.numbersUsageMeaning")}</span>
					</div>
					<div>
						<strong>{t("ui.tokenUsage.guide.content.numbersInput")}</strong>
						<span>{t("ui.tokenUsage.guide.content.numbersInputMeaning")}</span>
					</div>
					<div>
						<strong>{t("ui.tokenUsage.guide.content.numbersThreshold")}</strong>
						<span>{t("ui.tokenUsage.guide.content.numbersThresholdMeaning")}</span>
					</div>
				</div>
				<p>{t("ui.tokenUsage.guide.content.numbersDifference")}</p>
				<p>{t("ui.tokenUsage.guide.content.numbersColors")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.sourcesTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.sourcesSkills")}</p>
				<p>{t("ui.tokenUsage.guide.content.sourcesMcp")}</p>
				<div className={styles["lesson-example"]}>
					<div className={styles["lesson-label"]}>
						{t("ui.tokenUsage.guide.content.sourcesExampleTitle")}
					</div>
					<p>{t("ui.tokenUsage.guide.content.sourcesExampleOutput")}</p>
					<p>{t("ui.tokenUsage.guide.content.sourcesExampleInstalled")}</p>
				</div>
				<p>{t("ui.tokenUsage.guide.content.sourcesMixed")}</p>
				<p>{t("ui.tokenUsage.guide.content.sourcesOther")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.actionTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.actionContinue")}</p>
				<p>{t("ui.tokenUsage.guide.content.actionMaterials")}</p>
				<p>{t("ui.tokenUsage.guide.content.actionTopic")}</p>
			</section>
			<section>
				<h3>{t("ui.tokenUsage.guide.content.updatesTitle")}</h3>
				<p>{t("ui.tokenUsage.guide.content.updatesTiming")}</p>
				<p>{t("ui.tokenUsage.guide.content.updatesRemaining")}</p>
				<p>{t("ui.tokenUsage.guide.content.updatesBreakdown")}</p>
			</section>
		</div>
	)
}
