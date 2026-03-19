import { useState, useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { Editor } from "@tiptap/react"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	getMentionUniqueId,
	MentionListItem,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { FileData } from "../types"
import {
	createUploadFileMentionAttributes,
	transformUploadFileToProjectFile,
} from "../utils/mention"
import MentionPanelStore from "@/components/business/MentionPanel/store"

/**
 * useMentionManager - 管理 mention 相关的状态和逻辑
 *
 * @returns mention 状态和处理函数
 */
export function useMentionManager({ onChange }: { onChange: (items: MentionListItem[]) => void }) {
	// State
	const [mentionItems, _setMentionItems] = useState<MentionListItem[]>([])

	const editorRef = useRef<Editor | null>(null)

	// 使用 ref 保存最新的 mentionItems，避免并发更新时的竞态条件
	const mentionItemsRef = useRef<MentionListItem[]>(mentionItems)
	useEffect(() => {
		mentionItemsRef.current = mentionItems
	}, [mentionItems])

	const setMentionItems = useMemoizedFn(
		(items: MentionListItem[] | ((items: MentionListItem[]) => MentionListItem[])) => {
			_setMentionItems((prevItems) => {
				// Use React state's latest value instead of closure's stale value
				const _items = typeof items === "function" ? items(prevItems) : items

				// Execute side effects after calculating new state
				onChange(_items)
				MentionPanelStore.setUploadFiles(
					_items
						.filter(
							(item) =>
								item.attrs.type === MentionItemType.UPLOAD_FILE &&
								// 有 file_path 的表示上传完成了
								(item.attrs.data as UploadFileMentionData).file_path,
						)
						.map((item) => {
							const fileData = item.attrs.data as ProjectFileMentionData
							return {
								id: fileData.file_id,
								type: MentionItemType.UPLOAD_FILE,
								name: fileData.file_name,
								icon: fileData.file_extension,
								extension: fileData.file_extension,
								hasChildren: false,
								data: item.attrs.data,
							}
						}),
				)

				return _items
			})
		},
	)

	// Set editor reference
	const setEditor = useMemoizedFn((editor: Editor | null) => {
		editorRef.current = editor
	})

	// Handlers
	const insertMentionItems = useMemoizedFn((items: TiptapMentionAttributes[]) => {
		setMentionItems((prev) => {
			// Check for duplicates based on the latest state
			const uniqueIds = items.map((item) => getMentionUniqueId(item))
			const existing = prev.filter((i) => uniqueIds.includes(getMentionUniqueId(i.attrs)))

			if (existing.length === 0) {
				console.log("添加新的 mention item")
				const newItems: MentionListItem[] = [
					...prev,
					...items.map((item) => ({
						type: "mention" as const,
						attrs: item,
					})),
				]
				console.log("更新后的 mentionItems:", newItems)
				return newItems
			} else {
				console.log("mention item 已存在，跳过添加")
				return prev
			}
		})
	})

	const removeMentionItem = useMemoizedFn(
		(item: TiptapMentionAttributes, stillExists: boolean) => {
			// 如果mention节点不存在，则从状态中移除
			if (!stillExists) {
				setMentionItems((prev) =>
					prev.filter(
						(i) =>
							!(
								i.attrs.type === item.type &&
								getMentionUniqueId(i.attrs) === getMentionUniqueId(item)
							),
					),
				)
			}
		},
	)

	const removeMentionItems = useMemoizedFn(
		(items: { item: TiptapMentionAttributes; stillExists: boolean }[]) => {
			// 过滤出需要移除的 mention 项（stillExists 为 false 的项）
			const itemsToRemove = items.filter(({ stillExists }) => !stillExists)

			if (itemsToRemove.length === 0) return

			setMentionItems((prev) =>
				prev.filter(
					(i) =>
						!itemsToRemove.some(
							({ item }) =>
								i.attrs.type === item.type &&
								getMentionUniqueId(i.attrs) === getMentionUniqueId(item),
						),
				),
			)
		},
	)

	const removeMentionFromEditor = useMemoizedFn((item: TiptapMentionAttributes) => {
		const editor = editorRef.current
		if (!editor) return

		const { state, dispatch } = editor.view
		const { tr } = state
		const toDelete: { from: number; to: number }[] = []

		// 收集所有需要删除的mention节点位置
		state.doc.descendants((node, pos) => {
			if (node.type.name === "mention") {
				const mentionData = node.attrs as TiptapMentionAttributes
				// 比较mention的唯一标识
				if (
					mentionData.type === item.type &&
					getMentionUniqueId(mentionData) === getMentionUniqueId(item)
				) {
					toDelete.push({
						from: pos,
						to: pos + node.nodeSize,
					})
				}
			}
			return true
		})

		// 从后往前删除，避免位置偏移问题
		toDelete.reverse().forEach(({ from, to }) => {
			tr.delete(from, to)
		})

		if (toDelete.length > 0) {
			dispatch(tr)
		}
	})

	const handleRemoveMention = useMemoizedFn((item: TiptapMentionAttributes) => {
		// 首先从编辑器中移除所有对应的mention节点
		removeMentionFromEditor(item)

		// 然后从状态中移除
		removeMentionItem(item, false)
	})

	// 添加文件到 mention 列表
	const addFilesToMentions = useMemoizedFn((fileDatas: FileData[]) => {
		const mentionAttrs: TiptapMentionAttributes[] = fileDatas.map((fileData) =>
			createUploadFileMentionAttributes(fileData),
		)
		console.log("创建的 mention 属性:", mentionAttrs)

		// 1. 添加到 mentionItems 状态（用于显示文件列表）
		insertMentionItems(mentionAttrs)

		// 2. 插入到 Tiptap 编辑器中（在光标位置插入 @文件名）
		const editor = editorRef.current
		if (editor && !editor.isDestroyed) {
			// 构建要插入的内容
			const mentions = mentionAttrs.map((attrs) => ({
				type: "mention",
				attrs: {
					type: attrs.type,
					data: attrs.data,
				},
			}))

			// 在当前光标位置插入所有文件的 mention 节点
			editor.commands.insertContent(mentions)

			// 保持编辑器焦点
			editor.commands.focus()
		}

		console.log("insertMentionItem 调用完成")
	})

	// 更新文件上传进度
	const updateFileProgress = useMemoizedFn(
		(fileId: string, progress: number, status: FileData["status"], error?: string) => {
			// 1. Update state (for mention list display)
			setMentionItems((prev) =>
				prev.map((item) => {
					if (
						item.type === "mention" &&
						item.attrs.type === MentionItemType.UPLOAD_FILE
					) {
						const fileData = item.attrs.data as UploadFileMentionData
						if (fileData.file_id === fileId) {
							return {
								...item,
								attrs: {
									...item.attrs,
									data: {
										...fileData,
										upload_progress: progress,
										upload_status: status,
										upload_error: error,
									},
								},
							}
						}
					}
					return item
				}),
			)

			// // 2. Update Tiptap editor content
			// const editor = editorRef.current
			// if (editor && !editor.isDestroyed) {
			// 	const { state, dispatch } = editor.view
			// 	const { tr } = state

			// 	// Find all mention nodes with matching file_id and update progress
			// 	state.doc.descendants((node, pos) => {
			// 		if (
			// 			node.type.name === "mention" &&
			// 			node.attrs.type === MentionItemType.UPLOAD_FILE
			// 		) {
			// 			const nodeData = node.attrs.data as UploadFileMentionData
			// 			if (nodeData.file_id === fileId) {
			// 				const newAttrs = {
			// 					type: MentionItemType.UPLOAD_FILE,
			// 					data: {
			// 						...nodeData,
			// 						upload_progress: progress,
			// 						upload_status: status,
			// 						upload_error: error,
			// 					},
			// 				}
			// 				tr.setNodeMarkup(pos, undefined, newAttrs)
			// 			}
			// 		}
			// 	})

			// 	if (tr.steps.length > 0) {
			// 		dispatch(tr)
			// 	}
			// }
		},
	)

	const replaceUploadFile = useMemoizedFn(
		(
			fileId: string,
			reportResult: FileData["reportResult"],
			saveResult: FileData["saveResult"],
		) => {
			// 1. Update state (for mention list display)
			setMentionItems((prev) =>
				prev.map((item) => {
					if (
						item.type === "mention" &&
						item.attrs.type === MentionItemType.UPLOAD_FILE
					) {
						const fileData = item.attrs.data as UploadFileMentionData
						if (fileData.file_id === fileId) {
							if (saveResult) {
								const newItem = {
									...item,
									attrs: {
										type: MentionItemType.PROJECT_FILE,
										data: transformUploadFileToProjectFile(
											fileData,
											saveResult,
										),
									},
								}
								MentionPanelStore.addMentionListItemsToHistory([newItem])
								return newItem
							}

							return {
								...item,
								attrs: {
									type: MentionItemType.UPLOAD_FILE,
									data: {
										file_id: reportResult?.file_id || "",
										file_name: reportResult?.file_name || "",
										file_path: reportResult?.file_key || "",
										file_extension: fileData.file_extension,
										file_size: reportResult?.file_size || 0,
										file: fileData.file,
									},
								},
							}
						}
						return item
					}
					return item
				}),
			)

			// 2. Update Tiptap editor content
			const editor = editorRef.current
			if (editor && !editor.isDestroyed) {
				const { state, dispatch } = editor.view
				const { tr } = state

				// Find all mention nodes with matching file_id and replace them
				state.doc.descendants((node, pos) => {
					if (
						node.type.name === "mention" &&
						node.attrs.type === MentionItemType.UPLOAD_FILE
					) {
						const nodeData = node.attrs.data as UploadFileMentionData
						if (nodeData.file_id === fileId) {
							if (saveResult) {
								// Replace with PROJECT_FILE mention
								const newAttrs = {
									type: MentionItemType.PROJECT_FILE,
									data: transformUploadFileToProjectFile(nodeData, saveResult),
								}
								tr.setNodeMarkup(pos, undefined, newAttrs)
							} else if (reportResult) {
								// Update UPLOAD_FILE mention with report result
								const newAttrs = {
									type: MentionItemType.UPLOAD_FILE,
									data: {
										file_id: reportResult.file_id || "",
										file_name: reportResult.file_name || "",
										file_path: reportResult.file_key || "",
										file_extension: nodeData.file_extension,
										file_size: reportResult.file_size || 0,
										file: nodeData.file,
									},
								}
								tr.setNodeMarkup(pos, undefined, newAttrs)
							}
						}
					}
				})

				if (tr.steps.length > 0) {
					dispatch(tr)
				}
			}
		},
	)

	// 移除文件
	const removeFile = useMemoizedFn((fileId: string) => {
		const fileItem = mentionItems.find((item) => {
			if (item.type === "mention" && item.attrs.type === MentionItemType.UPLOAD_FILE) {
				const fileData = item.attrs.data as UploadFileMentionData
				return fileData.file_id === fileId
			}
			return false
		})

		if (fileItem?.type === "mention") {
			handleRemoveMention(fileItem.attrs)
		}
	})

	const clearAll = useMemoizedFn(() => {
		setMentionItems([])
	})

	const insertMentionItem = useMemoizedFn((item: TiptapMentionAttributes) => {
		return insertMentionItems([item])
	})

	return {
		mentionItems,
		insertMentionItem,
		insertMentionItems,
		removeMentionItem,
		removeMentionItems,
		handleRemoveMention,
		setEditor,
		// 文件相关方法
		addFilesToMentions,
		updateFileProgress,
		replaceUploadFile,
		removeFile,
		clearAll,
		restoreMentionItems: setMentionItems,
		removeMentionFromEditor,
	}
}
