import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { useMemo, useRef, useState } from "react"
import type { AttachmentProps } from "./type"
import MagicIcon from "@/components/base/MagicIcon"
import { IconChevronDown, IconChevronRight, IconDownload, IconEye } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import {
	isMagicProjectConfigFile,
	resolveMagicProjectAttachment,
	type MagicProjectAttachmentFile,
} from "./utils"
import { isEmpty } from "lodash-es"
import { cn } from "@/utils/cn"
import { useIsMobile } from "@/hooks/useIsMobile"
import { openMessageFile } from "../../utils/openMessageFile"
import { useMessageAttachmentDownload } from "./hooks/useMessageAttachmentDownload"
import { observer } from "mobx-react-lite"
import { useMessageListContext } from "../../context"
import { detectContentTypeRender } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview"
import {
	HomeOnboardingAnchor,
	startHomeOnboardingDeliverableRunIfDue,
} from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { LocateFixed } from "lucide-react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { requestCanvasElementFocus } from "@/pages/superMagic/components/Detail/contents/Design/hooks/useDesignFocusElement"
import { useCanvasAttachmentLocationIndex } from "@/pages/superMagic/components/Detail/contents/Design/utils/canvasAttachmentLocationIndex"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { isCanvasAttachmentMediaType } from "@/components/CanvasDesign/public/attachment-media"
import MagicTooltip from "@/components/base/MagicTooltip"

