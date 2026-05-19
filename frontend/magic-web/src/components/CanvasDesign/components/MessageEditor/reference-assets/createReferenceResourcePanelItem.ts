import type { ReferenceResourcePanelItem } from "../../../types"
import type { ReferenceDropProjectFile } from "./useReferenceResourcePanelDataService"

export function getFileExtension(filePath: string): string {
	const lastDotIndex = filePath.lastIndexOf(".")
	if (lastDotIndex < 0) return ""
	return filePath.slice(lastDotIndex + 1)
}

export function createReferenceResourcePanelItemFromPath(
	path: string,
	fileName: string,
): ReferenceResourcePanelItem {
	return {
		type: "project_file",
		data: {
			file_id: path,
			file_name: fileName,
			file_path: path,
			file_extension: getFileExtension(path),
		},
	}
}

export function createReferenceResourcePanelItemFromDropFile(
	file: ReferenceDropProjectFile,
): ReferenceResourcePanelItem {
	return createReferenceResourcePanelItemFromPath(file.path, file.fileName)
}
