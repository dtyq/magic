import { useRef, useState, type ChangeEvent } from "react"
import { Check, Loader2, Trash2, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import avatarHighlight from "@/assets/resources/magi-claw/card-avatar-highlight.svg"
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

const AVATAR_FILE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"

interface MagiClawCreateDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** icon = public file URL after upload to public bucket */
	onCreate: (name: string, icon?: string | null) => void
	isSubmitting?: boolean
}

// Preset tiles reuse one SVG on tinted backgrounds until more assets exist.
const MAGI_CLAW_PRESET_AVATARS: { id: string; backgroundClass: string }[] = [
	{ id: "rose", backgroundClass: "bg-[#FFE1E1]" },
	{ id: "peach", backgroundClass: "bg-[#FFD8B2]" },
	{ id: "lavender", backgroundClass: "bg-[#E1D9FF]" },
	{ id: "mint", backgroundClass: "bg-[#C7EDF0]" },
	{ id: "orchid", backgroundClass: "bg-[#F1CCF7]" },
]

export function MagiClawCreateDialog({
	open,
	onOpenChange,
	onCreate,
	isSubmitting = false,
}: MagiClawCreateDialogProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const [name, setName] = useState("")
	const [selectedPresetId, setSelectedPresetId] = useState(MAGI_CLAW_PRESET_AVATARS[0].id)
	const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
	const [isAvatarUploading, setIsAvatarUploading] = useState(false)

	const { uploadAndGetFileUrl } = useUpload({ storageType: "public" })

	const isBusy = isSubmitting || isAvatarUploading

	function handleCreate() {
		const trimmedName = name.trim()
		if (!trimmedName || isBusy) return
		onCreate(trimmedName, customAvatarUrl ?? undefined)
	}

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(nextOpen)
		if (!nextOpen) {
			setName("")
			setSelectedPresetId(MAGI_CLAW_PRESET_AVATARS[0].id)
			setCustomAvatarUrl(null)
			setIsAvatarUploading(false)
		}
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
				className="w-full max-w-[min(347px,calc(100vw-2rem))] gap-0 overflow-hidden border-none p-0 shadow-2xl md:max-w-[512px]"
				data-testid="magi-claw-create-dialog"
			>
				<div className="relative overflow-hidden rounded-[10px] bg-[linear-gradient(98deg,#FFF7F7_5.16%,#FFF_49.33%,#EEF5FF_93.49%)]">
					<div
						className="pointer-events-none absolute inset-0 opacity-70"
						style={{
							backgroundImage:
								"radial-gradient(circle at top left, rgba(248,113,113,0.14) 0, transparent 36%), radial-gradient(circle at bottom right, rgba(96,165,250,0.16) 0, transparent 40%), radial-gradient(rgba(239,68,68,0.08) 1px, transparent 1px)",
							backgroundPosition: "0 0, 100% 100%, 0 0",
							backgroundSize: "auto, auto, 8px 8px",
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

					<div className="relative flex flex-col gap-4 p-4 md:gap-6 md:p-6">
						<DialogClose asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="absolute right-3 top-3 z-10 rounded-md text-muted-foreground opacity-70 hover:bg-accent hover:opacity-100"
								data-testid="magi-claw-create-dialog-close-button"
								disabled={isBusy}
							>
								<X className="size-4" />
							</Button>
						</DialogClose>

						<div className="flex w-full items-center gap-2 pr-10 md:gap-3.5 md:pr-12">
							<div className="flex min-w-0 items-center gap-2 md:gap-3.5">
								<div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background md:size-16">
									<img
										alt=""
										aria-hidden
										className="pointer-events-none size-full object-cover"
										src={avatarHighlight}
									/>
								</div>

								<div className="flex min-w-0 flex-col gap-1">
									<div className="flex flex-wrap items-center gap-1 md:gap-2">
										<DialogTitle className="text-lg font-medium leading-7 text-foreground md:text-2xl md:leading-8">
											{t("superLobster.createDialog.title")}
										</DialogTitle>
										<div className="flex items-center gap-0.5 font-poppins text-lg leading-7 tracking-[-0.36px] text-foreground md:text-2xl md:leading-8 md:tracking-[-0.48px]">
											<span className="font-semibold">
												{t("superLobster.heroLead", clawBrandValues)}
											</span>
											<span className="font-black text-[#EF4444]">
												{t("superLobster.titleAccent", clawBrandValues)}
											</span>
										</div>
									</div>
									<DialogDescription className="text-xs leading-4 text-muted-foreground md:text-sm md:leading-none">
										{t("superLobster.createDialog.subtitle", clawBrandValues)}
									</DialogDescription>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-2 md:gap-2">
								<label
									className="text-sm font-medium leading-none text-foreground"
									htmlFor="magi-claw-name-input"
								>
									{t("superLobster.createDialog.nameLabel")}
								</label>
								<Input
									id="magi-claw-name-input"
									value={name}
									className="h-9 bg-background shadow-xs"
									placeholder={t(
										"superLobster.createDialog.namePlaceholder",
										clawBrandValues,
									)}
									data-testid="magi-claw-create-dialog-name-input"
									disabled={isBusy}
									onChange={(event) => setName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !isBusy) {
											event.preventDefault()
											handleCreate()
										}
									}}
								/>
							</div>

							<div className="flex flex-col gap-2 md:gap-2">
								<p className="text-sm font-medium leading-none text-foreground">
									{t("superLobster.createDialog.avatarLabel")}
								</p>
								<div className="flex items-center gap-5 md:items-center">
									<div className="relative shrink-0">
										<button
											type="button"
											className={cn(
												"relative flex size-10 items-center justify-center overflow-hidden rounded-md border border-input bg-background shadow-xs transition-colors hover:bg-accent md:size-16",
												!isBusy && "cursor-pointer",
											)}
											data-testid="magi-claw-create-dialog-upload-button"
											disabled={isBusy}
											onClick={handleUploadAreaClick}
										>
											{customAvatarUrl ? (
												<img
													alt=""
													className="size-full object-cover"
													src={customAvatarUrl}
												/>
											) : null}
											{isAvatarUploading ? (
												<span className="absolute inset-0 flex items-center justify-center bg-background/80">
													<Loader2 className="size-5 animate-spin text-foreground md:size-6" />
												</span>
											) : null}
											{!customAvatarUrl && !isAvatarUploading ? (
												<Upload
													className="size-5 text-foreground md:size-6"
													strokeWidth={1.75}
												/>
											) : null}
										</button>
										{customAvatarUrl && !isAvatarUploading ? (
											<Button
												type="button"
												variant="outline"
												size="icon"
												className="absolute -right-2 -top-2 z-10 size-7 rounded-full border-input bg-background shadow-xs hover:bg-accent"
												aria-label={t(
													"superLobster.createDialog.removeUploadedAvatar",
													clawBrandValues,
												)}
												data-testid="magi-claw-create-dialog-remove-avatar-button"
												disabled={isSubmitting}
												onClick={(event) => {
													event.stopPropagation()
													setCustomAvatarUrl(null)
												}}
											>
												<Trash2
													className="size-4 text-foreground"
													strokeWidth={1.75}
												/>
											</Button>
										) : null}
									</div>

									<div
										className="h-5 w-px shrink-0 self-center bg-border md:h-8"
										aria-hidden
										data-testid="magi-claw-create-dialog-avatar-separator"
									/>

									<div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:pb-0 [&::-webkit-scrollbar]:hidden">
										{MAGI_CLAW_PRESET_AVATARS.map((preset) => {
											const isSelected =
												!customAvatarUrl && preset.id === selectedPresetId
											return (
												<button
													key={preset.id}
													type="button"
													className={cn(
														"relative size-10 shrink-0 overflow-hidden rounded-md md:size-16",
														isSelected
															? "border-2 border-foreground-indigo shadow-xs"
															: "border-2 border-transparent",
													)}
													data-testid={`magi-claw-create-dialog-preset-${preset.id}`}
													disabled={isBusy}
													onClick={() => {
														setCustomAvatarUrl(null)
														setSelectedPresetId(preset.id)
													}}
												>
													<div
														className={cn(
															"absolute inset-0",
															preset.backgroundClass,
														)}
													/>
													<img
														alt=""
														aria-hidden
														className="pointer-events-none relative z-0 h-full w-full object-contain p-0.5"
														src={avatarHighlight}
													/>
													{isSelected ? (
														<span className="absolute bottom-0 right-0 z-10 flex size-5 items-center justify-center rounded-tl-md bg-foreground-indigo shadow-xs">
															<Check
																className="size-3 text-primary-foreground"
																strokeWidth={2.5}
															/>
														</span>
													) : null}
												</button>
											)
										})}
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
								t("superLobster.created.create", clawBrandValues)
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
