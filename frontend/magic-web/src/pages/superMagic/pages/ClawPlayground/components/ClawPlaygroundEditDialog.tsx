import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Loader2, Trash2, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MagicClawApi, type MagicClawItem } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { useUpload } from "@/hooks/useUploadFiles"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { MagiClawTemplateAvatar } from "../../MagiClawPage/MagiClawTemplateAvatar"

const AVATAR_FILE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"

interface ClawPlaygroundEditDialogProps {
	open: boolean
	claw: MagicClawItem | null
	onOpenChange: (open: boolean) => void
	onUpdated: (claw: MagicClawItem) => void
}

export function ClawPlaygroundEditDialog({
	open,
	claw,
	onOpenChange,
	onUpdated,
}: ClawPlaygroundEditDialogProps) {
	const { t } = useTranslation(["sidebar", "super"])
	const clawBrandValues = getClawBrandTranslationValues()
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const [name, setName] = useState("")
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
	const [isAvatarUploading, setIsAvatarUploading] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const { uploadAndGetFileUrl } = useUpload({ storageType: "public" })

	useEffect(() => {
		if (!open || !claw) return
		setName(claw.name || "")
		setAvatarUrl(claw.icon_file_url || null)
		setIsAvatarUploading(false)
		setIsSubmitting(false)
	}, [claw, open])

	const isBusy = isAvatarUploading || isSubmitting
	const displayName = claw?.name || t("superLobster.workspace.untitledProject", clawBrandValues)

	function handleOpenChange(nextOpen: boolean) {
		if (isBusy) return
		onOpenChange(nextOpen)
	}

	function handleUploadClick() {
		if (isBusy) return
		avatarInputRef.current?.click()
	}

	async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]
		event.target.value = ""
		if (!file || isBusy) return

		setIsAvatarUploading(true)
		try {
			const { fullfilled } = await uploadAndGetFileUrl([
				{ name: file.name, file, status: "init" },
			])
			const nextAvatarUrl = fullfilled[0]?.value?.url
			if (!nextAvatarUrl) {
				toast.error(t("superLobster.editDialog.uploadAvatarFailed", clawBrandValues))
				return
			}
			setAvatarUrl(nextAvatarUrl)
		} catch {
			toast.error(t("superLobster.editDialog.uploadAvatarFailed", clawBrandValues))
		} finally {
			setIsAvatarUploading(false)
		}
	}

	async function handleSubmit() {
		if (!claw?.code || isBusy) return

		const trimmedName = name.trim()
		if (!trimmedName) return

		setIsSubmitting(true)
		try {
			const updatedClaw = await MagicClawApi.updateMagicClaw({
				code: claw.code,
				name: trimmedName,
				icon: avatarUrl,
			})
			onUpdated(updatedClaw)
			onOpenChange(false)
			toast.success(t("superLobster.editDialog.updateSuccess", clawBrandValues))
		} catch {
			toast.error(t("superLobster.editDialog.updateFailed", clawBrandValues))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-full max-w-[min(480px,calc(100vw-2rem))] gap-0 p-0"
				data-testid="claw-playground-edit-dialog"
			>
				<input
					ref={avatarInputRef}
					type="file"
					accept={AVATAR_FILE_ACCEPT}
					className="hidden"
					data-testid="claw-playground-edit-dialog-avatar-input"
					onChange={(event) => void handleAvatarChange(event)}
				/>

				<div className="flex flex-col gap-5 p-5">
					<DialogHeader className="text-left">
						<DialogTitle className="text-base">
							{t("superLobster.editDialog.title", clawBrandValues)}
						</DialogTitle>
						<DialogDescription>
							{t("superLobster.editDialog.description", {
								...clawBrandValues,
								name: displayName,
							})}
						</DialogDescription>
					</DialogHeader>

					<div
						className="flex flex-col gap-4"
						data-testid="claw-playground-edit-dialog-form"
					>
						<div className="flex items-start justify-between gap-4">
							<div className="flex flex-col gap-1">
								<p className="text-sm font-medium text-foreground">
									{t("superLobster.editDialog.avatarLabel")}
								</p>
								<p className="text-xs text-muted-foreground">
									{t("superLobster.editDialog.avatarHint")}
								</p>
							</div>

							<div className="flex items-center gap-3">
								<div className="relative">
									<MagiClawTemplateAvatar
										templateCode={claw?.template_code}
										src={avatarUrl}
										className="size-16 shrink-0 rounded-md border border-border shadow-xs"
										imageClassName={
											isAvatarUploading ? "opacity-50" : undefined
										}
									/>
									{isAvatarUploading ? (
										<span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80">
											<Loader2 className="size-4 animate-spin text-foreground" />
										</span>
									) : null}
									{avatarUrl && !isAvatarUploading ? (
										<Button
											type="button"
											variant="outline"
											size="icon"
											className="absolute -right-2 -top-2 size-6 rounded-full bg-background shadow-xs"
											data-testid="claw-playground-edit-dialog-remove-avatar-button"
											aria-label={t(
												"superLobster.editDialog.removeAvatar",
												clawBrandValues,
											)}
											disabled={isBusy}
											onClick={() => setAvatarUrl(null)}
										>
											<Trash2 className="size-3.5" />
										</Button>
									) : null}
								</div>

								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-9 gap-2"
									data-testid="claw-playground-edit-dialog-upload-button"
									disabled={isBusy}
									onClick={handleUploadClick}
								>
									<Upload className="size-4" />
									{t("superLobster.editDialog.uploadButton")}
								</Button>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<label
								htmlFor="claw-playground-edit-dialog-name-input"
								className="text-sm font-medium text-foreground"
							>
								{t("superLobster.editDialog.nameLabel")}
							</label>
							<Input
								id="claw-playground-edit-dialog-name-input"
								value={name}
								className="h-10"
								placeholder={t(
									"superLobster.editDialog.namePlaceholder",
									clawBrandValues,
								)}
								data-testid="claw-playground-edit-dialog-name-input"
								disabled={isBusy}
								onChange={(event) => setName(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault()
										void handleSubmit()
									}
								}}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							data-testid="claw-playground-edit-dialog-cancel-button"
							disabled={isBusy}
							onClick={() => onOpenChange(false)}
						>
							{t("common.cancel", { ns: "super" })}
						</Button>
						<Button
							type="button"
							data-testid="claw-playground-edit-dialog-submit-button"
							disabled={!name.trim() || isBusy}
							onClick={() => void handleSubmit()}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									{t("superLobster.editDialog.submitting", clawBrandValues)}
								</>
							) : (
								t("superLobster.editDialog.submitButton", clawBrandValues)
							)}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	)
}
