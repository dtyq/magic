import CommonHeaderV2 from "@/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { lazy, memo, Suspense } from "react"
import { Button } from "@/components/shadcn-ui/button"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { UnknownFileIcon } from "@/pages/superMagic/components/TopicFilesButton/components/UnknownFileIcon"
import { formatFileSize } from "@/utils/string"
import { useTranslation } from "react-i18next"
import { Download, Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { useIsMobile } from "@/hooks/useIsMobile"
import CommonFooter from "../../components/CommonFooter"
import type { CommonHeaderV2Props } from "../../components/CommonHeaderV2/types"
import { DetailType } from "../../types"
import { useUnknownFilePreview } from "@/pages/superMagic/hooks/useUnknownFilePreview"
import {
	UNKNOWN_TEXT_PREVIEW_MAX_BYTES,
	type FileContentMetadata,
} from "@/pages/superMagic/utils/fileContentType"

const Text = lazy(() => import("../Text"))

interface NotSupportPreviewProps {
	type: string
	onFullscreen?: () => void
	onDownload?: (fileId: string, fileVersion?: number) => void
	isFromNode?: boolean
	isFullscreen?: boolean
	data?: FileContentMetadata
	viewMode?: CommonHeaderV2Props["viewMode"]
	onViewModeChange?: CommonHeaderV2Props["onViewModeChange"]
	onCopy?: () => void
	fileContent?: string
	currentFile?: CommonHeaderV2Props["currentFile"]
	detailMode?: CommonHeaderV2Props["detailMode"]
	showFooter?: boolean
	allowEdit?: boolean
	showFileHeader?: boolean
	headerRenderMode?: CommonHeaderV2Props["renderMode"]
	updatedAt?: string
	isTabActive?: boolean
	activeFileId?: string | null
	allowDownload?: boolean
	documentFlowFullscreen?: boolean
}

/** Unsupported file placeholder: toolbar + download CTA; mobile sheet uses top-aligned layout. */
function NotSupportPreview(props: NotSupportPreviewProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const {
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		data,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		detailMode,
		showFooter,
		allowEdit,
		showFileHeader = true,
		headerRenderMode = "full",
		allowDownload = true,
	} = props

	const file: FileContentMetadata = {
		...data,
		file_id: data?.file_id == null ? undefined : String(data.file_id),
		updated_at: data?.updated_at ?? props.updatedAt,
	}
	const { file_name, file_id, file_extension, file_size } = file
	const { state, refresh } = useUnknownFilePreview(
		file,
		props.isTabActive ?? (!props.activeFileId || props.activeFileId === file_id),
	)

	const handleDownloadFile = () => {
		if (onDownload && file_id && allowDownload) {
			onDownload(file_id, file.file_version)
		}
	}

	if (state.status === "text") {
		return (
			<Suspense fallback={<Loader2 className="m-auto animate-spin" size={24} />}>
				<Text
					{...props}
					type={DetailType.Text}
					data={file}
					readOnlyPreview={{ content: state.content, refresh }}
					isEditMode={false}
					showFooter={false}
				/>
			</Suspense>
		)
	}

	const message =
		state.status === "loading"
			? t("detail.unknownFileLoading")
			: state.status === "binary"
				? t("detail.binaryFilePreviewUnavailable")
				: state.status === "too-large"
					? t("detail.unknownFileTooLarge", {
							size: UNKNOWN_TEXT_PREVIEW_MAX_BYTES / (1024 * 1024),
						})
					: state.status === "unsupported-encoding"
						? t("detail.unknownFileEncodingUnavailable")
						: state.status === "error"
							? t("detail.unknownFileLoadFailed")
							: t("detail.fileFormatNotSupported")

	/** Mobile preview sheet: toolbar-only header sits below MagicPopup title as a full-width bar. */
	const useActionsBarChrome = headerRenderMode === "actions"

	const headerNode = showFileHeader ? (
		<CommonHeaderV2
			type={type}
			onFullscreen={onFullscreen}
			onDownload={handleDownloadFile}
			showDownload={allowDownload}
			isFromNode={isFromNode}
			isFullscreen={isFullscreen}
			viewMode={viewMode}
			onViewModeChange={onViewModeChange}
			onCopy={onCopy}
			fileContent={fileContent}
			currentFile={currentFile}
			detailMode={detailMode}
			allowEdit={allowEdit}
			renderMode={headerRenderMode}
		/>
	) : null

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			{showFileHeader && useActionsBarChrome ? (
				<div className="flex h-11 w-full shrink-0 items-center border-b border-border bg-background px-2.5">
					{headerNode}
				</div>
			) : (
				headerNode
			)}

			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col items-center px-4",
					isMobile
						? "justify-start gap-4 pb-[max(1.5rem,var(--safe-area-inset-bottom))] pt-6"
						: "justify-center gap-5 p-4 md:p-5",
				)}
			>
				{/* File icon and info card */}
				<div
					className={cn(
						"flex flex-col items-center gap-2.5 rounded-xl px-10 py-4 md:px-[60px] md:py-5",
					)}
				>
					<div className="flex h-[60px] w-[60px] items-center justify-center">
						<MagicFileIcon
							size={60}
							type={file_extension}
							fallbackIcon={<UnknownFileIcon file={file} size={60} />}
						/>
					</div>
					<div className="flex flex-col items-center gap-1">
						<div
							className={cn(
								"text-center text-base font-semibold leading-[22px] text-foreground/80 dark:text-foreground",
							)}
						>
							{file_name}
						</div>
						<div
							className={cn(
								"text-center text-xs font-normal leading-4 text-muted-foreground",
							)}
						>
							{formatFileSize(file_size)}
						</div>
					</div>
				</div>

				{/* Tip text */}
				<div
					className={cn(
						"max-w-[240px] text-center text-xs font-normal leading-4 text-muted-foreground",
					)}
				>
					{state.status === "loading" && (
						<Loader2 className="mx-auto mb-2 animate-spin" size={20} />
					)}
					{message}
					{state.status === "idle" && (
						<>
							<br />
							{t("detail.pleaseDownloadToView")}
						</>
					)}
				</div>

				{/* Download button */}
				{state.status === "error" && (
					<Button onClick={() => void refresh()} variant="outline" size="sm">
						{t("common.retry")}
					</Button>
				)}
				{allowDownload && onDownload && file_id && (
					<Button onClick={handleDownloadFile} size="sm">
						<Download className="size-5" />
						{t("detail.downloadFile")}
					</Button>
				)}
			</div>

			{/* Footer */}
			{showFooter && (
				<CommonFooter fileVersionsList={[]} allowEdit={allowEdit} isEditMode={false} />
			)}
		</div>
	)
}

export default memo(NotSupportPreview)
