import CommonHeaderV2 from "@/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { memo } from "react"
import { Button } from "@/components/shadcn-ui/button"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { formatFileSize } from "@/utils/string"
import { useTranslation } from "react-i18next"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"
import CommonFooter from "../../components/CommonFooter"

function NotSupportPreview(props: any) {
	const { t } = useTranslation("super")
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
		// File sharing props
		currentFile,
		detailMode,
		showFooter,
		allowEdit,
	} = props

	const { file_name, file_id, file_extension, file_size } = data || {}

	const handleDownloadFile = () => {
		if (onDownload) {
			onDownload(file_id)
		}
	}

	return (
		<div className={cn("flex h-full flex-col bg-muted dark:bg-background")}>
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
			/>

			<div
				className={cn("flex flex-1 flex-col items-center justify-center gap-5 p-4 md:p-5")}
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
