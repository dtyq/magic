import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import {
	DirectoryMentionData,
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type {
	MentionDeletionInput,
	MentionListItem,
	MentionRemoveItemPayload,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { logger as Logger } from "@/infrastructure/logger"
import type { FileData } from "../types"
import type { FileUploadStore } from "../stores/FileUploadStore"
import {
	collectMentionItemsFromContent as collectMentionItemsFromContentService,
	collectMentionItemsFromEditor as collectMentionItemsFromEditorService,
	deleteProjectFile as deleteProjectFileService,
	insertUploadMentionNodes as insertUploadMentionNodesService,
	removeUploadMentionNodes as removeUploadMentionNodesService,
	replaceUploadMentionNode as replaceUploadMentionNodeService,
} from "../services/uploadMentionService"
import { isPendingProjectFileMention } from "../utils/mention"

const logger = Logger.createLogger("SuperMagicMessageEditor")

interface UseUploadMentionFlowParams {
	fileUploadStore: FileUploadStore
	mentionPanelStore?: Pick<MentionPanelStore, "setUploadFiles">
	getEditor: () => Editor | null
	isProjectContext: boolean
	isQueueDraftMode?: boolean
	confirmDelete?: boolean
	onFileUpload?: (files: FileData[]) => void
	runWithoutMentionRemoveSync: (callback: () => void) => void
	selectedProjectId?: string
	selectedTopicId?: string
	t: (key: string, options?: Record<string, unknown>) => string
}

export default function useUploadMentionFlow({
	fileUploadStore,
	mentionPanelStore,
	getEditor,
	isProjectContext,
	isQueueDraftMode = false,
	confirmDelete = true,
	onFileUpload,
	runWithoutMentionRemoveSync,
	selectedProjectId,
	selectedTopicId,
	t,
}: UseUploadMentionFlowParams) {
	const collectMentionItemsFromContent = useMemoizedFn(
		(content?: JSONContent): MentionListItem[] =>
			collectMentionItemsFromContentService(content),
	)

	const collectMentionItemsFromEditor = useMemoizedFn((): MentionListItem[] =>
		collectMentionItemsFromEditorService(getEditor()),
	)

	const insertUploadMentionNodes = useMemoizedFn((fileDatas: FileData[]) => {
		insertUploadMentionNodesService({ editor: getEditor(), fileDatas })
	})

	const replaceUploadMentionNode = useMemoizedFn(
		(
			fileId: string,
			reportResult: FileData["reportResult"],
			saveResult: FileData["saveResult"],
		) => {
			runWithoutMentionRemoveSync(() => {
				replaceUploadMentionNodeService({
					editor: getEditor(),
					fileId,
					reportResult,
					saveResult,
					isProjectContext,
				})
			})
		},
	)

	const deleteProjectFile = useMemoizedFn(async (fileId?: string) => {
		await deleteProjectFileService({
			fileId,
			logger,
			onError: () => {
				magicToast.error(t("topicFiles.contextMenu.deleteFileFailed"))
			},
		})
	})

	const isCurrentSessionUpload = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		if (mentionAttrs.type === MentionItemType.UPLOAD_FILE) {
			const fileId = (mentionAttrs.data as UploadFileMentionData).file_id
			return fileUploadStore.isCurrentSessionUploadFile(fileId)
		}

		if (mentionAttrs.type === MentionItemType.PROJECT_FILE) {
			const fileId = (mentionAttrs.data as ProjectFileMentionData).file_id
			return fileUploadStore.isCurrentSessionProjectFile(fileId)
		}

		if (mentionAttrs.type === MentionItemType.FOLDER) {
			const directoryId = (mentionAttrs.data as DirectoryMentionData).directory_id
			return fileUploadStore.isCurrentSessionProjectFile(directoryId)
		}

		return false
	})

	const getMentionFileName = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		if (mentionAttrs.type === MentionItemType.UPLOAD_FILE) {
			return (mentionAttrs.data as UploadFileMentionData).file_name
		}

		if (mentionAttrs.type === MentionItemType.PROJECT_FILE) {
			return (mentionAttrs.data as ProjectFileMentionData).file_name
		}

		if (mentionAttrs.type === MentionItemType.FOLDER) {
			return (mentionAttrs.data as DirectoryMentionData).directory_name
		}

		return ""
	})

	// 粘贴得到的引用不拥有原文件；删除监听和删除处理必须使用同一判定。
	const isPastedFileReference = useMemoizedFn((attrs: TiptapMentionAttributes) => {
		if (isPendingProjectFileMention(attrs)) return true
		if (attrs.type !== MentionItemType.UPLOAD_FILE) return false
		return Boolean(
			fileUploadStore.getFileById((attrs.data as UploadFileMentionData).file_id)
				?.isVirtualReference,
		)
	})

	const isAllowedUploadMention = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		if (mentionAttrs.type !== MentionItemType.UPLOAD_FILE) return true

		const uploadData = mentionAttrs.data as UploadFileMentionData
		const isPendingUpload =
			uploadData.upload_status === "init" || uploadData.upload_status === "uploading"

		if (!isPendingUpload) return true

		return fileUploadStore.isCurrentSessionUploadFile(uploadData.file_id)
	})

	const createMentionAttrsFromFile = useMemoizedFn(
		(file: FileData): TiptapMentionAttributes | null => {
			if (file.isVirtualReference && file.saveResult?.file_type === "directory") {
				return {
					type: MentionItemType.FOLDER,
					data: {
						directory_id: file.saveResult.file_id,
						directory_name: file.saveResult.file_name ?? file.name,
						directory_path:
							file.saveResult.relative_file_path ?? file.saveResult.file_key ?? "",
					},
				}
			}

			if (file.saveResult?.file_id && !file.isCanvasClipboard) {
				return {
					type: MentionItemType.PROJECT_FILE,
					data: {
						file_id: file.saveResult.file_id,
						file_name: file.saveResult.file_name ?? file.name,
						file_path:
							file.saveResult.relative_file_path || file.defaultRelativePath || "",
						relative_file_path:
							file.saveResult.relative_file_path || file.defaultRelativePath,
						is_hidden: file.saveResult.is_hidden ?? file.isHidden,
						file_extension: file.name.split(".").pop() ?? "",
						file_size: file.saveResult.file_size ?? file.file.size,
					},
				}
			}

			return {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: file.id,
					file_name: file.name,
					file_extension: file.name.split(".").pop() ?? "",
					file_size: file.file.size,
					file: file.file,
					upload_progress: file.progress,
					upload_status: file.status,
					upload_error: file.error,
					file_path: file.reportResult?.file_key ?? file.result?.key ?? "",
					is_canvas_clipboard: file.isCanvasClipboard,
					relative_file_path: file.defaultRelativePath,
					is_hidden: file.isHidden,
				},
			}
		},
	)

	const removeMentionNode = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		runWithoutMentionRemoveSync(() => {
			if (mentionAttrs.type === MentionItemType.UPLOAD_FILE) {
				const fileId = (mentionAttrs.data as UploadFileMentionData).file_id
				removeUploadMentionNodesService({
					editor: getEditor(),
					fileId,
				})
				return
			}

			if (mentionAttrs.type === MentionItemType.PROJECT_FILE) {
				const fileId = (mentionAttrs.data as ProjectFileMentionData).file_id
				removeUploadMentionNodesService({
					editor: getEditor(),
					fileId,
					savedFileId: fileId,
				})
			}

			if (mentionAttrs.type === MentionItemType.FOLDER) {
				const directoryId = (mentionAttrs.data as DirectoryMentionData).directory_id
				removeUploadMentionNodesService({
					editor: getEditor(),
					fileId: directoryId,
					savedFileId: directoryId,
				})
			}
		})
	})

	const executeFileDeletion = useMemoizedFn(async (mentionAttrs: TiptapMentionAttributes) => {
		removeMentionNode(mentionAttrs)

		if (mentionAttrs.type === MentionItemType.UPLOAD_FILE) {
			const fileId = (mentionAttrs.data as UploadFileMentionData).file_id
			removeFile(fileId)
			return
		}

		if (mentionAttrs.type === MentionItemType.PROJECT_FILE) {
			const fileId = (mentionAttrs.data as ProjectFileMentionData).file_id
			removeUploadedFile(fileId)
			if (isProjectContext) {
				await deleteProjectFile(fileId)
			}
		}

		if (mentionAttrs.type === MentionItemType.FOLDER) {
			const directoryId = (mentionAttrs.data as DirectoryMentionData).directory_id
			removeUploadedFile(directoryId)
		}
	})

	const removeMentionOnly = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		removeMentionNode(mentionAttrs)

		if (mentionAttrs.type === MentionItemType.UPLOAD_FILE) {
			const fileId = (mentionAttrs.data as UploadFileMentionData).file_id
			removeFile(fileId)
			return
		}

		if (mentionAttrs.type === MentionItemType.PROJECT_FILE) {
			const fileId = (mentionAttrs.data as ProjectFileMentionData).file_id
			removeUploadedFile(fileId)
		}

		if (mentionAttrs.type === MentionItemType.FOLDER) {
			const directoryId = (mentionAttrs.data as DirectoryMentionData).directory_id
			removeUploadedFile(directoryId)
		}
	})

	const confirmDeleteCurrentSessionUpload = useMemoizedFn(
		(mentionAttrs: TiptapMentionAttributes) => {
			const fileName = getMentionFileName(mentionAttrs)
			const modal = MagicModal.confirm({
				title: t("messageEditor.deleteUploadedFileConfirm.title"),
				content: t("messageEditor.deleteUploadedFileConfirm.content", { fileName }),
				variant: "destructive",
				showIcon: true,
				okText: t("messageEditor.deleteUploadedFileConfirm.confirm"),
				cancelText: t("messageEditor.deleteUploadedFileConfirm.cancel"),
				footer: (_, { CancelBtn, OkBtn }) => (
					<div className="flex items-center justify-end gap-2 pb-2 pr-2">
						<CancelBtn />
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								removeMentionOnly(mentionAttrs)
								modal.destroy()
							}}
						>
							{t("messageEditor.deleteUploadedFileConfirm.removeOnly")}
						</Button>
						<OkBtn />
					</div>
				),
				onOk: async () => {
					await executeFileDeletion(mentionAttrs)
				},
			})
		},
	)

	useEffect(() => {
		fileUploadStore.updateOptions({
			maxUploadCount: 100,
			maxUploadSize: 1024 * 1024 * 500,
			onFileUpload,
			onFileAdded: insertUploadMentionNodes,
			onFileCompleted: replaceUploadMentionNode,
			onFileRemoved: (fileId) => {
				const target = fileUploadStore.files.find((file) => file.id === fileId)
				const savedFileId = target?.saveResult?.file_id
				if (isProjectContext && savedFileId && !target?.isVirtualReference) {
					void deleteProjectFile(savedFileId)
				}
			},
			projectId: selectedProjectId ?? "",
			topicId: selectedTopicId ?? "",
		})
	}, [
		deleteProjectFile,
		fileUploadStore,
		insertUploadMentionNodes,
		isProjectContext,
		onFileUpload,
		replaceUploadMentionNode,
		selectedProjectId,
		selectedTopicId,
	])

	useEffect(() => {
		mentionPanelStore?.setUploadFiles(fileUploadStore.getUploadMentionItems())
	}, [fileUploadStore, fileUploadStore.files, mentionPanelStore])

	const {
		files,
		addFiles,
		removeFile,
		removeUploadedFile,
		clearFiles,
		clearFilesLocalOnly,
		isAllFilesUploaded,
		validateFileSize,
		validateFileCount,
	} = fileUploadStore

	const handleRemoveFile = useMemoizedFn(
		(
			mentionAttrs: TiptapMentionAttributes,
			options?: { deletionInput?: MentionDeletionInput },
		) => {
			if (
				mentionAttrs.type !== MentionItemType.UPLOAD_FILE &&
				mentionAttrs.type !== MentionItemType.PROJECT_FILE &&
				mentionAttrs.type !== MentionItemType.FOLDER
			) {
				return
			}

			if (isPastedFileReference(mentionAttrs)) {
				removeMentionOnly(mentionAttrs)
				return
			}

			if (!isCurrentSessionUpload(mentionAttrs)) {
				return
			}

			if (isQueueDraftMode) {
				removeMentionOnly(mentionAttrs)
				return
			}

			if (!confirmDelete) {
				void executeFileDeletion(mentionAttrs)
				return
			}

			const deletionInput = options?.deletionInput
			// Keyboard shortcuts in MentionExtension tag forward-delete + backspace;
			// other paths (cut, range delete, programmatic) stay remove-only.
			const shouldShowConfirmModal =
				deletionInput === undefined ||
				deletionInput === "forward-delete" ||
				deletionInput === "backspace"

			if (!shouldShowConfirmModal) {
				removeMentionOnly(mentionAttrs)
				return
			}

			confirmDeleteCurrentSessionUpload(mentionAttrs)
		},
	)

	const handleRemoveUploadedFile = useMemoizedFn((file: FileData) => {
		const mentionAttrs = createMentionAttrsFromFile(file)
		if (!mentionAttrs) {
			return
		}

		handleRemoveFile(mentionAttrs)
	})

	const shouldRestoreRemovedMention = useMemoizedFn(
		(
			mentionAttrs: TiptapMentionAttributes,
			stillExists: boolean,
			context?: { deletionInput: MentionDeletionInput },
		) => {
			if (stillExists) {
				return false
			}
			if (isPastedFileReference(mentionAttrs)) {
				return false
			}

			// When delete confirmation is disabled, removing a mention from the editor
			// should be treated as a confirmed deletion instead of being restored first.
			if (!confirmDelete) {
				return false
			}

			if (isQueueDraftMode) {
				return false
			}

			if (
				context?.deletionInput !== "forward-delete" &&
				context?.deletionInput !== "backspace"
			) {
				return false
			}

			if (
				mentionAttrs.type !== MentionItemType.UPLOAD_FILE &&
				mentionAttrs.type !== MentionItemType.PROJECT_FILE &&
				mentionAttrs.type !== MentionItemType.FOLDER
			) {
				return false
			}

			return isCurrentSessionUpload(mentionAttrs)
		},
	)

	const handleMentionRemoveItems = useMemoizedFn((items: MentionRemoveItemPayload[]) => {
		const filesToRemove = items.filter(
			({ stillExists, item }) =>
				!stillExists &&
				(item.type === MentionItemType.UPLOAD_FILE ||
					item.type === MentionItemType.PROJECT_FILE ||
					item.type === MentionItemType.FOLDER),
		)

		filesToRemove.forEach((mention) => {
			handleRemoveFile(mention.item, { deletionInput: mention.deletionInput })
		})
	})

	return {
		files,
		addFiles,
		clearFiles,
		clearFilesLocalOnly,
		isAllFilesUploaded,
		validateFileSize,
		validateFileCount,
		collectMentionItemsFromContent,
		collectMentionItemsFromEditor,
		handleRemoveFile,
		handleRemoveUploadedFile,
		handleMentionRemoveItems,
		isAllowedUploadMention,
		shouldRestoreRemovedMention,
	}
}
