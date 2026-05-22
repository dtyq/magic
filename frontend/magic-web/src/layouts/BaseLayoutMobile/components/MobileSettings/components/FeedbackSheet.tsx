import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import { Check, ChevronRight, ImagePlus, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { useUserInfo } from "@/models/user/hooks"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import {
	submitMobileSettingsFeedback,
	type MobileSettingsFeedbackUploadedImage,
	uploadMobileSettingsFeedbackImages,
} from "../utils"
import { MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME } from "../constants"
import { MobileSettingsFeedbackCategorySheet } from "./FeedbackCategorySheet"
import {
	MOBILE_SETTINGS_FEEDBACK_ACCEPT,
	MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT,
	MOBILE_SETTINGS_FEEDBACK_CONTENT_MIN_LENGTH,
	MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH,
	MOBILE_SETTINGS_FEEDBACK_FILE_MAX_BYTES,
	MOBILE_SETTINGS_FEEDBACK_TITLE_MAX_LENGTH,
	type MobileSettingsFeedbackCategoryOption,
	type MobileSettingsFeedbackPrefill,
} from "./feedbackShared"
import { MobileSettingsSheetContainer } from "./SheetContainer"
import { useMobileSettingsFeedbackCategories } from "./useMobileSettingsFeedbackCategories"

interface MobileSettingsFeedbackDraftImage extends MobileSettingsFeedbackUploadedImage {
	id: string
	previewUrl: string
}

/** Category picker row on the create form — compact layout aligned with the prototype. */
function MobileSettingsFeedbackCategoryCell(props: {
	category?: MobileSettingsFeedbackCategoryOption
	placeholder: string
	onClick: () => void
}) {
	const { category, placeholder, onClick } = props
	const Icon = category?.Icon

	return (
		<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
			<button
				type="button"
				onClick={onClick}
				className="flex h-12 w-full items-center gap-3 px-[14px] text-left transition-opacity active:opacity-60"
				data-testid="mobile-settings-feedback-category-trigger"
			>
				<div
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-[10px]",
						category ? category.iconBoxClassName : "bg-muted",
					)}
					aria-hidden
				>
					{Icon ? (
						<Icon
							className={cn("h-5 w-5", category.iconClassName)}
							strokeWidth={1.75}
						/>
					) : (
						<Plus className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
					)}
				</div>
				<span
					className={cn(
						"flex-1 truncate text-left text-[16px] leading-5",
						category ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{category ? category.label : placeholder}
				</span>
				<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
			</button>
		</div>
	)
}

/** Section title above each form group — matches prototype label spacing. */
function MobileSettingsFeedbackSectionLabel(props: { children: ReactNode }) {
	return (
		<div className="px-[14px] text-[14px] leading-5 text-muted-foreground">
			{props.children}
		</div>
	)
}

/** Thumbnail tile for an uploaded image with a remove control. */
function MobileSettingsFeedbackAttachmentTile(props: {
	image: MobileSettingsFeedbackDraftImage
	removeAriaLabel: string
	onRemove: (id: string) => void
}) {
	const { image, removeAriaLabel, onRemove } = props

	return (
		<div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
			<img
				src={image.previewUrl}
				alt={image.name}
				className="h-full w-full object-cover"
				draggable={false}
			/>
			<button
				type="button"
				onClick={() => onRemove(image.id)}
				className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-foreground/80 text-background transition-opacity active:opacity-70"
				aria-label={removeAriaLabel}
			>
				<X className="h-3 w-3" strokeWidth={2.5} />
			</button>
		</div>
	)
}

/** Header confirm action — disabled styling matches prototype primary circle button. */
function MobileSettingsFeedbackConfirmButton(props: {
	disabled: boolean
	onClick: () => void
	ariaLabel: string
}) {
	const { disabled, onClick, ariaLabel } = props

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
				"right-2.5",
				disabled
					? "bg-foreground/30 text-background opacity-100"
					: "bg-foreground text-background",
			)}
			aria-label={ariaLabel}
			data-testid="mobile-settings-feedback-submit-button"
		>
			<Check className="h-5 w-5" strokeWidth={2.5} />
		</Button>
	)
}

