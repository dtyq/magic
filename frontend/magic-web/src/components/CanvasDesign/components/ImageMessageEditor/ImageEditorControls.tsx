import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import styles from "./index.module.css"
import IconButton from "../ui/custom/IconButton"
import { ImagePlus, ChevronsUpDown, X, LoaderCircle } from "../ui/icons/index"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import ResolutionSelect from "../ui/custom/ResolutionSelect"
import ReferenceImageThumbnailImage from "./ReferenceImageThumbnailImage"
import type { ImageEditorConfig } from "./useImageEditorConfig"

interface ImageEditorControlsProps {
	config: ImageEditorConfig
	protectedReferenceImageIndex?: number
	onUploadClick: () => void
	/** 参考图删除回调，传入时优先使用（用于同步到 TipTap） */
	onReferenceImageRemove?: (path: string) => void
	renderSendButton?: () => React.ReactNode
}

export default function ImageEditorControls(props: ImageEditorControlsProps) {
	const {
		config,
		protectedReferenceImageIndex,
		onUploadClick,
		onReferenceImageRemove,
		renderSendButton,
	} = props
	const { t } = useCanvasDesignI18n()

	const {
		selectedModelId,
		modelOptions,
		selectedModelOption,
		maxReferenceImages,
		isReferenceImageLimitReached,
		isUploading,
		currentReferenceImages,
		referenceImageInfos,
		supportedResolutionOptions,
		supportedAspectRatioOptions,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		handlers,
	} = config

	return (
		<>
			<div className={styles.controllers}>
				<div className={styles.left}>
					{modelOptions.length > 0 && selectedModelOption && (
						<Select value={selectedModelId} onValueChange={handlers.handleModelChange}>
							<SelectTrigger className={styles.selectTrigger}>
								<div
									className={styles.modelOptionItemContent}
									style={{ maxWidth: 160 }}
								>
									<div className={styles.icon}>{selectedModelOption.icon}</div>
									<div className={styles.label}>{selectedModelOption.label}</div>
								</div>
								<ChevronsUpDown size={16} />
							</SelectTrigger>
							<SelectContent className={styles.selectContent}>
								{modelOptions.map((option) => (
									<SelectItem
										key={option.value}
										value={option.value}
										className={styles.selectOptionItem}
									>
										<div className={styles.modelOptionItemContent}>
											<div className={styles.icon}>{option.icon}</div>
											<div className={styles.label}>{option.label}</div>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{maxReferenceImages !== undefined && maxReferenceImages > 0 && (
						<Popover
							open={isPopoverOpen}
							onOpenChange={(open) => {
								if (open) {
									handlers.handlePopoverMouseEnter()
								} else {
									handlers.handlePopoverMouseLeave()
								}
							}}
						>
							<PopoverTrigger
								className={styles.referenceImagePopoverTrigger}
								onMouseEnter={handlers.handlePopoverMouseEnter}
								onMouseLeave={handlers.handlePopoverMouseLeave}
							>
								<IconButton
									className={styles.imageUploadButton}
									onClick={onUploadClick}
									selected={currentReferenceImages.length > 0}
									disabled={isUploading || isReferenceImageLimitReached}
									style={{
										opacity:
											isUploading || isReferenceImageLimitReached ? 0.5 : 1,
										cursor:
											isUploading || isReferenceImageLimitReached
												? "not-allowed"
												: "pointer",
									}}
									title={
										isReferenceImageLimitReached &&
										maxReferenceImages !== undefined
											? t("imageEditor.maxReferenceImagesReached", {
													defaultValue: `最多只能上传 ${maxReferenceImages} 张参考图`,
													maxReferenceImages,
												})
											: undefined
									}
								>
									{isUploading ? (
										<LoaderCircle size={16} className="animate-spin" />
									) : (
										<ImagePlus size={16} />
									)}
									{currentReferenceImages.length > 0 && (
										<span>{currentReferenceImages.length}</span>
									)}
								</IconButton>
							</PopoverTrigger>
							{!!referenceImageInfos.length && (
								<PopoverContent
									data-canvas-ui-component
									align="start"
									onMouseEnter={handlers.handlePopoverMouseEnter}
									onMouseLeave={handlers.handlePopoverMouseLeave}
									className={styles.referenceImagePopover}
								>
									<div className={styles.referenceImageContent}>
										<div className={styles.referenceImageTitle}>
											{t("imageEditor.referenceImage", "参考图")}
										</div>
										<div className={styles.referenceImageList}>
											{referenceImageInfos.map((info, index) => {
												const isProtected =
													protectedReferenceImageIndex !== undefined &&
													index === protectedReferenceImageIndex
												const currentImageText = t(
													"imageEditor.currentImage",
													"(当前图片)",
												)
												return (
													<div
														key={info.path}
														className={styles.referenceImageItem}
													>
														<ReferenceImageThumbnailImage
															fileName={info.fileName}
															path={info.path}
														/>
														<div
															className={styles.referenceImageName}
															title={
																isProtected
																	? `${info.fileName} ${currentImageText}`
																	: info.fileName
															}
														>
															{isProtected ? (
																<>
																	<span
																		className={
																			styles.referenceImageFileName
																		}
																	>
																		{info.fileName}
																	</span>
																	<span
																		className={
																			styles.referenceImageCurrentTag
																		}
																	>
																		{currentImageText}
																	</span>
																</>
															) : (
																info.fileName
															)}
														</div>
														{!isProtected && (
															<IconButton
																className={
																	styles.referenceImageDelete
																}
																onClick={(e) => {
																	e.stopPropagation()
																	;(
																		onReferenceImageRemove ??
																		handlers.handleReferenceImageRemove
																	)(info.path)
																}}
															>
																<X size={14} />
															</IconButton>
														)}
													</div>
												)
											})}
										</div>
									</div>
								</PopoverContent>
							)}
						</Popover>
					)}
				</div>
				<div className={styles.right}>
					{/* 分辨率选择 */}
					<ResolutionSelect
						options={supportedResolutionOptions}
						value={config.selectedResolution}
						onValueChange={handlers.handleResolutionChange}
					/>
					{/* 比例选择 */}
					{supportedAspectRatioOptions.length > 0 && (
						<Select
							value={currentSelectValue || ""}
							onValueChange={handlers.handleRatioChange}
						>
							<SelectTrigger className={styles.selectTrigger}>
								<span className={styles.selectTriggerText}>
									{ratioOption?.label || t("imageEditor.custom", "自定义")}
								</span>
								<ChevronsUpDown size={16} />
							</SelectTrigger>
							<SelectContent
								className={styles.selectContent}
								style={{ minWidth: 200 }}
							>
								<div className={styles.selectContentName}>
									{t("imageEditor.size", "尺寸")}
								</div>
								{supportedAspectRatioOptions.map((option) => {
									if (!option || !option.value) return null
									return (
										<SelectItem
											key={option.value}
											value={option.value}
											className={styles.selectOptionItem}
										>
											<div className={styles.ratioOptionItemContent}>
												<div className={styles.icon}>
													<div
														className={styles.iconContent}
														style={{
															width: `${option.iconWidth}px`,
															height: `${option.iconHeight}px`,
														}}
													/>
												</div>
												<div className={styles.label} style={{ width: 60 }}>
													{option.label}
												</div>
												<div className={styles.size}>
													{option.width}x{option.height}
												</div>
											</div>
										</SelectItem>
									)
								})}
							</SelectContent>
						</Select>
					)}
					{renderSendButton && renderSendButton()}
				</div>
			</div>
		</>
	)
}
