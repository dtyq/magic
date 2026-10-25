import { BrainCircuit, Files, MessagesSquare, Repeat2, RotateCw, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HelpIllustration } from "@/components/shadcn-composed/context-help/HelpIllustration"
import type { ModelHelpArticleId } from "./catalog"

export default function ModelHelpArticle({ articleId }: { articleId: ModelHelpArticleId }) {
	const { t } = useTranslation("super")
	if (articleId === "switching") {
		return (
			<div className="space-y-6">
				<p>{t("modelRecovery.help.switching.intro")}</p>
				<HelpIllustration
					variant="flow"
					title={t("modelRecovery.help.switching.diagram")}
					steps={[
						{
							title: t("modelRecovery.help.switching.keepTitle"),
							description: t("modelRecovery.help.switching.keepDescription"),
							icon: <Files size={16} />,
						},
						{
							title: t("modelRecovery.help.switching.selectTitle"),
							description: t("modelRecovery.help.switching.selectDescription"),
							icon: <Repeat2 size={16} />,
						},
						{
							title: t("modelRecovery.help.switching.continueTitle"),
							description: t("modelRecovery.help.switching.continueDescription"),
							icon: <MessagesSquare size={16} />,
						},
					]}
				/>
				<section className="space-y-2">
					<h3 className="font-semibold">{t("modelRecovery.help.switching.keptTitle")}</h3>
					<p>{t("modelRecovery.help.switching.kept")}</p>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">
						{t("modelRecovery.help.switching.changesTitle")}
					</h3>
					<p>{t("modelRecovery.help.switching.changes")}</p>
				</section>
				<p className="rounded-xl bg-muted/50 p-4 text-sm">
					{t("modelRecovery.help.switching.cancel")}
				</p>
			</div>
		)
	}
	return (
		<div className="space-y-6">
			<p>{t("modelRecovery.help.availability.intro")}</p>
			<HelpIllustration
				variant="flow"
				title={t("modelRecovery.help.availability.diagram")}
				steps={[
					{
						title: t("modelRecovery.help.availability.computeTitle"),
						description: t("modelRecovery.help.availability.computeDescription"),
						icon: <BrainCircuit size={16} />,
					},
					{
						title: t("modelRecovery.help.availability.protectTitle"),
						description: t("modelRecovery.help.availability.protectDescription"),
						icon: <ShieldCheck size={16} />,
					},
					{
						title: t("modelRecovery.help.availability.recoverTitle"),
						description: t("modelRecovery.help.availability.recoverDescription"),
						icon: <RotateCw size={16} />,
					},
				]}
			/>
			<section className="space-y-2">
				<h3 className="font-semibold">{t("modelRecovery.help.availability.peakTitle")}</h3>
				<p>{t("modelRecovery.help.availability.peak")}</p>
			</section>
			<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
				<section className="space-y-2 rounded-xl border p-4">
					<h3 className="font-semibold">
						{t("modelRecovery.help.availability.automaticTitle")}
					</h3>
					<p className="text-sm text-muted-foreground">
						{t("modelRecovery.help.availability.automatic")}
					</p>
				</section>
				<section className="space-y-2 rounded-xl border p-4">
					<h3 className="font-semibold">
						{t("modelRecovery.help.availability.operationsTitle")}
					</h3>
					<p className="text-sm text-muted-foreground">
						{t("modelRecovery.help.availability.operations")}
					</p>
				</section>
			</div>
			<section className="space-y-2 rounded-xl bg-muted/50 p-4">
				<h3 className="font-semibold">{t("modelRecovery.help.availability.nextTitle")}</h3>
				<p className="text-sm">{t("modelRecovery.help.availability.next")}</p>
			</section>
		</div>
	)
}
