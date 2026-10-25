import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { MenuProps } from "antd"
import { MagicFSApi, type MagicFSFile } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import userFilesStore from "@/stores/userFiles"
import { createFileReferenceMention } from "@/components/business/MentionPanel/utils/fileReferenceMention"
import type { TopicFilesSpaceConfig } from "../../TopicFilesButton/file-space"
import type { AttachmentItem } from "../../TopicFilesButton/hooks/types"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import { isFixedUserMemoryEntry } from "../../LongTremMemory/components/memoryTreeNodeUtils"
import { toUserAttachment } from "../services/userSpaceFileService"

/** 仅适配用户目录与保护回调；创建、选择、重命名及弹窗状态由 TopicFilesCore 持有。 */
export function useUserSpaceFileActions(options: {
	rootId?: string
	resolveParent: () => Promise<MagicFSFile>
	viewKey: string
	locateFileId?: string
	topicId?: string | null
}) {
	const { t } = useTranslation("super")
	const identity = getFileReferenceIdentityKey()
	const currentView = useRef(options.viewKey)
	currentView.current = options.viewKey
	useEffect(
		() => () => {
			currentView.current = ""
		},
		[],
	)
	const isCurrent = () => Boolean(identity) && identity === getFileReferenceIdentityKey()
	const assertCurrent = () => {
		if (!isCurrent()) throw new DOMException("File operation cancelled", "AbortError")
	}
	const attachment = (file: MagicFSFile) =>
		toUserAttachment(
			file,
			userFilesStore
				.getPath(file.id)
				.map((node) => node.name)
				.join("/"),
		)
	const isSelectable = (file: AttachmentItem) =>
		Boolean(file.file_id) &&
		(!file.is_directory ||
			!isFixedUserMemoryEntry(
				file.file_reference?.space_relative_path ?? file.relative_file_path ?? "",
				true,
			))
	const refresh = (parents: Array<string | undefined>) => {
		if (!isCurrent()) return
		userFilesStore.notifyMutation()
		void Promise.all(
			[...new Set(parents.filter((id): id is string => Boolean(id)))].map((id) =>
				userFilesStore.loadDirectory(id, true),
			),
		).catch(() => {
			if (isCurrent()) magicToast.error(t("userSpace.refreshAfterChangeFailed"))
		})
	}
	const resolveParent = async (item?: AttachmentItem) => {
		assertCurrent()
		if (!item?.file_id || item.file_id === options.rootId) return options.resolveParent()
		const file = userFilesStore.files.get(item.file_id)
		if (!file?.is_directory) throw new Error("Directory is unavailable")
		return file
	}
	const root = userFilesStore.rootId ? userFilesStore.files.get(userFilesStore.rootId) : undefined
	const viewKey = options.viewKey
	const loadDirectory = useMemoizedFn((id: string) => userFilesStore.loadDirectory(id, true))
	const resolveCreateParent = async (parentPath?: string) => {
		assertCurrent()
		const path = parentPath?.split("/").filter(Boolean)
		const parent = path?.length ? await userFilesStore.findPath(path) : undefined
		if (path?.length && !parent) throw new Error("Directory is unavailable")
		const target = await resolveParent(parent ? attachment(parent) : undefined)
		assertCurrent()
		return target.id
	}
	const spaceConfig: TopicFilesSpaceConfig = {
		scope: "user",
		capabilities: {
			upload: true,
			move: true,
			replace: false,
			share: false,
			addToChat: Boolean(options.topicId),
			crossProject: false,
			copy: true,
			importFromOtherProject: false,
			projectContentCreation: false,
		},
		chatContext: {
			fileSpaceType: "user",
			createAttachmentMention: async (file) => {
				assertCurrent()
				const mention = await createFileReferenceMention(file)
				assertCurrent()
				return mention
			},
		},
		directorySource:
			root && identity
				? {
						root: {
							...attachment(root),
							file_name: t("userSpace.title"),
							name: t("userSpace.title"),
						},
						identityKey: identity,
						expandedKeys: userFilesStore.expandedKeys.get(options.rootId ?? "") ?? [],
						onExpandedKeysChange: (keys) => {
							if (options.rootId && isCurrent())
								userFilesStore.setExpandedKeys(options.rootId, keys.map(String))
						},
						locateFileId: options.locateFileId,
						loadDirectory,
						getPath: (id) => userFilesStore.getPath(id).map(attachment),
						loadChildren: async (id, signal) => {
							const { files } = await MagicFSApi.listFiles(
								{ scope: "user", parent_id: id },
								{ signal },
							)
							assertCurrent()
							userFilesStore.cacheDirectory(id, files, identity)
							return files.map(attachment)
						},
					}
				: undefined,
		operations: {
			isCurrent,
			allowDotStart: true,
			resolveCreateParent,
			resolveCreateSiblings: async (parentPath) => {
				const parentId = await resolveCreateParent(parentPath)
				const files = await userFilesStore.loadDirectory(parentId, true)
				assertCurrent()
				return files.map(attachment)
			},
			onNodeCreated: async (file) => {
				assertCurrent()
				const children = await userFilesStore.loadDirectory(
					file.parent_id ?? undefined,
					true,
				)
				assertCurrent()
				const created = children.find((item) => item.id === file.file_id)
				if (!created) throw new Error("Created file is unavailable")
				userFilesStore.notifyMutation()
				return attachment(created)
			},
			resolveSiblings: async (file) => {
				const files = await userFilesStore.loadDirectory(file.parent_id ?? undefined, true)
				assertCurrent()
				return files.map(attachment)
			},
			beforeRename: async (file, name) => {
				if (!file.file_id || !isSelectable(file)) return false
				if (
					!file.is_directory &&
					name.split(".").pop() !== file.file_name?.split(".").pop()
				)
					return userFilesStore.confirmFileChanges([file.file_id])
				return true
			},
			onRenameSuccess: (id) => refresh([userFilesStore.files.get(id)?.parent_id]),
			resolveDeleteItems: async (selected) => {
				const trees = await userFilesStore.loadSubtrees(selected.filter(isSelectable))
				if (viewKey !== currentView.current)
					throw new DOMException("Directory changed", "AbortError")
				return trees
			},
			beforeDelete: async (ids) =>
				(await userFilesStore.confirmFileChanges(ids)) && viewKey === currentView.current,
			onFilesDeleted: (ids) => {
				const parents = ids.map((id) => userFilesStore.files.get(id)?.parent_id)
				userFilesStore.removeFiles(ids)
				refresh(parents.filter((id) => id && userFilesStore.files.has(id)))
			},
			onDirectoryMoveComplete: (files, targetId) =>
				refresh([targetId, ...files.map((file) => file.parent_id ?? undefined)]),
			resolveUploadTarget: async (item) => {
				const parent = await resolveParent(item)
				assertCurrent()
				const children = await userFilesStore.loadDirectory(parent.id, true)
				assertCurrent()
				return {
					parentId: parent.id,
					attachments: [{ ...attachment(parent), children: children.map(attachment) }],
					isCurrent,
					onTaskCreated: userFilesStore.trackUpload,
					onTaskFinished: userFilesStore.finishUpload,
					onUpdateAttachments: () => refresh([parent.id]),
				}
			},
		},
	}
	const filterMenuItems = (items: NonNullable<MenuProps["items"]>, file?: AttachmentItem) =>
		items.filter((item) => {
			if (!item || item.type === "divider") return Boolean(item)
			if (
				["downloadFolder", "addToNewChat", "addSelectedToNewChat"].includes(
					String(item.key),
				)
			)
				return false
			return (
				!file ||
				isSelectable(file) ||
				!["rename", "moveFile", "delete"].includes(String(item.key))
			)
		})
	return { spaceConfig, isSelectable, filterMenuItems }
}
