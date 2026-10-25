import { observer } from "mobx-react-lite"
import { Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/shadcn-ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Switch } from "@/components/shadcn-ui/switch"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"
import { filterNotesModels, resolveNotesModelId } from "../utils/speakerNotesModel"

/** Gear entry plus dialog for AI notes settings; observer keeps the async model list live. */
const PPTNotesSettingsDialog = observer(function PPTNotesSettingsDialog({
	hintEnabled = true,
}: {
	/** The panel stays mounted while collapsed; its portaled hint must not leak out. */
	hintEnabled?: boolean
}) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const models = filterNotesModels(superMagicModeService.getModelListByMode(TopicMode.Default))
	const selectedId = resolveNotesModelId(models, pptNotesPreferenceStore.modelId)

	useEffect(() => {
		// The catalog is normally warm; load it lazily if the user opens settings first.
		if (open && !models.length) void superMagicModeService.fetchDefaultModeModelList()
	}, [open, models.length])

	const showHint = hintEnabled && !pptNotesPreferenceStore.modelHintDismissed && !open

	return (
		<>
			<Popover open={showHint}>
				<PopoverAnchor asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
						data-testid="ppt-notes-settings-trigger"
						onClick={() => {
							pptNotesPreferenceStore.dismissModelHint()
							setOpen(true)
						}}
					>
						<Settings size={16} />
						{t("ppt.speakerNotes.settings.trigger")}
					</Button>
				</PopoverAnchor>
				{/* Non-modal: never steal focus or close on outside clicks; only explicit dismissal hides it. */}
				<PopoverContent
					side="top"
					align="end"
					className="flex w-64 items-start gap-3 p-3 text-xs"
					data-testid="ppt-notes-model-hint"
					onOpenAutoFocus={(event) => event.preventDefault()}
					onInteractOutside={(event) => event.preventDefault()}
					onEscapeKeyDown={(event) => event.preventDefault()}
				>
					<span className="flex-1 leading-5">{t("ppt.speakerNotes.settings.hint")}</span>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 shrink-0 px-2 text-xs"
						data-testid="ppt-notes-model-hint-dismiss"
						onClick={() => pptNotesPreferenceStore.dismissModelHint()}
					>
						{t("ppt.speakerNotes.settings.hintDismiss")}
					</Button>
				</PopoverContent>
			</Popover>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-sm" data-testid="ppt-notes-settings-content">
					<DialogHeader>
						<DialogTitle>{t("ppt.speakerNotes.settings.title")}</DialogTitle>
						<DialogDescription>
							{t("ppt.speakerNotes.settings.description")}
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center justify-between gap-4">
						<span className="shrink-0 text-sm font-medium">
							{t("ppt.speakerNotes.settings.model")}
						</span>
						<Select
							value={selectedId ?? ""}
							onValueChange={(value) => pptNotesPreferenceStore.setModelId(value)}
							disabled={!models.length}
						>
							<SelectTrigger
								className="min-w-0 flex-1 basis-0 justify-between"
								data-testid="ppt-notes-settings-model-select"
							>
								<SelectValue
									placeholder={t("ppt.speakerNotes.settings.noModels")}
								/>
							</SelectTrigger>
							{/* Cap height by both a fixed limit and the viewport space left, so long lists scroll. */}
							<SelectContent className="max-h-[min(280px,var(--radix-select-content-available-height))]">
								{models.map((model) => (
									<SelectItem key={model.model_id} value={model.model_id}>
										{/* SelectValue mirrors this content, so the trigger shows icon + name too. */}
										<span className="flex min-w-0 items-center gap-2">
											{model.model_icon ? (
												<img
													src={model.model_icon}
													alt=""
													className="size-4 shrink-0 rounded-sm"
												/>
											) : null}
											<span className="truncate">
												{model.model_name || model.model_id}
											</span>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-start justify-between gap-4">
						<div className="flex flex-col gap-1">
							<label htmlFor="ppt-notes-auto-apply" className="text-sm font-medium">
								{t("ppt.speakerNotes.autoApply")}
							</label>
							<span className="text-xs text-muted-foreground">
								{t("ppt.speakerNotes.settings.autoApplyHint")}
							</span>
						</div>
						<Switch
							id="ppt-notes-auto-apply"
							data-testid="ppt-notes-settings-auto-apply"
							checked={pptNotesPreferenceStore.autoApply}
							onCheckedChange={(value) => pptNotesPreferenceStore.setAutoApply(value)}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
})

export default PPTNotesSettingsDialog
