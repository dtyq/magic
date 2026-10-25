import Topic from "../Topic"

export default function ShareContent({
	isMobile,
	data,
	attachments,
	isLogined,
	isFileShare,
	fileId,
	defaultOpenFileId,
	enableImmersiveShareChrome,
	isImmersiveFullscreen,
	projectId,
	shareCode,
	sharePassword,
	onCopySharedFilesComplete,
	topicId,
	showAllProjectFiles,
	isProjectShare,
	viewFileList,
	showCreatedByBadge,
	allowDownloadProjectFile,
	allowCopyProjectFiles,
	forceFullscreenMode,
	documentFlowFullscreen,
	hidePreviewHeader,
	showFileHeader,
	onPreviewFileChange,
	onPreviewFullscreenChange,
}: {
	isMobile: boolean
	data: any
	attachments: any
	isLogined: boolean
	isFileShare?: boolean
	fileId?: string
	defaultOpenFileId?: string
	enableImmersiveShareChrome?: boolean
	isImmersiveFullscreen?: boolean
	projectId?: string
	shareCode?: string
	sharePassword?: string
	onCopySharedFilesComplete?: (info: {
		projectId: string
		workspaceId: string
		projectName?: string
	}) => void
	topicId?: string
	showAllProjectFiles?: boolean
	isProjectShare?: boolean
	viewFileList?: boolean
	showCreatedByBadge?: boolean
	allowDownloadProjectFile?: boolean
	allowCopyProjectFiles?: boolean
	forceFullscreenMode?: boolean
	documentFlowFullscreen?: boolean
	hidePreviewHeader?: boolean
	showFileHeader?: boolean
	onPreviewFileChange?: (fileId: string | null) => void
	onPreviewFullscreenChange?: (isFullscreen: boolean) => void
}) {
	return (
		<Topic
			data={data?.data || { list: [] }}
			resource_name={data?.resource_name}
			isMobile={isMobile}
			attachments={attachments}
			isLogined={isLogined}
			isFileShare={isFileShare}
			fileId={fileId}
			defaultOpenFileId={defaultOpenFileId}
			enableImmersiveShareChrome={enableImmersiveShareChrome}
			isImmersiveFullscreen={isImmersiveFullscreen}
			topicId={topicId}
			projectId={projectId}
			shareCode={shareCode}
			sharePassword={sharePassword}
			onCopySharedFilesComplete={onCopySharedFilesComplete}
			showAllProjectFiles={showAllProjectFiles}
			isProjectShare={isProjectShare}
			viewFileList={viewFileList}
			showCreatedByBadge={showCreatedByBadge}
			allowDownloadProjectFile={allowDownloadProjectFile}
			allowCopyProjectFiles={allowCopyProjectFiles}
			forceFullscreenMode={forceFullscreenMode}
			documentFlowFullscreen={documentFlowFullscreen}
			hidePreviewHeader={hidePreviewHeader}
			showFileHeader={showFileHeader}
			onPreviewFileChange={onPreviewFileChange}
			onPreviewFullscreenChange={onPreviewFullscreenChange}
		/>
	)
}
