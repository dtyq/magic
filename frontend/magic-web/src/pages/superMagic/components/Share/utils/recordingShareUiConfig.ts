import type { FileShareUiConfig } from "../types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { AUDIO_PROJECT_MODE } from "@/services/audioRecordings/audioProjectMode"

/**
 * Returns the canonical recording-share UI policy so every entry point uses the same affordances.
 */
export function createRecordingShareUiConfig(
	options: {
		dependencyAttachments?: AttachmentItem[]
		dependencyBundleRootPath?: string
	} = {},
): FileShareUiConfig {
	return {
		dependencyAttachments: options.dependencyAttachments,
		dependencyBundleRootPath: options.dependencyBundleRootPath,
		analyzeSelectedDocuments: true,
		autoIncludeDocumentDependencies: true,
		projectMode: AUDIO_PROJECT_MODE,
		hideShareProjectToggle: true,
		hideShowFileListSetting: true,
		forceViewFileList: false,
		showSelectAll: false,
		lockShareProject: true,
		useRecordingShareCreateTitle: true,
		hideManageShareLinks: true,
	}
}
