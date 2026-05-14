import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Check, Loader2, Trash2, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawItem } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { Input } from "@/components/shadcn-ui/input"
import { useUpload } from "@/hooks/useUploadFiles"
import { cn } from "@/lib/utils"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { MagiClawTemplateAvatar } from "./MagiClawTemplateAvatar"
import type { MagiClawEditPayload } from "./useMagiClawMobilePage"

const AVATAR_FILE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"

interface MagiClawEditDialogProps {
	open: boolean
	claw: MagicClawItem | null
	isSubmitting?: boolean
	onOpenChange: (open: boolean) => void
	onSubmit: (payload: MagiClawEditPayload) => void
}

/**
 * MagiClawEditDialog 为“编辑信息”提供真实落点，避免菜单动作成为占位。
 */
export function MagiClawEditDialog({
	open,
	claw,
	isSubmitting = false,
	onOpenChange,
	onSubmit,
}: MagiClawEditDialogProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const [name, setName] = useState("")
	const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
	const [isAvatarUploading, setIsAvatarUploading] = useState(false)
	const { uploadAndGetFileUrl } = useUpload({ storageType: "public" })

	const isBusy = isSubmitting || isAvatarUploading
	const displayName =
		claw?.name?.trim() || t("superLobster.workspace.untitledProject", clawBrandValues)

	useEffect(() => {
		if (!open || !claw) return

		setName(claw.name ?? "")
		setCustomAvatarUrl(claw.icon_file_url ?? null)
		setIsAvatarUploading(false)
	}, [claw, open])

	/**
	 * 关闭时清空本地表单状态，避免下次打开沿用上次编辑中的临时值。
	 */
	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(nextOpen)
		if (!nextOpen) {
			setName("")
			setCustomAvatarUrl(null)
			setIsAvatarUploading(false)
		}
	}

	/**
	 * 上传头像后只保存 URL，由真正的更新动作统一提交到后端。
	 */
	async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]
		event.target.value = ""
		if (!file || isBusy) return

		setIsAvatarUploading(true)
		try {
			const { fullfilled } = await uploadAndGetFileUrl([
				{ name: file.name, file, status: "init" },
			])
			const nextUrl = fullfilled[0]?.value?.url
			if (!nextUrl) {
				magicToast.error(t("superLobster.editDialog.uploadAvatarFailed", clawBrandValues))
				return
			}

			setCustomAvatarUrl(nextUrl)
		} catch {
			magicToast.error(t("superLobster.editDialog.uploadAvatarFailed", clawBrandValues))
		} finally {
			setIsAvatarUploading(false)
		}
	}

	/**
	 * 保存前统一裁剪名称并传递头像结果，保持调用方只处理业务提交。
	 */
	function handleSubmit() {
		if (!claw || isBusy) return

		const trimmedName = name.trim()
		if (!trimmedName) return

		onSubmit({
			name: trimmedName,
			icon: customAvatarUrl,
		})
	}

	/**
	 * 上传按钮只负责打开原生文件选择器，避免把业务逻辑散在点击事件里。
	 */
	function handleUploadClick() {
		if (isBusy) return
		avatarInputRef.current?.click()
	}

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="magi-claw-edit-dialog"
			>
				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted">
					<div
						className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,rgba(0,0,0,0.032)_1px,transparent_1px)] bg-[length:14px_14px] opacity-70 dark:bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)]"
						aria-hidden
					/>
					<input
						ref={avatarInputRef}
						type="file"
						accept={AVATAR_FILE_ACCEPT}
						className="hidden"
						data-testid="magi-claw-edit-dialog-avatar-file-input"
						onChange={(event) => void handleAvatarFileChange(event)}
					/>

					<div className="relative z-10 flex w-full shrink-0 flex-col items-center py-[6px]">
						<div className="h-1 w-20 rounded-full bg-muted-foreground/40" aria-hidden />
					</div>

					<div className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
						<button
							type="button"
							onClick={() => handleOpenChange(false)}
							className="absolute left-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70"
							aria-label={t("common.cancel")}
							data-testid="magi-claw-edit-dialog-close-button"
						>
							<X className="size-[22px] text-foreground" />
						</button>
						<SheetTitle className="max-w-[247px] truncate text-center font-poppins text-[18px] font-medium leading-6 text-foreground">
							{t("superLobster.editDialog.title", clawBrandValues)}
						</SheetTitle>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={!name.trim() || isBusy}
							className="absolute right-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70 disabled:opacity-40"
							aria-label={t("superLobster.editDialog.submitButton", clawBrandValues)}
							data-testid="magi-claw-edit-dialog-submit-icon-button"
						>
							{isSubmitting ? (
								<Loader2 className="size-[22px] animate-spin text-primary-foreground" />
							) : (
								<Check
									className="size-[22px] text-primary-foreground"
									strokeWidth={2.5}
								/>
							)}
						</button>
					</div>

					<div
						className="relative z-10 flex flex-col gap-2 overflow-y-auto px-[14px] py-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						style={{ paddingBottom: "calc(var(--safe-area-inset-bottom) + 8px)" }}
						data-testid="magi-claw-edit-dialog-scroll-content"
					>
						<p
							className="px-0.5 text-[14px] leading-5 text-muted-foreground"
							data-testid="magi-claw-edit-dialog-description"
						>
							{t("superLobster.editDialog.description", {
								...clawBrandValues,
								name: displayName,
							})}
						</p>

						<div
							className="overflow-hidden rounded-2xl border border-white/60 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-white/10"
							data-testid="magi-claw-edit-dialog-basic-info-card"
						>
							<div
								className="flex h-[68px] items-center gap-3 px-[14px]"
								data-testid="magi-claw-edit-dialog-avatar-row"
							>
								<p className="flex-1 text-[16px] text-muted-foreground">
									{t("superLobster.editDialog.avatarLabel")}
								</p>
								<div className="flex shrink-0 items-center gap-2.5">
									<div className="relative">
										<MagiClawTemplateAvatar
											templateCode={claw?.template_code}
											src={customAvatarUrl ?? claw?.icon_file_url}
											className="h-10 w-10 rounded-full border border-border"
										/>
										{isAvatarUploading ? (
											<span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80 dark:bg-black/55">
												<Loader2 className="h-4 w-4 animate-spin text-foreground" />
											</span>
										) : null}
										{customAvatarUrl ? (
											<Button
												type="button"
												variant="outline"
												size="icon"
												className="absolute -right-2 -top-2 z-10 h-6 w-6 rounded-full border-input bg-background shadow-xs hover:bg-accent"
												aria-label={t(
													"superLobster.editDialog.removeAvatar",
													clawBrandValues,
												)}
												data-testid="magi-claw-edit-dialog-remove-avatar-button"
												disabled={isBusy}
												onClick={(event) => {
													event.stopPropagation()
													setCustomAvatarUrl(null)
												}}
											>
												<Trash2 className="h-3.5 w-3.5 text-foreground" />
											</Button>
										) : null}
									</div>
									<button
										type="button"
										onClick={handleUploadClick}
										className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-transparent px-3 transition-opacity active:opacity-60"
										data-testid="magi-claw-edit-dialog-upload-button"
										disabled={isBusy}
									>
										<Upload
											className="h-3.5 w-3.5 text-foreground"
											strokeWidth={2}
										/>
										<span className="text-[13px] font-medium leading-none text-foreground">
											{t("superLobster.editDialog.uploadButton")}
										</span>
									</button>
								</div>
							</div>

							<div className="mx-[14px] h-px bg-border" />

							<div
								className="flex min-h-[68px] items-center gap-3 px-[14px] py-1"
								data-testid="magi-claw-edit-dialog-name-row"
							>
								<label
									className="shrink-0 text-[16px] text-muted-foreground"
									htmlFor="magi-claw-edit-name-input"
								>
									{t("superLobster.editDialog.nameLabel")}
								</label>
								<Input
									id="magi-claw-edit-name-input"
									value={name}
									className={cn(
										"h-12 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-right text-[16px] text-foreground shadow-none focus-visible:ring-0",
										"dark:bg-transparent dark:placeholder:text-muted-foreground/80",
									)}
									placeholder={t(
										"superLobster.editDialog.namePlaceholder",
										clawBrandValues,
									)}
									data-testid="magi-claw-edit-dialog-name-input"
									disabled={isBusy}
									onChange={(event) => setName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key !== "Enter" || isBusy) return
										event.preventDefault()
										handleSubmit()
									}}
								/>
							</div>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
