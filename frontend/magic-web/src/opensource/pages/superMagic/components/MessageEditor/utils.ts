import { ProjectFileMentionData } from "@/opensource/components/business/MentionPanel/types"
import { getFileType } from "@/opensource/pages/superMagic/utils/handleFIle"
import { JSONContent, generateText } from "@tiptap/core"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { HardBlock, SuperPlaceholderExtension } from "./extensions"
import MentionExtension from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import { TFunction } from "i18next"

interface FileDetailResult {
	type: string
	data: {
		file_name: string
		file_extension?: string
		file_id: string
		text?: string
	}
	currentFileId?: string
}

/**
 * Handle project file mention data and return file detail result
 * @param data Project file mention data
 * @param t Translation function for internationalization
 * @returns File detail result for preview or download
 */
export function handleProjectFileMention(
	data: ProjectFileMentionData,
	t?: TFunction<"super", undefined>,
): FileDetailResult {
	const fileName = data.file_name || ""
	const extension = data.file_extension || fileName.split(".").pop() || ""
	const fileType = getFileType(extension)

	if (fileType) {
		return {
			type: fileType,
			data: {
				file_name: fileName,
				file_extension: data.file_extension,
				file_id: data.file_id,
			},
			currentFileId: data.file_id,
		}
	}

	return {
		type: "empty",
		data: {
			file_name: fileName,
			file_id: data.file_id,
			text: t?.("detail.fileNotSupported"),
		},
	}
}

export const generateTextFromJSONContent = (value: JSONContent | undefined) => {
	if (!value || !value.content) return ""

	// Use the same extensions as the editor to properly parse the JSON content
	const extensions = [
		Document,
		Paragraph,
		Text,
		HardBlock,
		MentionExtension,
		SuperPlaceholderExtension,
	]

	return generateText(value, extensions)
}

export const isEmptyJSONContent = (value: JSONContent | undefined) => {
	return generateTextFromJSONContent(value).trim() === ""
}
