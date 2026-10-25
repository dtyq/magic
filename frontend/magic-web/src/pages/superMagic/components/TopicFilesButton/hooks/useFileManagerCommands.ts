import { useEffect, useSyncExternalStore, type KeyboardEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { isMac } from "@/utils/devices"
import magicToast from "@/components/base/MagicToaster/utils"
import type { FileManagerActions, FileManagerProps } from "../components/FileManager/types"
import {
	fileManagerTransfer,
	getFileManagerTransferIds,
	getFileManagerChangedIds,
} from "../utils/file-manager-transfer"
import { isDescendantByParentMap, type AttachmentIndex } from "../utils/attachmentIndex"
import type { TopicFilesMenuItem } from "../utils/menu-items"
import type { AttachmentItem } from "./types"
import type { useFileManagerOperations } from "./useFileManagerOperations"

export function useFileManagerCommands({
	props,
	index,
	directoryId,
	selectedIds,
	operations,
	ready,
	onOpen,
	onSelectAll,
}: {
	props: FileManagerProps
	index: AttachmentIndex
	directoryId: string | null
	selectedIds: Set<string>
	operations: ReturnType<typeof useFileManagerOperations>
	ready: boolean
	onOpen: (file: AttachmentItem) => void
	onSelectAll: () => void
}) {
	const { t } = useTranslation("super")
	const clipboard = useSyncExternalStore(
		fileManagerTransfer.subscribe,
		fileManagerTransfer.getClipboard,
	)
	useEffect(() => {
		fileManagerTransfer.activateIdentity(props.identityKey)
	}, [props.identityKey])
	const ids = getFileManagerTransferIds(selectedIds, index)
	const files = ids.flatMap((id) => {
		const file = index.getItemById(id)
		return file ? [file] : []
	})
	const writable = ready && !operations.busy && Boolean(props.allowEdit)
	const mutableSelection = files.length > 0 && files.every(operations.isMutable)
	const canTransfer = useMemoizedFn(
		(fileIds: string[], targetId: string, mode: "move" | "copy") => {
			if (
				!writable ||
				props.rootId === null ||
				!fileIds.length ||
				!(mode === "copy" ? operations.capabilities.copy : operations.capabilities.move)
			)
				return false
			if (targetId !== props.rootId && !index.getItemById(targetId)?.is_directory)
				return false
			return (
				getFileManagerChangedIds(fileIds, index, props.rootId, targetId, mode).length > 0 &&
				fileIds.every((id) => {
					const file = index.getItemById(id)
					return (
						file &&
						(mode === "copy" || operations.isMutable(file)) &&
						id !== targetId &&
						!isDescendantByParentMap(index, id, targetId)
					)
				})
			)
		},
	)
	const transfer = useMemoizedFn((fileIds: string[], targetId: string, mode: "move" | "copy") => {
		const normalized = getFileManagerTransferIds(fileIds, index)
		if (props.rootId === null || !canTransfer(normalized, targetId, mode)) return
		const changed = getFileManagerChangedIds(normalized, index, props.rootId, targetId, mode)
		if (!changed.length) return
		void operations
			.transfer(normalized, targetId, mode)
			.catch(() => magicToast.error(t("userSpace.operationFailed")))
	})
	const isAvailable: FileManagerActions["canExecute"] = (command) => {
		switch (command) {
			case "open":
				return files.length === 1
			case "download":
				return files.length > 0 && props.allowDownload !== false
			case "copy":
				return files.length > 0 && operations.capabilities.copy
			case "rename":
				return writable && mutableSelection && files.length === 1
			case "cut":
			case "move":
				return writable && mutableSelection && operations.capabilities.move
			case "trash":
				return writable && mutableSelection
			case "createFolder":
				return writable
			case "upload":
				return writable && operations.capabilities.upload
			case "paste":
			case "pasteMove":
				return Boolean(
					directoryId !== null &&
					clipboard &&
					clipboard.scopeKey === props.scopeKey &&
					canTransfer(
						clipboard.fileIds,
						directoryId,
						command === "pasteMove" ? "move" : clipboard.mode,
					),
				)
		}
	}
	const getDisabledReason: FileManagerActions["getDisabledReason"] = (command) => {
		if (!props.isActive || !ready) return t("fileManager.clipboard.unavailable")
		if (operations.busy) return t("fileManager.processing")
		if (isAvailable(command)) return undefined
		if (command === "paste" || command === "pasteMove") {
			if (!clipboard) return t("fileManager.clipboard.empty")
			if (clipboard.scopeKey !== props.scopeKey) return t("fileManager.clipboard.otherSpace")
			if (!props.allowEdit) return t("fileManager.clipboard.readOnly")
			return t("fileManager.clipboard.invalidTarget")
		}
		if (!files.length && !["createFolder", "upload"].includes(command))
			return t("fileManager.clipboard.selectItems")
		return t("fileManager.clipboard.unavailable")
	}
	const canExecute: FileManagerActions["canExecute"] = (command) => !getDisabledReason(command)
	const shortcuts = {
		cut: isMac ? "⌘X" : "Ctrl+X",
		copy: isMac ? "⌘C" : "Ctrl+C",
		paste: isMac ? "⌘V" : "Ctrl+V",
	}
	const execute = useMemoizedFn<FileManagerActions["execute"]>((command) => {
		const reason = getDisabledReason(command)
		if (reason) {
			magicToast.info(reason)
			return
		}
		switch (command) {
			case "open":
				onOpen(files[0])
				break
			case "rename":
				operations.names.rename.handleStartRename(files[0])
				break
			case "createFolder":
				operations.createFolder()
				break
			case "upload":
				operations.uploadFile()
				break
			case "download":
				void operations.batch.handleBatchDownload()
				break
			case "trash":
				void operations.batch.deleteWithConfirm(files)
				break
			case "move":
				operations.moveTo(ids)
				break
			case "cut":
			case "copy":
				fileManagerTransfer.setClipboard({
					scopeKey: props.scopeKey,
					fileIds: ids,
					mode: command === "cut" ? "move" : "copy",
				})
				magicToast.success(
					command === "cut"
						? t("fileManager.clipboard.cut", { count: ids.length })
						: t("fileManager.clipboard.copied", { count: ids.length }),
				)
				break
			case "paste":
			case "pasteMove":
				if (clipboard && directoryId !== null)
					transfer(
						clipboard.fileIds,
						directoryId,
						command === "pasteMove" ? "move" : clipboard.mode,
					)
				break
		}
	})
	// 仅接管当前管理器的文件快捷键；文本编辑、菜单和弹窗保留自己的键盘语义。
	const onClipboardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const target = event.target
		if (
			!props.isActive ||
			event.defaultPrevented ||
			event.nativeEvent.isComposing ||
			!(target instanceof HTMLElement) ||
			!event.currentTarget.contains(target) ||
			target.closest(
				"input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=alertdialog], [role=menu]",
			) ||
			!(event.metaKey || event.ctrlKey) ||
			event.shiftKey
		)
			return
		const key = event.key.toLowerCase()
		if (!["c", "x", "v"].includes(key)) return
		const movePaste = isMac && event.metaKey && !event.ctrlKey && event.altKey && key === "v"
		if (event.altKey && !movePaste) return
		event.preventDefault()
		if (!event.repeat)
			execute(key === "c" ? "copy" : key === "x" ? "cut" : movePaste ? "pasteMove" : "paste")
	}
	const clipboardMenu = (): TopicFilesMenuItem[] => [
		{
			key: "manager-cut",
			label: `${t("fileManager.cut")}  ${shortcuts.cut}`,
			disabled: !canExecute("cut"),
			onClick: () => execute("cut"),
		},
		{
			key: "manager-copy",
			label: `${t("fileManager.copy")}  ${shortcuts.copy}`,
			disabled: !canExecute("copy"),
			onClick: () => execute("copy"),
		},
		{
			key: "manager-paste",
			label: `${t("fileManager.paste")}  ${shortcuts.paste}`,
			disabled: !canExecute("paste"),
			onClick: () => execute("paste"),
		},
	]
	const getMenuItems = (file?: AttachmentItem): TopicFilesMenuItem[] => {
		if (!file)
			return [
				...operations.menu.getBatchDownloadLayerMenuItems(),
				{ type: "divider" },
				...clipboardMenu().slice(2),
				{ key: "manager-selectAll", label: t("userSpace.selectAll"), onClick: onSelectAll },
			]
		const base =
			selectedIds.size > 1
				? [
						...(operations.batch.batchMenuItems ?? []),
						...operations.menu
							.getMenuItems(file)
							.filter(
								(item) =>
									item &&
									["addToCurrentChat", "addToNewChat"].includes(String(item.key)),
							),
					]
				: operations.menu.getMenuItems(file)
		return [...base, { type: "divider" }, ...clipboardMenu()]
	}
	return {
		execute,
		canExecute,
		getDisabledReason,
		shortcuts,
		onClipboardKeyDown,
		getMenuItems,
		canTransfer,
		transfer,
		cutIds: new Set(
			clipboard?.scopeKey === props.scopeKey && clipboard.mode === "move"
				? clipboard.fileIds
				: [],
		),
		cancelClipboard: () => {
			if (clipboard?.scopeKey !== props.scopeKey || clipboard.mode !== "move") return false
			fileManagerTransfer.setClipboard(null)
			return true
		},
	}
}
