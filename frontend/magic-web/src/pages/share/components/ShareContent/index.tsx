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
	topicId,
	showAllProjectFiles,
	isProjectShare,
	viewFileList,
	showCreatedByBadge,
	allowDownloadProjectFile,
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
	topicId?: string
	showAllProjectFiles?: boolean
	isProjectShare?: boolean
	viewFileList?: boolean
	showCreatedByBadge?: boolean
	allowDownloadProjectFile?: boolean
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
			showAllProjectFiles={showAllProjectFiles}
			isProjectShare={isProjectShare}
			viewFileList={viewFileList}
			showCreatedByBadge={showCreatedByBadge}
			allowDownloadProjectFile={allowDownloadProjectFile}
			onPreviewFileChange={onPreviewFileChange}
			onPreviewFullscreenChange={onPreviewFullscreenChange}
		/>
	)
}
