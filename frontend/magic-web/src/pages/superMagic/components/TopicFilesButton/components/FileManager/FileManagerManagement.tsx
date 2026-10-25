import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { flushSync } from "react-dom"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { useFileManagerOperations } from "../../hooks/useFileManagerOperations"
import { useFileManagerCommands } from "../../hooks/useFileManagerCommands"
import { useFileManagerGestures } from "../../hooks/useFileManagerGestures"
import type { useFileManagerSelection } from "../../hooks/useFileManagerSelection"
import type { AttachmentItem } from "../../hooks/types"
import type { AttachmentIndex } from "../../utils/attachmentIndex"
import { resolveFilePresentation, getFilePresentationIndex } from "../../utils/file-presentation"
import { fileManagerTransfer } from "../../utils/file-manager-transfer"
import { FileManagerDragPreview } from "./FileManagerDragPreview"
import { FileManagerDialogs } from "./FileManagerDialogs"
import type { FileManagerProps } from "./types"

export interface FileManagerManagementState {
	operations: ReturnType<typeof useFileManagerOperations>
	commands: ReturnType<typeof useFileManagerCommands>
	gestures: ReturnType<typeof useFileManagerGestures>
	status: string
}
interface Props {
	manager: FileManagerProps
	index: AttachmentIndex
	presentationIndex: ReturnType<typeof getFilePresentationIndex>
	directory?: AttachmentItem
	directoryId: string | null
	selection: ReturnType<typeof useFileManagerSelection>
	ids: string[]
	container: RefObject<HTMLDivElement>
	viewport: RefObject<HTMLDivElement>
	onOpen: (file: AttachmentItem) => void
	onNavigate: (id: string) => void
	ready: boolean
	children: (state: FileManagerManagementState) => ReactNode
}

/** 只在管理模式挂载写操作、剪贴板与拖拽生命周期；勾选模式共用视图，不初始化这些操作。 */
export function FileManagerManagement({
	manager,
	index,
	presentationIndex,
	directory,
	directoryId,
	selection,
	ids,
	container,
	viewport,
	onOpen,
	onNavigate,
	ready,
	children,
}: Props) {
	const { t } = useTranslation("super")
	const dragPreview = useRef<HTMLDivElement>(null)
	const [dragPreviewIds, setDragPreviewIds] = useState<string[]>([])
	const operations = useFileManagerOperations({
		props: manager,
		index,
		directory,
		selectedIds: selection.selectedIds,
		setSelectedIds: selection.replace,
		onOpen,
		onMoveComplete: (fileIds) => fileManagerTransfer.completeMove(manager.scopeKey, fileIds),
	})
	const cancelRename = useMemoizedFn(() => {
		if (!operations.names.rename.isRenamePending()) operations.names.rename.handleRenameCancel()
	})
	useEffect(cancelRename, [directoryId, manager.isActive, cancelRename])
	const commands = useFileManagerCommands({
		props: manager,
		index,
		directoryId: directoryId,
		selectedIds: selection.selectedIds,
		operations,
		ready: ready,
		onOpen,
		onSelectAll: selection.all,
	})
	const gestures = useFileManagerGestures({
		scopeKey: manager.scopeKey,
		rootId: manager.rootId,
		directoryId: directoryId,
		isActive: manager.isActive && !operations.busy,
		container,
		viewport,
		index,
		ids,
		selectedIds: selection.selectedIds,
		select: selection.replace,
		canTransfer: commands.canTransfer,
		onTransfer: commands.transfer,
		onExternalDrop: (data, target) => void operations.externalDrop(data, target),
		allowUpload: Boolean(manager.allowEdit && operations.capabilities.upload),
		onNavigate: onNavigate,
		prepareDragImage: (fileIds) => {
			// setDragImage 必须在 dragstart 同步执行，不能等待下一次 React 提交。
			flushSync(() => setDragPreviewIds(fileIds))
			return dragPreview.current
		},
		clearDragImage: () => setDragPreviewIds((current) => (current.length ? [] : current)),
	})
	const dragging = fileManagerTransfer.getDragging()
	const targetFile = gestures.dropTarget ? index.getItemById(gestures.dropTarget) : undefined
	const targetName =
		gestures.dropTarget === manager.rootId
			? manager.rootName
			: targetFile
				? resolveFilePresentation(targetFile, {
						context: manager.context,
						index: presentationIndex,
					}).name
				: ""
	const preparation = operations.transferPreparation
	const status =
		preparation?.phase === "checking"
			? t(
					preparation.mode === "move"
						? "fileManager.preparation.checkingMove"
						: "fileManager.preparation.checkingCopy",
				)
			: operations.crossProject.isOperating
				? t("fileManager.operationProgress", {
						progress: operations.crossProject.operationProgress,
					})
				: operations.move.isMoving
					? t("fileManager.operationProgress", { progress: operations.move.moveProgress })
					: operations.busy
						? t("fileManager.processing")
						: gestures.dropTarget !== null
							? !dragging
								? t("fileManager.uploadTarget", { target: targetName })
								: gestures.dragMode === "copy"
									? t("fileManager.copyTarget", {
											count: dragging.fileIds.length,
											target: targetName,
										})
									: t("fileManager.moveTarget", {
											count: dragging.fileIds.length,
											target: targetName,
										})
							: t("fileManager.selectionHint")
	return (
		<>
			{children({ operations, commands, gestures, status })}
			{dragPreviewIds.length > 0 && (
				<FileManagerDragPreview
					ref={dragPreview}
					count={dragPreviewIds.length}
					files={dragPreviewIds.slice(0, 3).flatMap((id) => {
						const file = index.getItemById(id)
						return file
							? [
									resolveFilePresentation(file, {
										context: manager.context,
										index: presentationIndex,
									}),
								]
							: []
					})}
				/>
			)}
			<FileManagerDialogs manager={manager} controller={operations} />
		</>
	)
}
