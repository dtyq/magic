// 导出所有hooks和类型定义
export { useRename } from "./useRename"
export { useFileOperations } from "./useFileOperations"
export { useContextMenu } from "./useContextMenu"
export { useFileSelection } from "./useFileSelection"
export { useBatchDownload } from "./useBatchDownload"
export { useShareFile } from "./useShareFile"
export { useFileFilter } from "./useFileFilter"
export { useVirtualFile } from "./useVirtualFile"
export { useVirtualFolder } from "./useVirtualFolder"
export { useVirtualDesignProject } from "./useVirtualDesignProject"
export { useTreeUI } from "./useTreeUI"
export { useTreeData } from "./useTreeData"
export { useDropHandler } from "./useDropHandler"
export { useFileListAreaDrag } from "./useFileListAreaDrag"
export { useTreeHeight } from "./useTreeHeight"
export { useMoveFile } from "./useMoveFile"
export { useFileReplace } from "./useFileReplace"
export { useDragMove, isInRootDirectory, canMoveToTarget } from "./useDragMove"
export { useAutoExpandFolder } from "./useAutoExpandFolder"
export { createFileDragHandlers } from "./useFileDragHandlers"
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

export type {
	AttachmentItem,
	FolderItem,
	FileOperationCallbacks,
	DragState,
	DragCallbacks,
	DropValidationResult,
	InsertPosition,
} from "./types"