export const Attachment = observer(function Attachment({
	attachments,
	onSelectDetail,
	onFileClick,
	className,
}: {
	attachments?: Array<AttachmentProps>
	onSelectDetail: any
	onFileClick?: (fileItem: any) => void
	className?: string
}) {
	const { t } = useTranslation("super")
	const { projectFilesStore: resolvedProjectFilesStore } = useMessageListContext()
	const isMobile = useIsMobile()
	const { permissions: access } = useFileAccess()
	const handleDownload = useMessageAttachmentDownload(attachments)
	const [expanded, setExpanded] = useState(false)
	const canvasCandidateFileIds = useMemo(
		() =>
			Array.from(
				new Set(
					(attachments || [])
						.filter((item) => {
							const mediaType = getFileType(item.file_extension || "")
							return (
								item.file_tag === "final" &&
								isCanvasAttachmentMediaType(mediaType) &&
								Boolean(item.file_id) &&
								isEmpty(item.display_config)
							)
						})
						.map((item) => String(item.file_id)),
				),
			),
		[attachments],
	)
	const canvasAttachmentLocations = useCanvasAttachmentLocationIndex({
		attachments: resolvedProjectFilesStore.workspaceFileTree as FileItem[],
		flatAttachments: resolvedProjectFilesStore.workspaceFilesList as FileItem[],
		candidateFileIds: canvasCandidateFileIds,
	})
	/**
	 * The block the new-user guide frames when it is opened from here.
	 *
	 * Marked by hand rather than declared in the markup, because the guide has to point at the block
	 * that was *clicked* and nothing in the markup can tell the blocks apart: the message list holds
	 * one of these per message, and they all look the same. See
	 * `HomeOnboardingAnchor.DeliverableAttachment` and the tour's first step.
	 */
	const sectionRef = useRef<HTMLDivElement>(null)

	const toggleExpanded = (e: any) => {
		e.stopPropagation()
		setExpanded(!expanded)
	}

	const displayedAttachments =
		expanded || !attachments || attachments.length < 4 ? attachments : attachments.slice(0, 4)

	const show = Array.isArray(attachments) && attachments.length > 0
	const resolveMagicProject = (item: MagicProjectAttachmentFile) =>
		resolveMagicProjectAttachment(
			item,
			resolvedProjectFilesStore?.workspaceFilesList ?? [],
			resolvedProjectFilesStore?.workspaceFileTree ?? [],
		)

	const handleOpenFile = (item: any) => {
		if (!access.view || !access.preview) return
		const fileName = item.display_filename || item.file_name || item.filename
		const magicProjectResolution = isMagicProjectConfigFile(fileName)
			? resolveMagicProject(item)
			: undefined
		const openTarget = magicProjectResolution?.projectDirectory || item

		if (onFileClick && openTarget.file_id) {
			onFileClick(openTarget)
			return
		}

		if (!isMobile && openTarget.file_id) {
			openMessageFile(openTarget)
			return
		}

		const contentTypeConfig = detectContentTypeRender(openTarget)
		const type = contentTypeConfig?.detailType || getFileType(openTarget.file_extension)
		if (type) {
			onSelectDetail?.({
				type,
				data: {
					...openTarget,
					file_name: magicProjectResolution?.projectName || fileName,
					file_extension: openTarget.file_extension,
					file_id: openTarget.file_id,
					display_config:
						magicProjectResolution?.displayConfig || openTarget.display_config,
					...(contentTypeConfig?.dataTransformer
						? contentTypeConfig.dataTransformer(openTarget)
						: {}),
				},
				currentFileId: openTarget.file_id,
			})
		} else {
			onSelectDetail?.({
				type: "empty",
				data: {
					text: t("ui.filePreviewNotSupported"),
				},
			})
		}
	}
	/**
	 * Opening one of these files — unless this is the first of them a new account has ever asked
	 * for, in which case the guide takes the click and nothing is opened.
	 *
	 * The guide is about these files rather than about the one that was clicked: it says what a
	 * task's results are and where they are kept, and both of its sentences are about the block the
	 * user is looking at. Opening the file underneath would put that explanation on a screen the
	 * user has not been introduced to yet, and the frame the first step draws around the block would
	 * be over a panel that has just been replaced by the file's contents. So the click buys the
	 * guide alone; the next one — what the guide's own words invite — opens the file, and every
	 * click after that behaves as it always did.
	 *
	 * The block is still marked as the guide's anchor, and marked before the early return: the mark
	 * is what the first step points at, and it is the only thing that can tell the guide which of
	 * the page's attachment blocks was clicked. See `startHomeOnboardingDeliverableRunIfDue`.
	 */
	const openAttachment = (item: AttachmentProps) => {
		if (startHomeOnboardingDeliverableRunIfDue()) {
			sectionRef.current?.setAttribute(
				"data-guide-anchor",
				HomeOnboardingAnchor.DeliverableAttachment,
			)
			return
		}
		handleOpenFile(item)
	}
	const getMetaDataName = (item: any) => {
		return item?.name ? `${item?.name}` : null
	}
	if (!show) return null
	return (
		<div ref={sectionRef} className={cn("flex w-full flex-col rounded-md", className)}>
			<div
				className={cn(
					"flex items-center gap-1",
					attachments.length > 4 && "cursor-pointer",
				)}
				onClick={(e) => {
					if (attachments.length > 4) {
						toggleExpanded(e)
					}
				}}
				data-testid="toggle-expanded"
			>
				<div className="mr-1 text-sm font-medium text-foreground">
					{t("ui.attachments", { count: attachments.length })}
				</div>
				{attachments.length > 4 &&
					(expanded ? (
						<IconChevronDown className="size-[18px] shrink-0 text-foreground" />
					) : (
						<IconChevronRight className="size-[18px] shrink-0 text-foreground" />
					))}
			</div>
			{!!displayedAttachments?.length && (
				<div className="mt-2 flex flex-wrap gap-2">
					{displayedAttachments?.map((item: AttachmentProps) => {
						const { display_config } = item
						const isFolder = item.file_extension === ""
						const fileName = item.display_filename || item.file_name || item.filename
						const magicProjectResolution = isMagicProjectConfigFile(fileName)
							? resolveMagicProject(item)
							: undefined
						const attachmentDisplayConfig =
							magicProjectResolution?.displayConfig || display_config
						const attachmentName =
							magicProjectResolution?.projectName ||
							getMetaDataName(display_config) ||
							fileName
						const mediaType = getFileType(item.file_extension || "")
						const canvasLocations = item.file_id
							? (canvasAttachmentLocations.get(String(item.file_id)) ?? [])
							: []
						// The file must belong to exactly one Canvas directory.
						const locateTarget =
							item.file_tag === "final" &&
							isCanvasAttachmentMediaType(mediaType) &&
							canvasLocations.length === 1
								? {
										canvasDesignId: canvasLocations[0].canvasDesignId,
										mediaFileId: canvasLocations[0].mediaFileId,
									}
								: undefined
						return (
							<div
								key={item.file_id}
								className="w-full cursor-pointer"
								onClick={(e) => {
									if (isFolder && !attachmentDisplayConfig) {
										return
									}
									e.stopPropagation()
									openAttachment(item)
								}}
								data-testid="handle-open-file"
							>
								<div
									className={cn(
										"flex items-center gap-2 rounded-[12px] p-2.5 transition-all duration-300",
										"bg-fill",
										"hover:bg-fill-secondary",
									)}
								>
									<FileResourceIcon
										presentation={resolveFilePresentation(
											(magicProjectResolution?.projectDirectory as
												AttachmentItem | undefined) ?? {
												...item,
												is_directory: item.is_directory ?? isFolder,
											},
											{
												context:
													resolvedProjectFilesStore.filePresentationContext,
												index: resolvedProjectFilesStore.filePresentationIndex,
											},
										)}
										size={24}
										className="shrink-0"
										folderTestId="message-attachment-image"
									/>

									<span
										className={cn(
											"mr-2 flex-1 text-foreground",
											"min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
										)}
									>
										{attachmentName}
									</span>
									{isEmpty(attachmentDisplayConfig) && locateTarget && (
										<MagicTooltip title={t("operationResultList.viewInCanvas")}>
											<button
												type="button"
												aria-label={t("operationResultList.viewInCanvas")}
												className="inline-flex size-[18px] shrink-0 items-center justify-center text-muted-foreground hover:text-foreground/80"
												onClick={(event) => {
													event.preventDefault()
													event.stopPropagation()
													pubsub.publish(PubSubEvents.Open_File_Tab, {
														fileId: locateTarget.canvasDesignId,
													})
													requestCanvasElementFocus({
														canvasDesignId: locateTarget.canvasDesignId,
														mediaFileId: locateTarget.mediaFileId,
														selectElement: true,
														animated: true,
														padding: {
															top: "25%",
															right: "25%",
															bottom: "25%",
															left: "25%",
														},
													})
												}}
											>
												<LocateFixed
													aria-hidden="true"
													size={16}
													strokeWidth={2}
												/>
											</button>
										</MagicTooltip>
									)}
									{access.view && access.preview && (
										<MagicIcon
											className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
											onClick={(e: any) => {
												e.stopPropagation()
												openAttachment(item)
											}}
											component={IconEye}
											stroke={2}
											size={18}
										/>
									)}
									{isEmpty(attachmentDisplayConfig) && access.download && (
										<MagicIcon
											className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
											onClick={(e: any) => {
												e.stopPropagation()
												handleDownload(item.file_id)
											}}
											component={IconDownload}
											stroke={2}
											size={18}
										/>
									)}
								</div>
							</div>
						)
					})}
					{!expanded && attachments && attachments.length > 4 && (
						<div
							className={cn(
								"w-full cursor-pointer rounded-md p-1 text-center",
								"border border-border text-sm font-normal text-foreground",
								"hover:bg-blue-50 dark:hover:bg-blue-500/10",
							)}
							onClick={toggleExpanded}
							data-testid="toggle-expanded-2"
						>
							{t("ui.expandAllFiles")} ({attachments.length})
						</div>
					)}
				</div>
			)}
		</div>
	)
})
