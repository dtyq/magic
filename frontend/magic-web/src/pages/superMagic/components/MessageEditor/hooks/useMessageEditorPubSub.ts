import { useEffect, useRef } from "react"
import { useUserFileMentionSync } from "../../UserSpace/hooks/useUserFileMentionSync"
import { useTranslation } from "react-i18next"
import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DraftStore } from "../stores"
import type { SendMessageByContentPayload } from "../types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import type {
	SuperMagicAddFileToChatPayload,
	SuperMagicWidgetEditorCommandPayload,
} from "@/pages/superMagic/events/message"
import type {
	HtmlInspectorScreenshotUpdate,
	HtmlMultiSelectionRequest,
	HtmlScreenshotUploadRequest,
} from "@/components/business/ElementInspector"
import {
	buildHtmlMultiSelectionPromptContent,
	getHtmlScreenshotFileName,
} from "@/components/business/ElementInspector"
import { serializeInspectorContent } from "../extensions/inspector-detail"
import { htmlScreenshotUploadService } from "../services/HtmlScreenshotUploadService"
import {
	insertMentionFromDroppedData,
	DRAG_TYPE,
	type TabDragData,
	type AttachmentDragData,
	type MultipleFilesDragData,
	type PPTSlideDragData,
} from "../utils/drag"
import { runActiveEditor, useLatestActiveEditor } from "../utils/editorLifecycle"
import { INSPECTOR_DETAIL_TYPE } from "../extensions/inspector-detail/const"
import { setHtmlScreenshotMention } from "../services/HtmlScreenshotTargetStore"

interface UseMessageEditorPubSubParams {
	editor: Editor | null
	isMobile: boolean
	draftStore: DraftStore
	updateContent: (
		content: JSONContent | undefined,
		options?: { preserveMentionValidation?: boolean },
	) => void
	enableMessageSendByContent: boolean
	onSendMessageByContent: (data: SendMessageByContentPayload) => void | Promise<void>
	onSendCurrentContent?: () => void | Promise<void>
	projectId?: string
	topicId?: string
}

interface AddContentPayload {
	content?: JSONContent
	extraData?: {
		hasInput?: boolean
		focusAtEnd?: boolean
	}
}

type DragData = TabDragData | AttachmentDragData | MultipleFilesDragData | PPTSlideDragData

function isDragData(data: unknown): data is DragData {
	if (!data || typeof data !== "object") return false
	if (!("type" in data)) return false
	const dragType = (data as { type?: string }).type
	return (
		dragType === DRAG_TYPE.Tab ||
		dragType === DRAG_TYPE.ProjectFile ||
		dragType === DRAG_TYPE.ProjectDirectory ||
		dragType === DRAG_TYPE.MultipleFiles ||
		dragType === DRAG_TYPE.PPTSlide
	)
}

function safeEditorFocus(editor: Editor | null) {
	runActiveEditor(editor, (activeEditor) => {
		activeEditor.commands.focus()
	})
}

/**
 * Focus the editor with the caret at the end of the document.
 * Prefilled prompts (guide tour cases, presets, console snippets) exist so the user can edit or
 * extend them, so the caret must land after the inserted text instead of jumping to the beginning.
 */
function safeEditorFocusAtEnd(editor: Editor | null) {
	runActiveEditor(editor, (activeEditor) => {
		activeEditor.commands.focus("end")
	})
}

/** Insert an inspector chip and leave the caret after it for continued typing. */
function insertInspectorNode(editor: Editor, node: JSONContent) {
	const position = editor.state.selection.from
	const inserted = editor.commands.insertContent(node)
	if (inserted) editor.commands.setTextSelection(position + 1)
	return inserted
}

/** Persists programmatic Widget input after the topic draft has finished its initial restore. */
async function persistWidgetDraft(draftStore: DraftStore, content: JSONContent) {
	await draftStore.waitForLoadDraft()
	// Keep lightweight test doubles and disabled draft adapters harmless while preserving real saves.
	if (typeof draftStore.saveDraft === "function") {
		draftStore.saveDraft({ value: content })
	}
}

/** Converts Widget plain text into the editor document written by setInput. */
function createPlainTextDocument(content: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: content ? [{ type: "text", text: content }] : [],
			},
		],
	}
}

/** Normalizes Widget text and JSON input into one editor document. */
function normalizeWidgetDocument(content: string | JSONContent): JSONContent {
	return typeof content === "string" ? createPlainTextDocument(content) : content
}

