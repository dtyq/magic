import CommonHeaderV2 from "@/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { memo, useMemo } from "react"
import { useStyles } from "./style"
import MagicImagePreview from "@/components/base/MagicImagePreview"
import CommonFooter from "../../components/CommonFooter"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import MagicLoading from "@/components/other/MagicLoading"
import { Flex } from "antd"
import Deleted from "../../components/Deleted"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { DetailType } from "../../types"
import { AttachmentSource } from "../../../TopicFilesButton/hooks/types"

function Img(props: any) {
	const { styles } = useStyles()
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
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		isNewestVersion,
		loading,
		isDeleted,
	} = useFileData({
		file_id,
		activeFileId,
		updatedAt,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})

	const quitEditMode = () => { }

	const ImageRender = useMemo(() => {
		if (loading)
			return (
				<Flex align="center" justify="center" className={styles.loadingContainer}>
					<MagicLoading section speed={1} />
				</Flex>
			)
		if (isDeleted) return <Deleted data={data} showHeader={false} />
		return (
			<MagicImagePreview
				rootClassName={styles.imagePreview}
				toolContainerClassName={styles.imagePreviewToolContainer}
				onDownload={(mode?: DownloadImageMode) => onDownload?.(undefined, undefined, mode)}
				isAIImage={currentFile?.source === AttachmentSource.AI && type === DetailType.Image}
			>
				<img
					src={fileUrl}
					alt=""
					draggable={false}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			</MagicImagePreview>
		)
	}, [
		data,
		fileUrl,
		loading,
		isDeleted,
		onDownload,
		styles.imagePreview,
		styles.imagePreviewToolContainer,
		styles.loadingContainer,
		currentFile?.source,
		type,
	])

	return (
		<div className={styles.pdfViewer}>
			{showFileHeader && (
				<CommonHeaderV2
					type={type}
					onFullscreen={onFullscreen}
					onDownload={(mode?: DownloadImageMode) =>
						onDownload?.(file_id, fileVersion, mode)
					}
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
					allowEdit={allowEdit}
					attachments={attachments}
				/>
			)}
			<Flex className={styles.pdfContainer} align="center" justify="center">
				{ImageRender}
			</Flex>
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

export default memo(Img)
