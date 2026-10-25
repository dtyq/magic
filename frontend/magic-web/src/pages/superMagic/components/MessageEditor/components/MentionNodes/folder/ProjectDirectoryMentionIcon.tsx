import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
import type { DirectoryMentionData } from "@/components/business/MentionPanel/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import {
	getFilePresentationIndex,
	resolveFilePresentation,
} from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"

interface ProjectDirectoryMentionIconProps {
	context?: FileHelpContext
	data: DirectoryMentionData
	workspaceFilesList: AttachmentItem[]
	size?: number
}

function createFallbackDirectory(data: DirectoryMentionData): AttachmentItem {
	return {
		file_id: data.directory_id,
		project_id: data.project_id,
		source_project_id: data.source_project_id,
		file_name: data.directory_name,
		relative_file_path: data.directory_path,
		is_directory: true,
		type: "directory",
		display_config: data.directory_metadata,
		children: [],
	}
}

/** Resolve a project directory's icon from the same attachment data used by the file tree. */
export function ProjectDirectoryMentionIcon({
	context,
	data,
	workspaceFilesList,
	size = 16,
}: ProjectDirectoryMentionIconProps) {
	const index =
		context?.kind === "user" ? undefined : getFilePresentationIndex(workspaceFilesList)
	const directory = {
		...createFallbackDirectory(data),
		space_type: context?.kind === "user" ? ("user" as const) : undefined,
	}

	return (
		<FileResourceIcon
			presentation={resolveFilePresentation(directory, { index, context })}
			size={size}
		/>
	)
}
