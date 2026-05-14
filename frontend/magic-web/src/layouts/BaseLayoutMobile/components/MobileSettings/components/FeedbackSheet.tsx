import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import { Check, ChevronRight, ImagePlus, Plus } from "lucide-react"
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
	MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH,
	MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_COUNT,
	MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_SIZE_BYTES,
	MOBILE_SETTINGS_FEEDBACK_TITLE_MAX_LENGTH,
	type MobileSettingsFeedbackCategoryOption,
} from "./feedbackShared"
import { MobileSettingsSheetContainer } from "./SheetContainer"
import { useMobileSettingsFeedbackCategories } from "./useMobileSettingsFeedbackCategories"

interface MobileSettingsFeedbackDraftImage extends MobileSettingsFeedbackUploadedImage {
	id: string
	previewUrl: string
}

function MobileSettingsFeedbackCategoryCell(props: {
	category?: MobileSettingsFeedbackCategoryOption
	placeholder: string
	onClick: () => void
}) {
	const { category, placeholder, onClick } = props
	const Icon = category?.Icon

	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-[72px] w-full items-center gap-4 rounded-2xl bg-card px-4 text-left transition-opacity active:opacity-60"
			data-testid="mobile-settings-feedback-category-trigger"
		>
			<div
				className={cn(
					"flex size-14 shrink-0 items-center justify-center rounded-2xl",
					category ? category.iconBoxClassName : "bg-muted",
				)}
				aria-hidden
			>
				{Icon ? (
					<Icon className={cn("h-5 w-5", category.iconClassName)} strokeWidth={2} />
				) : (
					<Plus className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
				)}
			</div>
			<span
				className={cn(
					"flex-1 text-[16px] leading-6",
					category ? "text-foreground" : "text-muted-foreground",
				)}
			>
				{category ? category.label : placeholder}
			</span>
			<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
		</button>
	)
}

function MobileSettingsFeedbackSectionLabel(props: { children: ReactNode }) {
	return <div className="px-3.5 text-sm leading-5 text-muted-foreground">{props.children}</div>
}

function MobileSettingsFeedbackAttachmentTile(props: {
	image: MobileSettingsFeedbackDraftImage
	onRemove: (id: string) => void
}) {
	const { image, onRemove } = props

	return (
		<div className="relative size-[84px] overflow-hidden rounded-2xl border border-border bg-card">
			<img
				src={image.previewUrl}
				alt={image.name}
				className="h-full w-full object-cover"
				draggable={false}
			/>
			<button
				type="button"
				onClick={() => onRemove(image.id)}
				className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity active:opacity-70"
				aria-label="attachment-remove"
			>
				<span className="text-sm leading-none">×</span>
			</button>
		</div>
	)
}

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
export function MobileSettingsFeedbackSheet(props: { open: boolean; onClose: () => void }) {
	const { open, onClose } = props
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
	const [isUploading, setIsUploading] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const feedbackCategories = useMobileSettingsFeedbackCategories()

	const selectedCategory = useMemo(
		() => feedbackCategories.find((option) => option.id === selectedCategoryId),
		[feedbackCategories, selectedCategoryId],
	)
	const canSubmit =
		Boolean(selectedCategory && description.trim()) && !isUploading && !isSubmitting

	/** 反馈 Sheet 关闭或重开时统一重置草稿，并释放本地预览 URL，避免临时图片泄漏。 */
	useEffect(() => {
		const wasOpen = previousOpenRef.current
		previousOpenRef.current = open

		if (open && wasOpen) return

		setSelectedCategoryId(undefined)
		setTitle("")
		setDescription("")
		setImages((previousImages) => {
			previousImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
			return []
		})
		setContact(open ? userInfo?.email || "" : "")
		setCategorySheetOpen(false)
		setIsUploading(false)
		setIsSubmitting(false)
	}, [open, userInfo?.email])

	/** 附件选择只允许图片，并沿用现有反馈链路的数量和大小上限。 */
	const handleSelectImages = useMemoizedFn(async (event: ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(event.target.files ?? [])
		event.target.value = ""

		if (!selectedFiles.length) return

		const remainCount = MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_COUNT - images.length
		if (remainCount <= 0) {
			toast.warning(tSuper("onlineFeedback.uploadImageCountLimit"))
			return
		}

		const limitedFiles = selectedFiles.slice(0, remainCount)
		const availableFiles = limitedFiles
			.filter((file) => file.type.startsWith("image/"))
			.filter((file) => file.size <= MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_SIZE_BYTES)

		if (!availableFiles.length) {
			toast.warning(tSuper("onlineFeedback.uploadImageSizeLimit"))
			return
		}

		if (selectedFiles.length > remainCount) {
			toast.warning(tSuper("onlineFeedback.uploadImageCountLimit"))
		} else if (availableFiles.length < limitedFiles.length) {
			toast.warning(tSuper("onlineFeedback.uploadImageSizeLimit"))
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
		if (!selectedCategory || !description.trim() || isUploading || isSubmitting) return

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
				contentClassName="gap-4 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-3"
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
					<div className="overflow-hidden rounded-2xl bg-card">
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
							className="h-[68px] rounded-none border-0 bg-transparent px-5 text-[16px] shadow-none focus-visible:ring-0"
							data-testid="mobile-settings-feedback-title-input"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<MobileSettingsFeedbackSectionLabel>
						{t("setting.feedbackSheet.descriptionLabel")}
					</MobileSettingsFeedbackSectionLabel>
					<div className="overflow-hidden rounded-2xl bg-card">
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
							placeholder={t("setting.feedbackSheet.descriptionPlaceholder")}
							className="min-h-[276px] resize-none rounded-none border-0 bg-transparent px-5 py-5 text-[16px] leading-8 shadow-none focus-visible:ring-0"
							data-testid="mobile-settings-feedback-description-input"
						/>
						<div className="flex justify-end px-5 pb-5 text-sm leading-5 text-muted-foreground">
							{description.length}/{MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH}
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between px-3.5">
						<div className="text-sm leading-5 text-muted-foreground">
							{t("setting.feedbackSheet.attachmentLabel")}
						</div>
						<div className="text-sm leading-5 text-muted-foreground">
							{images.length}/{MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_COUNT}
						</div>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						multiple
						className="sr-only"
						aria-hidden
						onChange={handleSelectImages}
					/>
					<div className="flex flex-wrap gap-3">
						{images.map((image) => (
							<MobileSettingsFeedbackAttachmentTile
								key={image.id}
								image={image}
								onRemove={handleRemoveImage}
							/>
						))}
						{images.length < MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_COUNT ? (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="flex size-[84px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card text-muted-foreground transition-opacity active:opacity-60"
								data-testid="mobile-settings-feedback-attachment-trigger"
							>
								<ImagePlus className="h-6 w-6" strokeWidth={1.75} />
								<span className="text-sm leading-5">
									{t("setting.feedbackSheet.attachmentAdd")}
								</span>
							</button>
						) : null}
					</div>
					<div className="px-3.5 text-sm leading-5 text-muted-foreground">
						{t("setting.feedbackSheet.attachmentHint")}
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<MobileSettingsFeedbackSectionLabel>
						{t("setting.feedbackSheet.contactLabel")}
					</MobileSettingsFeedbackSectionLabel>
					<div className="overflow-hidden rounded-2xl bg-card">
						<Input
							type="text"
							value={contact}
							onChange={(event) => setContact(event.target.value)}
							placeholder={tSuper("onlineFeedback.contactEmailPlaceholder")}
							className="h-[68px] rounded-none border-0 bg-transparent px-5 text-[16px] shadow-none focus-visible:ring-0"
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
