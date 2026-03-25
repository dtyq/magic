import { ChevronLeft, Loader2, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Separator } from "@/components/shadcn-ui/separator"
import { LocaleTextInput } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/PlaybookPanel/components/SceneEditPanel/components/LocaleTextInput"
import { usePublishPanelStore } from "../context"
import PublishTargetFields from "./PublishTargetFields"

interface PublishCreateViewProps {
	onClose: () => void
}

export default observer(function PublishCreateView({ onClose }: PublishCreateViewProps) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const isFormDisabled = store.isSubmitting

	return (
		<div
			className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background"
			data-testid="skill-publish-create-panel"
		>
			<div className="flex items-center gap-2 px-3.5 pb-3 pt-3.5">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 rounded-md px-2.5"
					onClick={store.openHistoryView}
					disabled={isFormDisabled}
					data-testid="skill-publish-create-back-button"
				>
					<ChevronLeft className="size-4" />
					{t("skillEditPage.actions.publish")}
				</Button>
				<h2 className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
					{t("skillEditPage.publishPanel.create.title")}
				</h2>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 rounded-md"
					onClick={onClose}
					disabled={isFormDisabled}
					data-testid="skill-publish-create-close-button"
				>
					<X className="size-4" />
				</Button>
			</div>

			<Separator />

			<div className="min-h-0 flex-1 overflow-auto p-4">
				<div className="flex flex-col gap-4" data-testid="skill-publish-create-form">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="skill-publish-version-input"
							className="flex items-center gap-1 text-base font-medium text-foreground"
						>
							{t("skillEditPage.publishPanel.create.fields.version.label")}
							<span className="text-destructive" aria-hidden="true">
								*
							</span>
							<span className="sr-only">
								{t("skillEditPage.publishPanel.create.fields.version.required")}
							</span>
						</label>
						<Input
							id="skill-publish-version-input"
							value={store.draft.version}
							onChange={(event) => store.setVersion(event.target.value)}
							placeholder={t(
								"skillEditPage.publishPanel.create.fields.version.placeholder",
							)}
							disabled={isFormDisabled}
							className="h-9"
							required
							aria-required="true"
							data-testid="skill-publish-version-input"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-base font-medium text-foreground">
							{t("skillEditPage.publishPanel.create.fields.details.label")}
						</label>
						<LocaleTextInput
							value={store.draft.details}
							onChange={store.setDetails}
							placeholder={t(
								"skillEditPage.publishPanel.create.fields.details.placeholder",
							)}
							localizeLabel={t(
								"skillEditPage.publishPanel.create.fields.details.label",
							)}
							multiline
							disabled={isFormDisabled}
							className="min-h-24"
							data-testid="skill-publish-details-input"
						/>
					</div>

					<PublishTargetFields disabled={isFormDisabled} />
				</div>
			</div>

			<div className="flex items-center justify-end gap-1.5 border-t border-border p-3">
				<Button
					type="button"
					variant="outline"
					className="h-9 rounded-md px-4"
					onClick={store.openHistoryView}
					disabled={store.isSubmitting}
					data-testid="skill-publish-create-cancel-button"
				>
					{t("skillEditPage.publishPanel.actions.cancel")}
				</Button>
				<Button
					type="button"
					className="h-9 rounded-md px-4"
					onClick={() => void store.submitDraft()}
					disabled={!store.canSubmit || store.isSubmitting}
					aria-busy={store.isSubmitting}
					data-testid="skill-publish-create-submit-button"
				>
					{store.isSubmitting ? (
						<span className="inline-flex items-center gap-2">
							<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
							{t("skillEditPage.publishPanel.actions.publish")}
						</span>
					) : (
						t("skillEditPage.publishPanel.actions.publish")
					)}
				</Button>
			</div>
		</div>
	)
})
