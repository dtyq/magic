import CommonHeaderV2 from "@/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { memo } from "react"
import { Button } from "@/components/shadcn-ui/button"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { formatFileSize } from "@/utils/string"
import { useTranslation } from "react-i18next"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import CommonFooter from "../../components/CommonFooter"
import type { CommonHeaderV2Props } from "../../components/CommonHeaderV2/types"

interface NotSupportPreviewProps {
	type: string
	onFullscreen?: () => void
	onDownload?: (fileId: string) => void
	isFromNode?: boolean
	isFullscreen?: boolean
	data?: {
		file_name?: string
		file_id?: string
		file_extension?: string
		file_size?: number
	}
	viewMode?: string
	onViewModeChange?: (mode: string) => void
	onCopy?: () => void
	fileContent?: string
	currentFile?: CommonHeaderV2Props["currentFile"]
	detailMode?: string
	showFooter?: boolean
	allowEdit?: boolean
	showFileHeader?: boolean
	headerRenderMode?: CommonHeaderV2Props["renderMode"]
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
	} = props

	const { file_name, file_id, file_extension, file_size } = data || {}

	const handleDownloadFile = () => {
		if (onDownload) {
			onDownload(file_id)
		}
	}

	/** Mobile preview sheet: toolbar-only header sits below MagicPopup title as a full-width bar. */
	const useActionsBarChrome = headerRenderMode === "actions"

	const headerNode = showFileHeader ? (
		<CommonHeaderV2
			type={type}
			onFullscreen={onFullscreen}
			onDownload={onDownload}
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
						<MagicFileIcon size={60} type={file_extension} />
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
					{t("detail.fileFormatNotSupported")}
					<br />
					{t("detail.pleaseDownloadToView")}
				</div>

				{/* Download button */}
				<Button onClick={handleDownloadFile} size="sm">
					<Download className="size-5" />
					{t("detail.downloadFile")}
				</Button>
			</div>

			{/* Footer */}
			{showFooter && (
				<CommonFooter fileVersionsList={[]} allowEdit={allowEdit} isEditMode={false} />
			)}
		</div>
	)
}

export default memo(NotSupportPreview)
