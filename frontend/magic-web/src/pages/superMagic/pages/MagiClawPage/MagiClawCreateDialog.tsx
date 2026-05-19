import { useMemo, useRef, useState, type ChangeEvent } from "react"
import { Circle, Loader2, Trash2, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawTemplateCode } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { useUpload } from "@/hooks/useUploadFiles"
import { cn } from "@/lib/utils"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { MagiClawTemplateAvatar } from "./MagiClawTemplateAvatar"
import { MAGI_CLAW_TEMPLATE_OPTIONS } from "./constants/template_options"

const AVATAR_FILE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"

export interface MagiClawCreatePayload {
	name: string
	icon?: string | null
	template_code: MagicClawTemplateCode
}

interface MagiClawCreateDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreate: (payload: MagiClawCreatePayload) => void
	isSubmitting?: boolean
}

export interface MagiClawTemplateOption {
	templateCode: MagicClawTemplateCode
	titleKey: string
	descriptionKey: string
	defaultNameKey: string
}

const DEFAULT_TEMPLATE = MAGI_CLAW_TEMPLATE_OPTIONS[0]

export function MagiClawCreateDialog({
	open,
	onOpenChange,
	onCreate,
	isSubmitting = false,
}: MagiClawCreateDialogProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
	const [isAvatarUploading, setIsAvatarUploading] = useState(false)
	const [isNameCustomized, setIsNameCustomized] = useState(false)
	const [selectedTemplateCode, setSelectedTemplateCode] = useState<MagicClawTemplateCode>(
		DEFAULT_TEMPLATE.templateCode,
	)

	const { uploadAndGetFileUrl } = useUpload({ storageType: "public" })

	const isBusy = isSubmitting || isAvatarUploading
	const defaultTemplateName = t(DEFAULT_TEMPLATE.defaultNameKey, clawBrandValues)
	const [name, setName] = useState(defaultTemplateName)
	const selectedTemplate = useMemo(
		() =>
			MAGI_CLAW_TEMPLATE_OPTIONS.find(
				(template) => template.templateCode === selectedTemplateCode,
			) ?? DEFAULT_TEMPLATE,
		[selectedTemplateCode],
	)

	function getTemplateDefaultName(template: MagiClawTemplateOption) {
		return t(template.defaultNameKey, clawBrandValues)
	}

	function handleCreate() {
		const trimmedName = name.trim()
		if (!trimmedName || isBusy) return
		onCreate({
			name: trimmedName,
			icon: customAvatarUrl ?? undefined,
			template_code: selectedTemplate.templateCode,
		})
	}

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(nextOpen)
		if (!nextOpen) {
			setName(getTemplateDefaultName(DEFAULT_TEMPLATE))
			setSelectedTemplateCode(DEFAULT_TEMPLATE.templateCode)
			setCustomAvatarUrl(null)
			setIsAvatarUploading(false)
			setIsNameCustomized(false)
		}
	}

	function handleTemplateChange(templateCode: MagicClawTemplateCode) {
		const nextTemplate =
			MAGI_CLAW_TEMPLATE_OPTIONS.find((template) => template.templateCode === templateCode) ??
			DEFAULT_TEMPLATE

		setSelectedTemplateCode(nextTemplate.templateCode)
		if (!isNameCustomized) setName(getTemplateDefaultName(nextTemplate))
	}

	function handleUploadAreaClick() {
		if (isBusy) return
		avatarInputRef.current?.click()
	}

	async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]
		event.target.value = ""
		if (!file || isBusy) return

		setIsAvatarUploading(true)
		try {
			const { fullfilled } = await uploadAndGetFileUrl([
				{ name: file.name, file, status: "init" },
			])
			const url = fullfilled[0]?.value?.url
			if (url) setCustomAvatarUrl(url)
			else
				magicToast.error(t("superLobster.createDialog.uploadAvatarFailed", clawBrandValues))
		} catch {
			magicToast.error(t("superLobster.createDialog.uploadAvatarFailed", clawBrandValues))
		} finally {
			setIsAvatarUploading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="w-full max-w-[min(347px,calc(100vw-2rem))] gap-0 overflow-hidden border-none bg-transparent p-0 shadow-2xl md:max-w-[512px]"
				data-testid="magi-claw-create-dialog"
			>
				<div className="relative overflow-hidden rounded-[10px] border border-black/5 bg-[linear-gradient(96deg,#FFF7F7_5.16%,#FFF_49.33%,#EEF5FF_93.49%)] shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(44,17,22,0.96)_0%,rgba(24,24,33,0.98)_48%,rgba(17,28,46,0.96)_100%)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
					<div
						className="pointer-events-none absolute inset-0 opacity-70 dark:hidden"
						style={{
							backgroundImage:
								"radial-gradient(circle at top left, rgba(248,113,113,0.12) 0, transparent 36%), radial-gradient(circle at bottom right, rgba(96,165,250,0.14) 0, transparent 40%), radial-gradient(rgba(239,68,68,0.06) 1px, transparent 1px)",
							backgroundPosition: "0 0, 100% 100%, 0 0",
							backgroundSize: "auto, auto, 8px 8px",
						}}
					/>
					<div
						className="pointer-events-none absolute inset-0 hidden opacity-100 dark:block"
						style={{
							backgroundImage:
								"radial-gradient(circle at top left, rgba(248,113,113,0.18) 0, transparent 34%), radial-gradient(circle at bottom right, rgba(96,165,250,0.18) 0, transparent 38%), radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
							backgroundPosition: "0 0, 100% 100%, 0 0",
							backgroundSize: "auto, auto, 10px 10px",
						}}
					/>

					<input
						ref={avatarInputRef}
						type="file"
						accept={AVATAR_FILE_ACCEPT}
						className="hidden"
						data-testid="magi-claw-create-dialog-avatar-file-input"
						onChange={(e) => void handleAvatarFileChange(e)}
					/>

					<div className="relative flex flex-col gap-6 p-4 md:p-6">
						<DialogClose asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="absolute right-3 top-3 z-10 h-4 w-4 rounded-xs p-0 text-muted-foreground opacity-70 hover:bg-transparent hover:text-foreground hover:opacity-100 dark:text-muted-foreground dark:hover:bg-transparent dark:hover:text-foreground"
								data-testid="magi-claw-create-dialog-close-button"
								disabled={isBusy}
							>
								<X className="size-4" />
							</Button>
						</DialogClose>

						<div className="flex w-full items-center gap-3 pr-6 md:gap-3.5 md:pr-8">
							<div className="flex min-w-0 items-center gap-3 md:gap-3.5">
								<MagiClawTemplateAvatar
									templateCode={selectedTemplate.templateCode}
									className="size-12 shrink-0 rounded-full border border-border shadow-sm dark:border-white/10 dark:shadow-black/30 md:size-16"
								/>

								<div className="flex min-w-0 flex-col gap-1">
									<div className="flex flex-wrap items-center gap-1 md:gap-2">
										<DialogTitle className="text-2xl font-medium leading-8 text-foreground">
											{t("superLobster.createDialog.title")}
										</DialogTitle>
										<div className="flex items-center gap-0.5 font-poppins text-2xl leading-8 tracking-[-0.48px] text-foreground">
											<span className="font-semibold">
												{t("superLobster.heroLead", clawBrandValues)}
											</span>
											<span className="font-black text-[#EF4444]">
												{t("superLobster.titleAccent", clawBrandValues)}
											</span>
										</div>
									</div>
									<DialogDescription className="text-sm leading-none text-muted-foreground">
										{t("superLobster.createDialog.subtitle", clawBrandValues)}
									</DialogDescription>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-2">
								<p className="text-sm font-medium leading-none text-foreground">
									{t("superLobster.createDialog.templateLabel")}
								</p>
								<div className="flex flex-col gap-2">
									{MAGI_CLAW_TEMPLATE_OPTIONS.map((template) => {
										const isSelected =
											template.templateCode === selectedTemplate.templateCode
										return (
											<button
												key={template.templateCode}
												type="button"
												className={cn(
													"flex w-full items-center gap-3 rounded-[10px] border bg-background/90 px-3 py-2 text-left shadow-sm transition-colors dark:bg-card/80 dark:shadow-black/20",
													isSelected
														? "border-foreground dark:border-primary"
														: "border-border hover:border-foreground/30 dark:border-white/10 dark:hover:border-white/25",
													isBusy && "cursor-not-allowed opacity-70",
												)}
												data-testid={`magi-claw-create-dialog-template-${template.templateCode}`}
												disabled={isBusy}
												onClick={() =>
													handleTemplateChange(template.templateCode)
												}
											>
												<span
													className={cn(
														"flex size-4 shrink-0 items-center justify-center rounded-full border",
														isSelected
															? "border-primary bg-primary text-primary-foreground"
															: "border-input bg-background text-transparent",
													)}
													aria-hidden
												>
													<Circle className="size-2.5 fill-current stroke-current" />
												</span>
												<MagiClawTemplateAvatar
													templateCode={template.templateCode}
													className="size-12 shrink-0 rounded-full border-2 border-white shadow-sm dark:border-white/10 dark:shadow-black/30"
												/>
												<div className="min-w-0 flex-1">
													<p className="text-sm font-medium leading-none text-foreground">
														{t(template.titleKey, clawBrandValues)}
													</p>
													<p className="mt-1 text-xs leading-4 text-muted-foreground">
														{t(
															template.descriptionKey,
															clawBrandValues,
														)}
													</p>
												</div>
											</button>
										)
									})}
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<p className="text-sm font-medium leading-none text-foreground">
									{t("superLobster.createDialog.basicInformationLabel")}
								</p>
								<div className="relative rounded-lg border border-border bg-white/60 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/20 dark:shadow-black/25">
									<div
										className="pointer-events-none absolute inset-0 opacity-40 dark:hidden"
										aria-hidden
										style={{
											backgroundImage:
												"radial-gradient(rgba(239,68,68,0.07) 1px, transparent 1px)",
											backgroundSize: "8px 8px",
										}}
									/>
									<div
										className="pointer-events-none absolute inset-0 hidden opacity-60 dark:block"
										aria-hidden
										style={{
											backgroundImage:
												"radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
											backgroundSize: "10px 10px",
										}}
									/>
									<div className="relative flex flex-col gap-5">
										<div className="flex items-center justify-between gap-3">
											<p className="text-sm font-medium leading-none text-foreground">
												{t("superLobster.createDialog.avatarLabel")}
											</p>
											<div className="flex items-center gap-3">
												<div className="relative">
													<MagiClawTemplateAvatar
														templateCode={selectedTemplate.templateCode}
														src={customAvatarUrl}
														className="size-16 shrink-0 rounded-md border border-border shadow-xs dark:border-white/10 dark:shadow-black/25"
													/>
													{isAvatarUploading ? (
														<span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 dark:bg-black/55">
															<Loader2 className="size-5 animate-spin text-foreground" />
														</span>
													) : null}
													{customAvatarUrl && !isAvatarUploading ? (
														<Button
															type="button"
															variant="outline"
															size="icon"
															className="absolute -right-2 -top-2 z-10 size-6 rounded-full border-input bg-background shadow-xs hover:bg-accent dark:border-white/10 dark:bg-card dark:hover:bg-white/10"
															aria-label={t(
																"superLobster.createDialog.removeUploadedAvatar",
																clawBrandValues,
															)}
															data-testid="magi-claw-create-dialog-remove-avatar-button"
															disabled={isBusy}
															onClick={(event) => {
																event.stopPropagation()
																setCustomAvatarUrl(null)
															}}
														>
															<Trash2 className="size-3.5 text-foreground" />
														</Button>
													) : null}
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-9 gap-2 rounded-md px-3 text-xs font-medium shadow-xs dark:border-white/10 dark:bg-card/80 dark:hover:bg-white/10"
													data-testid="magi-claw-create-dialog-upload-button"
													disabled={isBusy}
													onClick={handleUploadAreaClick}
												>
													<Upload className="size-4" strokeWidth={1.75} />
													{t("superLobster.createDialog.uploadButton")}
												</Button>
											</div>
										</div>

										<div className="flex items-center justify-between gap-3">
											<label
												className="shrink-0 text-sm font-medium leading-none text-foreground"
												htmlFor="magi-claw-name-input"
											>
												{t("superLobster.createDialog.nameLabel")}
											</label>
											<div className="w-full max-w-[320px]">
												<Input
													id="magi-claw-name-input"
													value={name}
													className="h-9 bg-background shadow-xs dark:border-white/10 dark:bg-card/80 dark:placeholder:text-muted-foreground/80"
													placeholder={t(
														"superLobster.createDialog.namePlaceholder",
														clawBrandValues,
													)}
													data-testid="magi-claw-create-dialog-name-input"
													disabled={isBusy}
													onChange={(event) => {
														const nextName = event.target.value
														setName(nextName)
														setIsNameCustomized(
															nextName !==
																getTemplateDefaultName(
																	selectedTemplate,
																),
														)
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter" && !isBusy) {
															event.preventDefault()
															handleCreate()
														}
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="relative p-3">
						<Button
							type="button"
							className="h-9 w-full rounded-md text-sm font-medium shadow-xs"
							data-testid="magi-claw-create-dialog-submit-button"
							disabled={!name.trim() || isBusy}
							aria-busy={isSubmitting}
							onClick={handleCreate}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									{t("superLobster.createDialog.submitting", clawBrandValues)}
								</>
							) : (
								t("superLobster.createDialog.submitButton", clawBrandValues)
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