/** 标题字段当前没有独立后端字段，这里把它折叠进正文，避免用户输入在提交时丢失。 */
function buildFeedbackSubmitDescription(params: {
	title: string
	description: string
	titleLabel: string
}) {
	const trimmedTitle = params.title.trim()
	const trimmedDescription = params.description.trim()

	if (!trimmedTitle) {
		return trimmedDescription
	}

	return `${params.titleLabel}: ${trimmedTitle}\n\n${trimmedDescription}`
}

/** 移动端反馈 Sheet 只实现 create 视图，列表与详情继续等待真实工单 API。 */
export function MobileSettingsFeedbackSheet(props: {
	open: boolean
	onClose: () => void
	prefill?: MobileSettingsFeedbackPrefill
}) {
	const { open, onClose, prefill } = props
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const { userInfo } = useUserInfo()
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const previousOpenRef = useRef(false)
	const [selectedCategoryId, setSelectedCategoryId] = useState<string>()
	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [contact, setContact] = useState("")
	const [images, setImages] = useState<MobileSettingsFeedbackDraftImage[]>([])
	const [categorySheetOpen, setCategorySheetOpen] = useState(false)
	const [touched, setTouched] = useState(false)
	const [isUploading, setIsUploading] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const feedbackCategories = useMobileSettingsFeedbackCategories()

	const selectedCategory = useMemo(
		() => feedbackCategories.find((option) => option.id === selectedCategoryId),
		[feedbackCategories, selectedCategoryId],
	)

	const descriptionTrimmed = description.trim()
	const canSubmit =
		Boolean(selectedCategory) &&
		descriptionTrimmed.length >= MOBILE_SETTINGS_FEEDBACK_CONTENT_MIN_LENGTH &&
		descriptionTrimmed.length <= MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH &&
		!isUploading &&
		!isSubmitting

	/** 反馈 Sheet 关闭或重开时统一重置草稿，并释放本地预览 URL，避免临时图片泄漏。 */
	useEffect(() => {
		const wasOpen = previousOpenRef.current
		previousOpenRef.current = open

		if (open && wasOpen) return

		setSelectedCategoryId(prefill?.categoryId)
		setTitle(prefill?.title ?? "")
		setDescription(prefill?.description ?? "")
		setImages((previousImages) => {
			previousImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
			return []
		})
		setContact(open ? userInfo?.email || "" : "")
		setCategorySheetOpen(false)
		setTouched(false)
		setIsUploading(false)
		setIsSubmitting(false)
	}, [open, prefill?.categoryId, prefill?.description, prefill?.title, userInfo?.email])

	/** 附件选择只允许图片，数量与体积上限与原型 FEEDBACK_LIMITS 对齐（图片-only）。 */
	const handleSelectImages = useMemoizedFn(async (event: ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(event.target.files ?? [])
		event.target.value = ""

		if (!selectedFiles.length) return

		const remainCount = MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT - images.length
		if (remainCount <= 0) {
			toast.warning(
				t("setting.feedbackSheet.attachmentCountLimit", {
					max: MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT,
				}),
			)
			return
		}

		const limitedFiles = selectedFiles.slice(0, remainCount)
		const imageFiles = limitedFiles.filter((file) => file.type.startsWith("image/"))
		const availableFiles = imageFiles.filter(
			(file) => file.size <= MOBILE_SETTINGS_FEEDBACK_FILE_MAX_BYTES,
		)

		if (!availableFiles.length) {
			toast.warning(t("setting.feedbackSheet.attachmentSizeLimit"))
			return
		}

		if (selectedFiles.length > remainCount) {
			toast.warning(
				t("setting.feedbackSheet.attachmentCountLimit", {
					max: MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT,
				}),
			)
		} else if (availableFiles.length < imageFiles.length) {
			toast.warning(t("setting.feedbackSheet.attachmentSizeLimit"))
		} else if (imageFiles.length < limitedFiles.length) {
			toast.warning(t("setting.feedbackSheet.attachmentSizeLimit"))
		}

		const previewUrls = availableFiles.map((file) => URL.createObjectURL(file))
		setIsUploading(true)

		try {
			const uploadedImages = await uploadMobileSettingsFeedbackImages(availableFiles)
			if (!uploadedImages.length) {
				previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
				toast.info(t("setting.comingSoon"))
				return
			}

			setImages((previousImages) => [
				...previousImages,
				...uploadedImages.map((image, index) => ({
					...image,
					id: `${image.key}-${index}`,
					previewUrl: previewUrls[index],
				})),
			])
		} catch {
			previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
			toast.error(t("common.uploadFailed"))
		} finally {
			setIsUploading(false)
		}
	})

	/** 删除附件时同步释放本地预览 URL，避免用户反复打开 Sheet 时累积内存占用。 */
	const handleRemoveImage = useMemoizedFn((imageId: string) => {
		setImages((previousImages) => {
			const targetImage = previousImages.find((image) => image.id === imageId)
			if (targetImage) {
				URL.revokeObjectURL(targetImage.previewUrl)
			}

			return previousImages.filter((image) => image.id !== imageId)
		})
	})

	/** 当前 API 没有 title 字段，因此提交时把标题前置到描述中，保证信息仍然可见。 */
	const handleSubmit = useMemoizedFn(async () => {
		setTouched(true)
		if (!canSubmit || !selectedCategory) return

		setIsSubmitting(true)
		try {
			const submitted = await submitMobileSettingsFeedback({
				type: selectedCategory.submitValue,
				description: buildFeedbackSubmitDescription({
					title,
					description,
					titleLabel: t("setting.feedbackSheet.titleLabelPlain"),
				}),
				contactEmail: contact.trim(),
				images: images.map(({ key, uid, name }) => ({ key, uid, name })),
			})

			if (!submitted) {
				toast.info(t("setting.comingSoon"))
				return
			}

			toast.success(tSuper("onlineFeedback.submitSuccess"))
			onClose()
		} catch {
			toast.error(t("common.loadFailed"))
		} finally {
			setIsSubmitting(false)
		}
	})

	return (
		<>
			<MobileSettingsSheetContainer
				open={open}
				title={t("setting.feedbackSheet.createTitle")}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) onClose()
				}}
				headerAction={
					<MobileSettingsFeedbackConfirmButton
						disabled={!canSubmit}
						onClick={handleSubmit}
						ariaLabel={t("button.confirm")}
					/>
				}
				contentClassName="gap-2.5 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
				dataTestId="mobile-settings-feedback-sheet"
			>
				<div className="flex flex-col gap-2">
					<MobileSettingsFeedbackSectionLabel>
						{t("setting.feedbackSheet.categoryLabel")}
					</MobileSettingsFeedbackSectionLabel>
					<MobileSettingsFeedbackCategoryCell
						category={selectedCategory}
						placeholder={t("setting.feedbackSheet.categoryPlaceholder")}
						onClick={() => setCategorySheetOpen(true)}
					/>
				</div>

				<div className="flex flex-col gap-2">
					<MobileSettingsFeedbackSectionLabel>
						{t("setting.feedbackSheet.titleLabel")}
					</MobileSettingsFeedbackSectionLabel>
					<div className="overflow-hidden rounded-lg bg-card">
						<Input
							type="text"
							value={title}
							onChange={(event) =>
								setTitle(
									event.target.value.slice(
										0,
										MOBILE_SETTINGS_FEEDBACK_TITLE_MAX_LENGTH,
									),
								)
							}
							placeholder={t("setting.feedbackSheet.titlePlaceholder")}
							className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] shadow-none focus-visible:ring-0"
							data-testid="mobile-settings-feedback-title-input"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<MobileSettingsFeedbackSectionLabel>
						{t("setting.feedbackSheet.descriptionLabel")}
					</MobileSettingsFeedbackSectionLabel>
					<div className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg bg-card">
						<Textarea
							value={description}
							onChange={(event) =>
								setDescription(
									event.target.value.slice(
										0,
										MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH,
									),
								)
							}
							onBlur={() => setTouched(true)}
							placeholder={t("setting.feedbackSheet.descriptionPlaceholder")}
							rows={6}
							className="min-h-0 resize-none rounded-none border-0 bg-transparent px-[14px] pb-2 pt-3 text-[16px] leading-6 shadow-none focus-visible:ring-0"
							data-testid="mobile-settings-feedback-description-input"
						/>
						<div className="flex items-center justify-between px-[14px] pb-2.5">
							{touched &&
							descriptionTrimmed.length <
								MOBILE_SETTINGS_FEEDBACK_CONTENT_MIN_LENGTH ? (
								<span className="text-[12px] leading-4 text-destructive">
									{t("setting.feedbackSheet.contentTooShort", {
										min: MOBILE_SETTINGS_FEEDBACK_CONTENT_MIN_LENGTH,
									})}
								</span>
							) : (
								<span />
							)}
							<span className="text-[12px] tabular-nums leading-4 text-muted-foreground">
								{t("setting.feedbackSheet.contentCounter", {
									count: description.length,
									max: MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH,
								})}
							</span>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between px-[14px]">
						<div className="text-[14px] leading-5 text-muted-foreground">
							{t("setting.feedbackSheet.attachmentLabel")}
						</div>
						<div className="text-[12px] tabular-nums leading-4 text-muted-foreground">
							{t("setting.feedbackSheet.attachmentCount", {
								count: images.length,
								max: MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT,
							})}
						</div>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept={MOBILE_SETTINGS_FEEDBACK_ACCEPT}
						multiple
						className="sr-only"
						aria-hidden
						onChange={handleSelectImages}
					/>
					<div className="flex flex-wrap gap-2">
						{images.map((image) => (
							<MobileSettingsFeedbackAttachmentTile
								key={image.id}
								image={image}
								removeAriaLabel={t("setting.feedbackSheet.attachmentRemoveAria")}
								onRemove={handleRemoveImage}
							/>
						))}
						{images.length < MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT ? (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card text-muted-foreground transition-opacity active:opacity-60"
								data-testid="mobile-settings-feedback-attachment-trigger"
							>
								<ImagePlus className="h-5 w-5" strokeWidth={1.75} />
								<span className="text-[11px] leading-3">
									{t("setting.feedbackSheet.attachmentAdd")}
								</span>
							</button>
						) : null}
					</div>
					<div className="px-[14px] text-[12px] leading-4 text-muted-foreground">
						{t("setting.feedbackSheet.attachmentHint", {
							max: MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT,
						})}
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<MobileSettingsFeedbackSectionLabel>
						{t("setting.feedbackSheet.contactLabel")}
					</MobileSettingsFeedbackSectionLabel>
					<div className="overflow-hidden rounded-lg bg-card">
						<Input
							type="text"
							value={contact}
							onChange={(event) => setContact(event.target.value)}
							placeholder={t("setting.feedbackSheet.contactPlaceholder")}
							className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] shadow-none focus-visible:ring-0"
							data-testid="mobile-settings-feedback-contact-input"
						/>
					</div>
				</div>
			</MobileSettingsSheetContainer>

			<MobileSettingsFeedbackCategorySheet
				open={categorySheetOpen}
				title={t("setting.feedbackSheet.categorySheetTitle")}
				options={feedbackCategories}
				selectedCategoryId={selectedCategoryId}
				onClose={() => setCategorySheetOpen(false)}
				onSelect={setSelectedCategoryId}
			/>
		</>
	)
}
