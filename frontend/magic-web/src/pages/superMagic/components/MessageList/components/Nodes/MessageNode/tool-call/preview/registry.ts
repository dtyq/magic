import { fileNameFromPath } from "@/pages/superMagic/components/MessageList/utils/attachmentByFilePath"
import {
	createStreamingJsonStringFieldParser,
	type CreateStreamingJsonStringFieldParserOptions,
} from "./streamingJsonStringField"
import { createStreamingJsonArrayObjectStringFieldParser } from "./streamingJsonArrayObjectField"
import type { ToolRemarkPreviewParser } from "./types"

export interface ToolRemarkPreviewStrategy {
	createParser: () => ToolRemarkPreviewParser
}

interface CreateJsonFieldRemarkStrategyOptions extends Omit<
	CreateStreamingJsonStringFieldParserOptions,
	"transform"
> {
	transform?: (value: string) => string
}

export function createJsonFieldRemarkStrategy({
	field,
	transform,
	scanLimit,
}: CreateJsonFieldRemarkStrategyOptions): ToolRemarkPreviewStrategy {
	return {
		createParser: () =>
			createStreamingJsonStringFieldParser({
				field,
				transform,
				scanLimit,
			}),
	}
}

// Tool-specific argument semantics live in this registry so the rendering component
// only consumes a generic preview and remains closed to future tool additions.
const filePathFilenameRemarkStrategy = createJsonFieldRemarkStrategy({
	field: "file_path",
	transform: (filePath) => fileNameFromPath(filePath.replace(/\\/g, "/")),
})
const readFilesRemarkStrategy: ToolRemarkPreviewStrategy = {
	createParser: () =>
		createStreamingJsonArrayObjectStringFieldParser({
			arrayField: "operations",
			itemField: "file_path",
			transformItem: (filePath) => fileNameFromPath(filePath.replace(/\\/g, "/")),
			format: (fileNames) => fileNames.join("、"),
		}),
}
const purposeRemarkStrategy = createJsonFieldRemarkStrategy({ field: "purpose" })
const commandRemarkStrategy = createJsonFieldRemarkStrategy({ field: "command" })

const toolRemarkPreviewStrategies: Readonly<Record<string, ToolRemarkPreviewStrategy>> = {
	write_file: filePathFilenameRemarkStrategy,
	edit_file: filePathFilenameRemarkStrategy,
	multi_edit_file: filePathFilenameRemarkStrategy,
	find_file_ranges: filePathFilenameRemarkStrategy,
	read_files: readFilesRemarkStrategy,
	run_python_snippet: purposeRemarkStrategy,
	shell_exec: commandRemarkStrategy,
}

export function getToolRemarkPreviewStrategy(
	toolName?: string,
): ToolRemarkPreviewStrategy | undefined {
	return toolName ? toolRemarkPreviewStrategies[toolName] : undefined
}