/** Appends Widget content while keeping inline text and mention nodes in their original order. */
function appendWidgetContentToDocument(
	currentContent: JSONContent,
	content: string | JSONContent,
): JSONContent {
	const documentContent: JSONContent =
		currentContent.type === "doc"
			? currentContent
			: {
					type: "doc",
					content: [currentContent],
				}
	const nodes = [...(documentContent.content ?? [])]
	const incomingDocument = normalizeWidgetDocument(content)
	const incomingNodes =
		incomingDocument.type === "doc" ? [...(incomingDocument.content ?? [])] : [incomingDocument]
	const lastIndex = nodes.length - 1
	const lastNode = nodes[lastIndex]
	const firstIncomingNode = incomingNodes[0]

	if (
		lastNode?.type === "paragraph" &&
		incomingNodes.length === 1 &&
		firstIncomingNode?.type === "paragraph"
	) {
		nodes[lastIndex] = {
			...lastNode,
			content: [...(lastNode.content ?? []), ...(firstIncomingNode.content ?? [])],
		}
	} else {
		nodes.push(...incomingNodes)
	}

	return { ...documentContent, content: nodes }
}

function useMessageEditorPubSub({
	editor,
	isMobile,
	draftStore,
	updateContent,
	enableMessageSendByContent,
	onSendMessageByContent,
	onSendCurrentContent,
	projectId,
	topicId,
}: UseMessageEditorPubSubParams) {
	useUserFileMentionSync(editor)
	const { t } = useTranslation("super")
	const activeEditorRef = useLatestActiveEditor(editor)
	const preparedScreenshotMentionsRef = useRef(
		new Map<string, { dataUrl: string; mention: TiptapMentionAttributes }>(),
	)
	const preparingScreenshotPromisesRef = useRef(
		new Map<string, { dataUrl: string; promise: Promise<TiptapMentionAttributes> }>(),
	)

	const prepareScreenshot = useMemoizedFn(
		(
			captureId: string,
			dataUrl: string,
			fileName: string,
			options?: { stageUpload?: boolean },
		) => {
			const prepared = preparedScreenshotMentionsRef.current.get(captureId)
			if (prepared?.dataUrl === dataUrl) return Promise.resolve(prepared.mention)

			const preparing = preparingScreenshotPromisesRef.current.get(captureId)
			if (preparing?.dataUrl === dataUrl) return preparing.promise

			const promise = (async () => {
				try {
					const storedScreenshot = await htmlScreenshotUploadService.storeScreenshot({
						dataUrl,
						fileName,
						captureId,
					})
					try {
						const mention: TiptapMentionAttributes = {
							type: MentionItemType.UPLOAD_FILE,
							data: {
								file_id: storedScreenshot.storageId,
								file_name: storedScreenshot.fileName,
								file_path: storedScreenshot.storageId,
								file_extension: storedScreenshot.fileName.split(".").pop() ?? "",
								file_size: storedScreenshot.fileSize,
								is_hidden: true,
								is_html_screenshot: true,
								storage_id: storedScreenshot.storageId,
								upload_status: "done",
							},
						}
						preparedScreenshotMentionsRef.current.set(captureId, { dataUrl, mention })
						setHtmlScreenshotMention(captureId, mention)
						if (options?.stageUpload && projectId) {
							void htmlScreenshotUploadService
								.uploadStoredScreenshot({
									storageId: storedScreenshot.storageId,
									fileName: storedScreenshot.fileName,
									projectId,
									topicId,
								})
								.catch((error) => {
									console.warn("html screenshot upload failed", error)
								})
						}
						return mention
					} catch (error) {
						await htmlScreenshotUploadService.discardStoredScreenshot(
							storedScreenshot.storageId,
						)
						throw error
					}
				} finally {
					const current = preparingScreenshotPromisesRef.current.get(captureId)
					if (current?.dataUrl === dataUrl) {
						preparingScreenshotPromisesRef.current.delete(captureId)
					}
				}
			})()

			preparingScreenshotPromisesRef.current.set(captureId, { dataUrl, promise })
			return promise
		},
	)

	useEffect(() => {
		const handlePrepareHtmlScreenshot = async (request: HtmlScreenshotUploadRequest) => {
			try {
				const mention = await prepareScreenshot(
					request.captureId,
					request.dataUrl,
					request.fileName ?? `html-screenshot-${Date.now()}.png`,
					{ stageUpload: request.stageUpload },
				)
				request.onSuccess?.(mention)
			} catch (error) {
				request.onError?.(error)
			} finally {
				if (request.releaseAfterSuccess) {
					preparedScreenshotMentionsRef.current.delete(request.captureId)
				}
			}
		}
		pubsub.subscribe(PubSubEvents.Prepare_Html_Screenshot, handlePrepareHtmlScreenshot)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Prepare_Html_Screenshot, handlePrepareHtmlScreenshot)
		}
	}, [prepareScreenshot])

	useEffect(() => {
		const handleUpdateHtmlInspectorScreenshot = (update: HtmlInspectorScreenshotUpdate) => {
			if (!update.captureId || !update.screenshotMention) return
			setHtmlScreenshotMention(update.captureId, update.screenshotMention)
		}

		pubsub.subscribe(
			PubSubEvents.Update_Html_Inspector_Screenshot,
			handleUpdateHtmlInspectorScreenshot,
		)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Update_Html_Inspector_Screenshot,
				handleUpdateHtmlInspectorScreenshot,
			)
		}
	}, [])

	useEffect(() => {
		const handleSubmitHtmlMultiSelection = async (request: HtmlMultiSelectionRequest) => {
			try {
				const screenshotTargets = request.targets.filter(
					(target) => target.kind === "screenshot" && Boolean(target.screenshot?.dataUrl),
				)
				const screenshotMentions = new Map(
					await Promise.all(
						screenshotTargets.map(
							async (target, index) =>
								[
									target.id ?? `screenshot:${index}`,
									target.screenshot?.mention ??
										(await prepareScreenshot(
											target.id ?? `screenshot:${index}`,
											target.screenshot?.dataUrl ?? "",
											getHtmlScreenshotFileName(
												target.id ?? `screenshot:${index}`,
												index,
											),
											{ stageUpload: true },
										)),
								] as const,
						),
					),
				)
				const content = buildHtmlMultiSelectionPromptContent(
					{
						fileId: request.fileId,
						fileName: request.fileName || "index.html",
						filePath: request.filePath || request.fileId,
					},
					request.targets,
					"HTML 页面修改目标",
					screenshotMentions,
					t,
				)
				const serializedContent = serializeInspectorContent(content)
				if (projectId) {
					const uploadItems = htmlScreenshotUploadService.collectUploadItems([
						...screenshotMentions.values(),
					])
					if (uploadItems.length > 0) {
						await htmlScreenshotUploadService.uploadStoredScreenshots(uploadItems, {
							projectId,
							topicId,
						})
					}
				}
				await onSendMessageByContent({
					jsonContent: serializedContent,
					shouldClearEditorAfterSend: true,
				})
				screenshotTargets.forEach((target, index) => {
					preparedScreenshotMentionsRef.current.delete(target.id ?? `screenshot:${index}`)
				})
				request.onSuccess?.()
			} catch (error) {
				request.onError?.(error)
			}
		}
		pubsub.subscribe(PubSubEvents.Submit_Html_Multi_Selection, handleSubmitHtmlMultiSelection)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Submit_Html_Multi_Selection,
				handleSubmitHtmlMultiSelection,
			)
		}
	}, [onSendMessageByContent, prepareScreenshot, projectId, topicId])

	useEffect(() => {
		let disposed = false
		const pendingScopedTimers = new Set<ReturnType<typeof setTimeout>>()
		const handleAddFileToChat = (data: SuperMagicAddFileToChatPayload) => {
			const { items, autoFocus = false, targetScope } = data
			const acceptsTarget = () =>
				!targetScope ||
				(!disposed &&
					targetScope.projectId === projectId &&
					targetScope.projectId === projectStore.selectedProject?.id &&
					targetScope.topicId === (topicStore.selectedTopic?.id || null) &&
					targetScope.topicId === (topicId || null) &&
					targetScope.identityKey === getFileReferenceIdentityKey() &&
					Boolean(
						activeEditorRef.current?.isEditable && !activeEditorRef.current.isDestroyed,
					))
			if (!acceptsTarget()) return
			if (data.checkEditable) {
				data.checkEditable(Boolean(activeEditorRef.current?.isEditable))
				return
			}
			// Delay insert for new topics to allow draft loading
			// 范围在接收、延时结束和草稿恢复之后均核对，避免切换话题后误插入。
			const timeoutId = setTimeout(() => {
				pendingScopedTimers.delete(timeoutId)
				if (!acceptsTarget()) return
				draftStore.waitForLoadDraft().then(() => {
					if (!acceptsTarget()) return
					if (Array.isArray(items) && items.length > 0) {
						const mentions = items.map((item) => ({ type: "mention", attrs: item }))
						runActiveEditor(activeEditorRef.current, (activeEditor) => {
							activeEditor.commands.insertContent(mentions)
							if (autoFocus) {
								activeEditor.commands.focus()
								if (isMobile) activeEditor.commands.scrollIntoView()
							}
						})
					}
				})
			}, 400)
			if (targetScope) pendingScopedTimers.add(timeoutId)
		}
		pubsub.subscribe(PubSubEvents.Add_File_To_Chat, handleAddFileToChat)
		return () => {
			disposed = true
			pendingScopedTimers.forEach(clearTimeout)
			pubsub.unsubscribe(PubSubEvents.Add_File_To_Chat, handleAddFileToChat)
		}
	}, [activeEditorRef, isMobile, draftStore, projectId, topicId])

	useEffect(() => {
		const handleInsertDragDataToEditor = (dragData: unknown) => {
			if (!isDragData(dragData)) return
			runActiveEditor(activeEditorRef.current, (activeEditor) => {
				insertMentionFromDroppedData({ editor: activeEditor, data: dragData })
			})
		}

		pubsub.subscribe(PubSubEvents.Insert_Drag_Data_To_Editor, handleInsertDragDataToEditor)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Insert_Drag_Data_To_Editor,
				handleInsertDragDataToEditor,
			)
		}
	}, [activeEditorRef])

	const applyAddContentPayload = useMemoizedFn((data: AddContentPayload) => {
		const { content, extraData } = data
		if (content) {
			updateContent(content)
		}
		if (extraData?.hasInput) {
			runActiveEditor(activeEditorRef.current, (activeEditor) => {
				activeEditor.commands.focusFirstSuperPlaceholder?.()
			})
		} else if (extraData?.focusAtEnd) {
			runActiveEditor(activeEditorRef.current, (activeEditor) => {
				activeEditor.commands.focus("end")
			})
		} else {
			safeEditorFocus(activeEditorRef.current)
		}
	})

	const handleAddContent = useMemoizedFn((data: AddContentPayload) => {
		// Wait for draft restore on new topics so loadLatestDraft clear does not wipe prefilled content.
		void draftStore.waitForLoadDraft().then(() => {
			applyAddContentPayload(data)
		})
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Add_Content_To_Chat, handleAddContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Add_Content_To_Chat, handleAddContent)
		}
	}, [handleAddContent])

	useEffect(() => {
		const handleSetInputMessage = (message: string | string[] | JSONContent) => {
			// JSONContent object — use directly
			if (typeof message === "object" && !Array.isArray(message) && message !== null) {
				updateContent(message)
				safeEditorFocusAtEnd(activeEditorRef.current)
				return
			}
			const lines = Array.isArray(message) ? message : [message]
			if (lines.length === 0) return
			const inlineNodes: JSONContent[] = []
			lines.forEach((line, i) => {
				if (i > 0) inlineNodes.push({ type: "hardBreak" })
				if (line) inlineNodes.push({ type: "text", text: line })
			})
			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: inlineNodes }],
			}
			updateContent(content)
			safeEditorFocusAtEnd(activeEditorRef.current)
		}
		pubsub.subscribe(PubSubEvents.Set_Input_Message, handleSetInputMessage)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Set_Input_Message, handleSetInputMessage)
		}
	}, [activeEditorRef, updateContent])

	useEffect(() => {
		if (!enableMessageSendByContent) {
			return
		}
		pubsub.subscribe(PubSubEvents.Send_Message_by_Content, onSendMessageByContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Send_Message_by_Content, onSendMessageByContent)
		}
	}, [enableMessageSendByContent, onSendMessageByContent])

	useEffect(() => {
		const handleInsertDemoText = (text: string) => {
			if (typeof text !== "string" || !text) return
			const content: JSONContent = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text }],
					},
				],
			}
			updateContent(content)
			safeEditorFocus(activeEditorRef.current)
		}
		pubsub.subscribe(PubSubEvents.Set_Demo_Text_To_Input, handleInsertDemoText)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Set_Demo_Text_To_Input, handleInsertDemoText)
		}
	}, [activeEditorRef, updateContent])

	useEffect(() => {
		const handleAppendSuggestion = (input: string | JSONContent) => {
			if (!input) return

			// Determine new nodes to append
			const newNodes: JSONContent[] =
				typeof input === "string"
					? [{ type: "paragraph", content: [{ type: "text", text: input }] }]
					: input.type === "doc"
						? (input.content ?? [])
						: [input]

			if (!newNodes.length) return

			runActiveEditor(activeEditorRef.current, (activeEditor) => {
				const inspectorNode = newNodes[0]?.content?.[0]
				const isSingleInspectorNode =
					newNodes.length === 1 &&
					newNodes[0]?.type === "paragraph" &&
					newNodes[0]?.content?.length === 1 &&
					inspectorNode?.type === INSPECTOR_DETAIL_TYPE

				if (isSingleInspectorNode && inspectorNode) {
					insertInspectorNode(activeEditor, inspectorNode)
					activeEditor.commands.focus()
					return
				}

				const currentContent = activeEditor.getJSON()
				const mergedContent: JSONContent = !activeEditor.isEmpty
					? {
							...currentContent,
							content: [...(currentContent.content ?? []), ...newNodes],
						}
					: { type: "doc", content: newNodes }
				updateContent(mergedContent)
				activeEditor.commands.focus()
			})
		}
		pubsub.subscribe(PubSubEvents.Append_Suggestion_To_Editor, handleAppendSuggestion)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Append_Suggestion_To_Editor, handleAppendSuggestion)
		}
	}, [activeEditorRef, updateContent])

	useEffect(() => {
		const handleAppendContent = (content: JSONContent) => {
			if (!content || !activeEditorRef.current) return

			const newNodes: JSONContent[] =
				content.type === "doc" ? (content.content ?? []) : [content]
			if (newNodes.length === 0) return

			const inspectorNode = newNodes[0]?.content?.[0]
			const isSingleInspectorNode =
				newNodes.length === 1 &&
				newNodes[0]?.type === "paragraph" &&
				newNodes[0]?.content?.length === 1 &&
				inspectorNode?.type === INSPECTOR_DETAIL_TYPE

			if (isSingleInspectorNode && inspectorNode) {
				runActiveEditor(activeEditorRef.current, (activeEditor) => {
					insertInspectorNode(activeEditor, inspectorNode)
				})
				safeEditorFocus(activeEditorRef.current)
				return
			}

			const currentContent = activeEditorRef.current.getJSON()
			const mergedContent: JSONContent = !activeEditorRef.current?.isEmpty
				? {
						...currentContent,
						content: [...(currentContent.content ?? []), ...newNodes],
					}
				: { type: "doc", content: newNodes }
			updateContent(mergedContent)
			safeEditorFocus(activeEditorRef.current)
		}
		pubsub.subscribe(PubSubEvents.Append_Content_To_Editor, handleAppendContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Append_Content_To_Editor, handleAppendContent)
		}
	}, [activeEditorRef, updateContent])

	useEffect(() => {
		const handleWidgetEditorCommand = (payload: SuperMagicWidgetEditorCommandPayload) => {
			if (payload.command === "sendMessage") {
				if (!onSendCurrentContent) {
					payload.respond(undefined, "Magic widget editor sending is not available")
					return
				}
				// Reuse the editor's normal send handler so validation, drafts, and mentions stay aligned.
				void (async () => {
					try {
						await onSendCurrentContent()
						payload.respond()
					} catch (error) {
						payload.respond(
							undefined,
							error instanceof Error ? error.message : "Magic widget send failed",
						)
					}
				})()
				return
			}

			runActiveEditor(activeEditorRef.current, (activeEditor) => {
				if (payload.command === "setInput") {
					const nextContent = normalizeWidgetDocument(payload.content ?? "")
					updateContent(nextContent, {
						preserveMentionValidation: true,
					})
					void persistWidgetDraft(draftStore, nextContent)
					activeEditor.commands.focus()
					payload.respond()
					return
				}

				if (payload.command === "appendInput") {
					const nextContent = appendWidgetContentToDocument(
						activeEditor.getJSON(),
						payload.content ?? "",
					)
					updateContent(nextContent, { preserveMentionValidation: true })
					void persistWidgetDraft(draftStore, nextContent)
					activeEditor.commands.focus()
					payload.respond()
					return
				}

				if (payload.command === "clearInput") {
					updateContent({ type: "doc", content: [{ type: "paragraph" }] })
					activeEditor.commands.focus()
					payload.respond()
					return
				}

				payload.respond(activeEditor.getText({ blockSeparator: "\n" }))
			})
		}

		pubsub.subscribe(PubSubEvents.Magic_Widget_Editor_Command, handleWidgetEditorCommand)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Magic_Widget_Editor_Command, handleWidgetEditorCommand)
		}
	}, [activeEditorRef, draftStore, onSendCurrentContent, updateContent])
}

export default useMessageEditorPubSub
