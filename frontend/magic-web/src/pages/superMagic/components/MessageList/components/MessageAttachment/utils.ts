export const getAttachmentType = (metadata: any): any => {
	const { type } = metadata || {}
	if (type === "slide") {
		return "ppt"
	}
	return metadata?.type
}
export const getAttachmentExtension = (metadata: any): any => {
	const { type } = metadata || {}
	if (type === "slide") {
		return "pptx"
	}
	return metadata?.type
}

export const getAppEntryFile = (treeNode: Array<any>): any => {
	const appEntryFile = treeNode?.find((item) => item?.name === "index.html")
	return appEntryFile
}
