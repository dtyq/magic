import Topic from "../Topic"

export default function ShareContent({
	isMobile,
	data,
	attachments,
	isLogined,
	isFileShare,
	fileId,
	defaultOpenFileId,
	projectId,
	topicId,
	showAllProjectFiles,
	isProjectShare,
	viewFileList,
	showCreatedByBadge,
	allowDownloadProjectFile,
}: {
	isMobile: boolean
	data: any
	attachments: any
	isLogined: boolean
	isFileShare?: boolean
	fileId?: string
	defaultOpenFileId?: string
	projectId?: string
	topicId?: string
	showAllProjectFiles?: boolean
	isProjectShare?: boolean
	viewFileList?: boolean
	showCreatedByBadge?: boolean
	allowDownloadProjectFile?: boolean
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
			topicId={topicId}
			projectId={projectId}
			showAllProjectFiles={showAllProjectFiles}
			isProjectShare={isProjectShare}
			viewFileList={viewFileList}
			showCreatedByBadge={showCreatedByBadge}
			allowDownloadProjectFile={allowDownloadProjectFile}
		/>
	)
}
