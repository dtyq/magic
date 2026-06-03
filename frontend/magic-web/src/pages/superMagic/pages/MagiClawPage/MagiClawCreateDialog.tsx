import { useMemo, useRef, useState, type ChangeEvent } from "react"
import { Check, Circle, Loader2, Trash2, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawTemplateCode } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
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

/**
 * MagiClawCreateDialog 负责以原型中的底部 Sheet 形态承载创建表单。
 */
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

	/**
	 * 根据模板统一产出默认名称，避免模板切换时散落重复翻译逻辑。
	 */
	function getTemplateDefaultName(template: MagiClawTemplateOption) {
		return t(template.defaultNameKey, clawBrandValues)
	}

	/**
	 * 创建前统一裁剪输入并拼装 payload，保证提交口只接收最终值。
	 */
	function handleCreate() {
		const trimmedName = name.trim()
		if (!trimmedName || isBusy) return
		onCreate({
			name: trimmedName,
			icon: customAvatarUrl ?? undefined,
			template_code: selectedTemplate.templateCode,
		})
	}

	/**
	 * 关闭 Sheet 时重置临时表单状态，避免下次打开仍停留在上次编辑结果。
	 */
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

	/**
	 * 切换模板时同步默认名称，但尊重用户已经手动修改过的输入。
	 */
	function handleTemplateChange(templateCode: MagicClawTemplateCode) {
		const nextTemplate =
			MAGI_CLAW_TEMPLATE_OPTIONS.find((template) => template.templateCode === templateCode) ??
			DEFAULT_TEMPLATE

		setSelectedTemplateCode(nextTemplate.templateCode)
		if (!isNameCustomized) setName(getTemplateDefaultName(nextTemplate))
	}

	/**
	 * 上传按钮只负责打开原生文件选择器，让上传逻辑集中在文件 change 事件里。
	 */
	function handleUploadAreaClick() {
		if (isBusy) return
		avatarInputRef.current?.click()
	}

	/**
	 * 上传头像后仅缓存 URL，真正的创建动作仍由顶部确认按钮统一触发。
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
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-auto max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 p-0 !pb-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="magi-claw-create-dialog"
			>
				<div className="relative flex max-h-[88dvh] flex-col overflow-hidden bg-background bg-[linear-gradient(155deg,rgba(255,232,220,0.8)_0%,#ffffff_30%)] pb-[max(var(--safe-area-inset-bottom),12px)] dark:bg-card dark:bg-[linear-gradient(155deg,rgba(96,46,18,0.55)_0%,var(--color-card)_38%)]">
					<div
						className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,rgba(0,0,0,0.038)_1px,transparent_1px)] bg-[length:14px_14px] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)]"
						aria-hidden
					/>

					<div className="relative z-10 flex w-full shrink-0 flex-col items-center py-[6px]">
						<div className="h-1 w-20 rounded-full bg-foreground/20" aria-hidden />
					</div>

					<div className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
						<button
							type="button"
							onClick={() => handleOpenChange(false)}
							className="absolute left-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70"
							aria-label={t("common.cancel")}
							data-testid="magi-claw-create-dialog-close-button"
						>
							<X className="size-[22px] text-foreground" />
						</button>

						<SheetTitle className="font-poppins text-[18px] font-medium leading-6 text-foreground">
							{t("superLobster.createDialog.title")}
						</SheetTitle>

						<button
							type="button"
							onClick={handleCreate}
							disabled={!name.trim() || isBusy}
							className="absolute right-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70 disabled:opacity-40"
							aria-label={t(
								"superLobster.createDialog.submitButton",
								clawBrandValues,
							)}
							data-testid="magi-claw-create-dialog-submit-icon-button"
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

					<input
						ref={avatarInputRef}
						type="file"
						accept={AVATAR_FILE_ACCEPT}
						className="hidden"
						data-testid="magi-claw-create-dialog-avatar-file-input"
						onChange={(e) => void handleAvatarFileChange(e)}
					/>

					<div
						className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						data-testid="magi-claw-create-dialog-scroll-content"
					>
						<div className="relative z-10 flex flex-col gap-[18px] pt-3">
							<div
								className="flex flex-col items-center gap-2 pb-1"
								data-testid="magi-claw-create-dialog-hero"
							>
								<MagiClawTemplateAvatar
									templateCode={selectedTemplate.templateCode}
									className="h-20 w-20 rounded-full border-[3px] border-white shadow-[0_4px_20px_rgba(0,0,0,0.12)] dark:border-white/15"
								/>
								<p className="px-6 text-center font-poppins text-[12px] leading-4 text-muted-foreground">
									{t("superLobster.createDialog.subtitle", clawBrandValues)}
								</p>
							</div>

							<div className="flex flex-col gap-2.5">
								<div
									className="flex flex-col gap-2"
									data-testid="magi-claw-create-dialog-template-section"
								>
									<p className="px-0.5 text-[14px] font-semibold text-foreground">
										{t("superLobster.createDialog.templateLabel")}
									</p>
									<div className="flex flex-col gap-2">
										{MAGI_CLAW_TEMPLATE_OPTIONS.map((template) => {
											const isSelected =
												template.templateCode ===
												selectedTemplate.templateCode
											return (
												<button
													key={template.templateCode}
													type="button"
													className={cn(
														"flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all active:opacity-75",
														"bg-white/80 shadow-[0_1px_6px_rgba(0,0,0,0.05)] dark:bg-white/[0.06]",
														isSelected
															? "border-foreground/75 shadow-[0_2px_14px_rgba(0,0,0,0.10)]"
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
															"flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
															isSelected
																? "border-foreground bg-foreground"
																: "border-muted-foreground/35 bg-transparent text-transparent",
														)}
														aria-hidden
													>
														<Circle
															className={cn(
																"size-[7px] fill-current stroke-current",
																isSelected && "text-background",
															)}
														/>
													</span>
													<MagiClawTemplateAvatar
														templateCode={template.templateCode}
														className="size-10 shrink-0 rounded-full border border-border/60"
													/>
													<div className="min-w-0 flex-1">
														<p className="text-[15px] font-semibold leading-snug text-foreground">
															{t(template.titleKey, clawBrandValues)}
														</p>
														<p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
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

								<div
									className="flex flex-col gap-2"
									data-testid="magi-claw-create-dialog-basic-info-section"
								>
									<p className="px-0.5 text-[14px] font-semibold text-foreground">
										{t("superLobster.createDialog.basicInformationLabel")}
									</p>
									<div
										className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-white/[0.06]"
										data-testid="magi-claw-create-dialog-basic-info-card"
									>
										<div
											className="flex h-[68px] items-center gap-3 px-[14px]"
											data-testid="magi-claw-create-dialog-avatar-row"
										>
											<p className="flex-1 text-[16px] text-muted-foreground">
												{t("superLobster.createDialog.avatarLabel")}
											</p>
											<div className="flex shrink-0 items-center gap-2.5">
												<div className="relative">
													<MagiClawTemplateAvatar
														templateCode={selectedTemplate.templateCode}
														src={customAvatarUrl}
														className="size-10 rounded-full border border-border/60"
													/>
													{isAvatarUploading ? (
														<span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
															<Loader2 className="size-4 animate-spin text-foreground" />
														</span>
													) : null}
													{customAvatarUrl && !isAvatarUploading ? (
														<Button
															type="button"
															variant="outline"
															size="icon"
															className="absolute -right-2 -top-2 z-10 size-6 rounded-full border-input bg-background shadow-xs hover:bg-accent"
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
												<button
													type="button"
													className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-transparent px-3 transition-opacity active:opacity-60"
													data-testid="magi-claw-create-dialog-upload-button"
													disabled={isBusy}
													onClick={handleUploadAreaClick}
												>
													<Upload
														className="size-3.5 text-foreground"
														strokeWidth={2}
													/>
													<span className="text-[13px] font-medium leading-none text-foreground">
														{t(
															"superLobster.createDialog.uploadButton",
														)}
													</span>
												</button>
											</div>
										</div>

										<div className="mx-[14px] h-px bg-border/50" />

										<div
											className="flex min-h-[68px] items-center gap-3 px-[14px] py-1"
											data-testid="magi-claw-create-dialog-name-row"
										>
											<label
												className="shrink-0 text-[16px] text-muted-foreground"
												htmlFor="magi-claw-name-input"
											>
												{t("superLobster.createDialog.nameLabel")}
											</label>
											<Input
												id="magi-claw-name-input"
												value={name}
												className="h-12 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-right text-[16px] text-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
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
													if (event.key !== "Enter" || isBusy) return
													event.preventDefault()
													handleCreate()
												}}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
