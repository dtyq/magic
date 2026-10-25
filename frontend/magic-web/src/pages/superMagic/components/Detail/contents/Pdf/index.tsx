import CommonHeaderV2 from "@/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { useRef } from "react"
import { useStyles } from "./style"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import CommonFooter from "../../components/CommonFooter"
import MagicPdfRender from "@/components/base/MagicPdfRender"
import MagicSpin from "@/components/base/MagicSpin"
import FlexBox from "@/components/base/FlexBox"
import DetailEmpty from "../../components/DetailEmpty"
import { useTranslation } from "react-i18next"

export default function PDFViewer(props: any) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()
	const {
		type,
		onFullscreen,
		onDownload,

		isFromNode,
		documentFlowFullscreen = false,
		isFullscreen,
		data,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		// File sharing props
		currentFile,
		className,
		updatedAt,
		detailMode,
		showFileHeader = true,
		activeFileId,
		showFooter,
		allowEdit,
		isPlaybackMode,
		attachments,
		allowDownload,
	} = props

	const { file_id } = data
	const {
		fileUrl,
		loadError,
		refreshFile,
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		isNewestVersion,
	} = useFileData({
		file_id,
		activeFileId,
		updatedAt,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})
	const containerRef = useRef<HTMLDivElement>(null)

	const quitEditMode = () => {}

	return (
		<div
			ref={containerRef}
			className={cx(styles.pdfViewer, className)}
			style={
				documentFlowFullscreen
					? { height: "auto", minHeight: "100dvh", overflow: "visible" }
					: undefined
			}
		>
			{showFileHeader && (
				<CommonHeaderV2
					type={type}
					onFullscreen={onFullscreen}
					onDownload={() => onDownload?.(file_id, fileVersion)}
					isFromNode={isFromNode}
					isFullscreen={isFullscreen}
					viewMode={viewMode}
					onViewModeChange={onViewModeChange}
					onCopy={onCopy}
					fileContent={fileContent}
					// File sharing props
					currentFile={currentFile}
					detailMode={detailMode}
					showDownload={allowDownload !== false}
					fileVersion={fileVersion}
					isNewestFileVersion={isNewestVersion}
					changeFileVersion={changeFileVersion}
					fileVersionsList={fileVersionsList}
					handleVersionRollback={handleVersionRollback}
					quitEditMode={quitEditMode}
					attachments={attachments}
					allowEdit={allowEdit}
				/>
			)}
			{loadError ? (
				<DetailEmpty title={t("common.fileNotFoundOrLoadFailed")} onRetry={refreshFile} />
			) : fileUrl ? (
				<MagicPdfRender
					file={fileUrl}
					height={documentFlowFullscreen ? "auto" : "100%"}
					documentFlow={documentFlowFullscreen}
				/>
			) : (
				<FlexBox
					justify="center"
					align="center"
					style={documentFlowFullscreen ? { minHeight: "100dvh" } : { height: "100%" }}
				>
					<MagicSpin spinning />
				</FlexBox>
			)}
			{showFooter && (
				<CommonFooter
					fileVersion={fileVersion}
					changeFileVersion={changeFileVersion}
					fileVersionsList={fileVersionsList}
					handleVersionRollback={handleVersionRollback}
					quitEditMode={quitEditMode}
					allowEdit={allowEdit}
					isEditMode={false}
				/>
			)}
		</div>
	)
}
