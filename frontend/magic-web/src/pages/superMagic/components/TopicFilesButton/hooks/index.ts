// 导出所有hooks和类型定义
export { useRename } from "./useRename"
export { useFileOperations } from "./useFileOperations"
export { useContextMenu } from "./useContextMenu"
export { useFileInfoPanel } from "./useFileInfoPanel"
export { useFileSelection } from "./useFileSelection"
export { useBatchDownload } from "./useBatchDownload"
export { useShareFile } from "./useShareFile"
export { useFileFilter } from "./useFileFilter"
export { useVirtualFile } from "./useVirtualFile"
export { useVirtualFolder } from "./useVirtualFolder"
export { useVirtualDesignProject } from "./useVirtualDesignProject"
export { useVirtualSelfMediaProject } from "./useVirtualSelfMediaProject"
export { useVirtualAICardProject } from "./useVirtualAICardProject"
export { useTreeUI } from "./useTreeUI"
export { useTreeData } from "./useTreeData"
export { useAttachmentIndex } from "./useAttachmentIndex"
export { useVisibleTreeRows } from "./useVisibleTreeRows"
export { useTopicFilesTreeDerivation } from "./useTopicFilesTreeDerivation"
export { useTopicFilesPerfSession, measureMergedFilesBuild } from "./useTopicFilesPerf"
export { useDropHandler } from "./useDropHandler"
export { useFileListAreaDrag } from "./useFileListAreaDrag"
export { useTreeHeight } from "./useTreeHeight"
export { useMoveFile } from "./useMoveFile"
export { useCrossProjectMoveCompensation } from "./useCrossProjectMoveCompensation"
export { useFileReplace } from "./useFileReplace"
export { useDragMove, isInRootDirectory, canMoveToTarget } from "./useDragMove"
export { useAutoExpandFolder } from "./useAutoExpandFolder"
export { createFileDragHandlers } from "./useFileDragHandlers"
export { useStableTreeNodeDragHandlers } from "./useStableTreeNodeDragHandlers"
export { useTopicFileRowRenderVersion } from "./useTopicFileRowRenderVersion"
export { useSelfMediaTreeNavigation } from "./useSelfMediaTreeNavigation"
export { useAICardTreeNavigation } from "./useAICardTreeNavigation"
export {
	useSelectedFilesManager,
	findFileById,
	collectSelectedFiles,
} from "./useSelectedFilesManager"

// 导出文件选择工具函数
export {
	findFileInTree,
	flattenAttachments,
	getAllDescendantIds,
	getParentId,
	getSiblingIds,
	isNodeSelected,
} from "./fileSelectionUtils"

export { useCopyFileSelector } from "./useCopyFileSelector"

export type {
	AttachmentItem,
	FolderItem,
	FileOperationCallbacks,
	DragState,
	DragCallbacks,
	DropValidationResult,
	InsertPosition,
} from "./types"
