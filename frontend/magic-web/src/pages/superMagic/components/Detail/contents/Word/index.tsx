import MemoizedMagicDocxRender from "@/components/base/MagicDocxRender"
import { useEffect, useState } from "react"
import Empty from "../../components/DetailEmpty"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import CommonFooter from "../../components/CommonFooter"
import { useStyles } from "./styles"

export default function WordViewer(props: any) {
	const { styles, cx } = useStyles()
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
		className,
		updatedAt,
		detailMode,
		showFileHeader = true,
		activeFileId,
		showFooter,
		allowEdit,
		isPlaybackMode,
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
	} = useFileData({
		file_id,
		activeFileId,
		updatedAt,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})
	const [file, setFile] = useState<File>()

	useEffect(() => {
		if (!fileUrl) return
		fetch(fileUrl)
			.then((res) => {
				return res.blob()
			})
			.then((blob) => {
				setFile(
					new File([blob], data.file_name, {
						type: blob.type,
					}),
				)
			})
			.catch(() => {
				setFile(undefined)
			})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileUrl])

	if (!file) return <Empty />

	return (
		<div className={cx(styles.container, className)}>
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
					allowEdit={allowEdit}
				/>
			)}
			<MemoizedMagicDocxRender
				file={file}
				height="100%"
				showDownload={false}
				showFullscreen={false}
				showReload={false}
			/>
			{showFooter && (
				<CommonFooter
					fileVersion={fileVersion}
					changeFileVersion={changeFileVersion}
					fileVersionsList={fileVersionsList}
					handleVersionRollback={handleVersionRollback}
					allowEdit={allowEdit}
					isEditMode={false}
				/>
			)}
		</div>
	)
}
