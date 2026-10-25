/**
 * Development opens message files in the files workspace.
 * Preview and published pages open them in PreviewDetailPopup.
 */
export function shouldOpenMessageFileInFilesWorkspace(pageMode: string): boolean {
	return pageMode !== "preview"
}
