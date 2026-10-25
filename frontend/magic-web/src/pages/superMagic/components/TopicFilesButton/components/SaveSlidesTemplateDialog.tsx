import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { SlidesTemplateItem } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"

export type SaveSlidesTemplateTarget = "new" | SlidesTemplateItem["code"]

interface SaveSlidesTemplateDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	templates: SlidesTemplateItem[]
	selectedTarget: SaveSlidesTemplateTarget
	onSelectedTargetChange: (target: SaveSlidesTemplateTarget) => void
	isLoading: boolean
	isSaving: boolean
	notice?: string
	error?: string
	onRetry: () => void
	onSave: () => void
}

function getTemplateLabel(template: SlidesTemplateItem, language: string) {
	const isEnglish = language.toLowerCase().startsWith("en")
	return (
		(isEnglish ? template.label.en_US : template.label.zh_CN) ||
		(isEnglish ? template.label.zh_CN : template.label.en_US) ||
		template.code
	)
}

export default function SaveSlidesTemplateDialog({
	open,
	onOpenChange,
	templates,
	selectedTarget,
	onSelectedTargetChange,
	isLoading,
	isSaving,
	notice,
	error,
	onRetry,
	onSave,
}: SaveSlidesTemplateDialogProps) {
	const { t, i18n } = useTranslation("super")
	const selectedTemplate = useMemo(
		() => templates.find((template) => template.code === selectedTarget),
		[selectedTarget, templates],
	)

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
			<DialogContent className="gap-5 sm:max-w-[560px]">
				<DialogHeader>
					<DialogTitle>{t("mySlidesTemplates.saveDialog.title")}</DialogTitle>
					<DialogDescription>
						{t("mySlidesTemplates.saveDialog.description")}
					</DialogDescription>
				</DialogHeader>
				{notice ? (
					<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
						{notice}
					</p>
				) : null}

				<RadioGroup
					value={selectedTarget}
					onValueChange={onSelectedTargetChange}
					aria-label={t("mySlidesTemplates.saveDialog.targetLabel")}
					className="gap-2"
				>
					<label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
						<RadioGroupItem
							value="new"
							aria-label={t("mySlidesTemplates.saveDialog.newTemplate")}
						/>
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-medium">
								{t("mySlidesTemplates.saveDialog.newTemplate")}
							</span>
							<span className="block text-xs text-muted-foreground">
								{t("mySlidesTemplates.saveDialog.newDescription")}
							</span>
						</span>
					</label>

					<div className="space-y-2">
						<div className="text-sm font-medium text-foreground">
							{t("mySlidesTemplates.saveDialog.createdTemplates")}
						</div>
						{isLoading ? (
							<div className="flex items-center justify-center rounded-xl border border-dashed border-border py-8 text-sm text-muted-foreground">
								<Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
								{t("mySlidesTemplates.loading")}
							</div>
						) : error ? (
							<div className="rounded-xl border border-dashed border-destructive/40 p-4 text-center">
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-3"
									onClick={onRetry}
								>
									{t("mySlidesTemplates.retry")}
								</Button>
							</div>
						) : templates.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
								{t("mySlidesTemplates.saveDialog.noCreatedTemplates")}
							</div>
						) : (
							<ScrollArea
								className="h-52 rounded-xl border border-border"
								viewportClassName="p-2"
							>
								<div className="space-y-1">
									{templates.map((template) => (
										<label
											key={template.code}
											className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60 has-[[data-state=checked]]:bg-muted"
										>
											<RadioGroupItem
												value={template.code}
												aria-label={getTemplateLabel(
													template,
													i18n.language,
												)}
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm">
													{getTemplateLabel(template, i18n.language)}
												</span>
												<span className="block truncate text-xs text-muted-foreground">
													{template.code}
												</span>
											</span>
										</label>
									))}
								</div>
							</ScrollArea>
						)}
					</div>
				</RadioGroup>

				{selectedTemplate ? (
					<p className="text-xs text-muted-foreground">
						{t("mySlidesTemplates.saveDialog.overwriteHint", {
							name: getTemplateLabel(selectedTemplate, i18n.language),
						})}
					</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						{t("slidesTemplatePreview.save.cancel")}
					</Button>
					<Button type="button" onClick={onSave} disabled={isSaving || Boolean(notice)}>
						{isSaving ? (
							<Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
						) : null}
						{selectedTarget === "new"
							? t("mySlidesTemplates.saveDialog.create")
							: t("mySlidesTemplates.saveDialog.overwrite")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
