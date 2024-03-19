import { useEffect, useRef, useState, lazy, Suspense } from "react"
import CommonHeaderV2 from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2"

import CommonFooter from "../../components/CommonFooter"
import { useFileData } from "@/opensource/pages/superMagic/hooks/useFileData"
import AntdSkeleton from "@/opensource/components/base/AntdSkeleton"

const UniverComponent = lazy(() => import("@/opensource/components/UniverComponent"))

export default function UniverViewer(props: any) {
	const {
		data,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		file_extension = "xlsx",
		isFullscreen,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent: propFileContent,
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

	const { file_name, file_id } = data

	const {
		fileUrl: file_url,
		fileData,
		loading: fileDataLoading,
		fileVersion,
		changeFileVersion,
		fetchFileVersions,
		fileVersionsList,
		handleVersionRollback,
		isNewestVersion,
	} = useFileData({
		file_id,
		responseType: "arrayBuffer",
		activeFileId,
		updatedAt,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})
	const [fileContent, setFileContent] = useState<any>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// 判断文件类型
	// const getFileType = () => {
	// 	const extension = (file_extension || "").toLowerCase()
	// 	if (["xlsx", "xls", "csv"].includes(extension)) {
	// 		return "sheet"
	// 	} else if (["pptx", "ppt"].includes(extension)) {
	// 		return "slide"
	// 	}
	// 	return "sheet" // 默认为sheet
	// }

	const quitEditMode = () => {}

	// 监控 fileData 变化（来自 useFileData）
	useEffect(() => {
		if (fileData) {
			// 直接使用 useFileData 提供的数据，转换为 File 对象
			if (fileData instanceof ArrayBuffer) {
				// 对于二进制文件（如 Excel），从 ArrayBuffer 创建 File 对象
				const file = new File([fileData], file_name, {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				})
				setFileContent(file)
			} else if (typeof fileData === "string") {
				// 对于文本文件，创建 File 对象
				const file = new File([fileData], file_name, {
					type: "text/plain",
				})
				setFileContent(file)
			} else {
				// 如果是其他类型的数据，转换为 File 对象
				const file = new File([fileData], file_name, {
					type: "application/octet-stream",
				})
				setFileContent(file)
			}
		}
	}, [fileData, file_name])

	return (
		<div
			style={{ height: "100%", display: "flex", flexDirection: "column" }}
			className={className}
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
			{fileDataLoading || !fileContent ? (
				<div
					ref={containerRef}
					style={{ flex: 1, overflow: "hidden", padding: "16px", minHeight: "500px" }}
				>
					<AntdSkeleton active paragraph={{ rows: 10 }} />
				</div>
			) : (
				<div ref={containerRef} style={{ flex: 1, overflow: "hidden", minHeight: "500px" }}>
					<Suspense
						fallback={
							<div style={{ padding: "16px" }}>
								<AntdSkeleton active paragraph={{ rows: 10 }} />
							</div>
						}
					>
						<UniverComponent
							data={fileContent}
							mode="readonly"
							loadingFallback={<AntdSkeleton active paragraph={{ rows: 10 }} />}
						/>
					</Suspense>
				</div>
			)}

			{/* 底部 */}
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
