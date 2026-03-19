import type { Editor, JSONContent } from "@tiptap/react"
import { useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import {
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { logger as Logger } from "@/utils/log"
import type { FileData } from "../types"
import type { FileUploadStore } from "../stores/FileUploadStore"
import {
	collectMentionItemsFromContent as collectMentionItemsFromContentService,
	collectMentionItemsFromEditor as collectMentionItemsFromEditorService,
	deleteProjectFile as deleteProjectFileService,
	insertUploadMentionNodes as insertUploadMentionNodesService,
	removeUploadMentionNodes as removeUploadMentionNodesService,
	replaceUploadMentionNode as replaceUploadMentionNodeService,
	updateUploadMentionProgress as updateUploadMentionProgressService,
} from "../services/uploadMentionService"

const logger = Logger.createLogger("SuperMagicMessageEditor")

interface UseUploadMentionFlowParams {
	fileUploadStore: FileUploadStore
	getEditor: () => Editor | null
	isProjectContext: boolean
	confirmDelete?: boolean
	onFileUpload?: (files: FileData[]) => void
	runWithoutMentionRemoveSync: (callback: () => void) => void
	selectedProjectId?: string
	selectedTopicId?: string
	t: (key: string, options?: Record<string, unknown>) => string
}

export default function useUploadMentionFlow({
	fileUploadStore,
	getEditor,
	isProjectContext,
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

	const updateUploadMentionProgress = useMemoizedFn(
		(fileId: string, progress: number, status: FileData["status"], error?: string) => {
			updateUploadMentionProgressService({
				editor: getEditor(),
				fileId,
				progress,
				status,
				error,
			})
		},
	)

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

		return false
	})

	const getMentionFileName = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		if (mentionAttrs.type === MentionItemType.UPLOAD_FILE) {
			return (mentionAttrs.data as UploadFileMentionData).file_name
		}

		if (mentionAttrs.type === MentionItemType.PROJECT_FILE) {
			return (mentionAttrs.data as ProjectFileMentionData).file_name
		}

		return ""
	})

	const createMentionAttrsFromFile = useMemoizedFn(
		(file: FileData): TiptapMentionAttributes | null => {
			if (file.saveResult?.file_id) {
				return {
					type: MentionItemType.PROJECT_FILE,
					data: {
						file_id: file.saveResult.file_id,
						file_name: file.saveResult.file_name ?? file.name,
						file_path:
							file.saveResult.relative_file_path ?? file.saveResult.file_key ?? "",
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
					file_path: file.reportResult?.file_key ?? "",
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
			onFileProgressUpdate: updateUploadMentionProgress,
			onFileCompleted: replaceUploadMentionNode,
			onFileRemoved: (fileId) => {
				const target = fileUploadStore.files.find((file) => file.id === fileId)
				const savedFileId = target?.saveResult?.file_id
				if (isProjectContext && savedFileId) {
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
		updateUploadMentionProgress,
	])

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

	const handleRemoveFile = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		if (
			mentionAttrs.type !== MentionItemType.UPLOAD_FILE &&
			mentionAttrs.type !== MentionItemType.PROJECT_FILE
		) {
			return
		}

		if (!isCurrentSessionUpload(mentionAttrs)) {
			return
		}

		if (!confirmDelete) {
			void executeFileDeletion(mentionAttrs)
			return
		}

		confirmDeleteCurrentSessionUpload(mentionAttrs)
	})

	const handleRemoveUploadedFile = useMemoizedFn((file: FileData) => {
		const mentionAttrs = createMentionAttrsFromFile(file)
		if (!mentionAttrs) {
			return
		}

		handleRemoveFile(mentionAttrs)
	})

	const shouldRestoreRemovedMention = useMemoizedFn(
		(mentionAttrs: TiptapMentionAttributes, stillExists: boolean) => {
			if (stillExists) {
				return false
			}

			// When delete confirmation is disabled, removing a mention from the editor
			// should be treated as a confirmed deletion instead of being restored first.
			if (!confirmDelete) {
				return false
			}

			if (
				mentionAttrs.type !== MentionItemType.UPLOAD_FILE &&
				mentionAttrs.type !== MentionItemType.PROJECT_FILE
			) {
				return false
			}

			return isCurrentSessionUpload(mentionAttrs)
		},
	)

	const handleMentionRemoveItems = useMemoizedFn(
		(items: { item: TiptapMentionAttributes; stillExists: boolean }[]) => {
			const filesToRemove = items.filter(
				({ stillExists, item }) =>
					!stillExists &&
					(item.type === MentionItemType.UPLOAD_FILE ||
						item.type === MentionItemType.PROJECT_FILE),
			)

			filesToRemove.forEach((mention) => {
				handleRemoveFile(mention.item)
			})
		},
	)

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
		shouldRestoreRemovedMention,
	}
}
