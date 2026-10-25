import type { UploadFileResponse } from "../../../public/magic-types"
import type { ReferenceResourcePanelItem } from "../../../public/props"
import type {
	CanvasClipboardAsset,
	CanvasClipboardMessagePart,
} from "../../../runtime/resources/clipboard/CanvasClipboardPasteController"
import {
	createReferenceResourcePanelItemFromPath,
	createUploadFileResponseFromPanelItem,
} from "./reference-assets/createReferenceResourcePanelItem"
import type {
	CanvasUploadMentionController,
	CanvasUploadMentionHandle,
} from "./CanvasUploadMentionController"
import type {
	MessageEditorClipboardInsertPart,
	MessageEditorRef,
	MessageEditorSelectionRange,
} from "./MessageEditor"

export type RichClipboardAssetDestination = "prompt" | "selected-slot" | "frame"

export interface RichMessageClipboardSession {
	resolveOccurrence: (occurrenceKey: string, asset: CanvasClipboardAsset) => Promise<void>
	failOccurrence: (occurrenceKey: string, error?: string) => void
}

export interface ApplyRichMessageClipboardPartsOptions {
	parts: CanvasClipboardMessagePart[]
	editor: MessageEditorRef | null | undefined
	controller: CanvasUploadMentionController | null | undefined
	selection?: MessageEditorSelectionRange
	/**
	 * Routes each asset (0-based among assets only). Defaults to selected-slot for
	 * the first asset when replaceSelectedSlot is provided, otherwise prompt.
	 */
	resolveAssetDestination?: (assetIndex: number) => RichClipboardAssetDestination
	isSessionCurrent: () => boolean
	registerPendingResourcePath?: (path: string) => void
	replaceSelectedSlot?: (
		fileInfo: UploadFileResponse,
		options?: { retainReferenceSlot?: boolean },
	) => void
	appendFrameItem?: (item: ReferenceResourcePanelItem) => void
	/**
	 * Optional display-only prompt text when an asset is routed to a frame slot
	 * (e.g. `[首帧]` / `[尾帧]`). Return null to skip editor insertion (capacity full
	 * or non-frame selected-slot). When provided, a null result for `frame`
	 * skips append as well.
	 */
	allocateFramePromptPlaceholder?: (input: {
		destination: "frame" | "selected-slot"
		assetIndex: number
	}) => string | null
	/**
	 * Uploads files in one batch. pendingMentionHandles is aligned with the files
	 * array (same order/length) so progress/resolve map back to editor placeholders.
	 */
	uploadFiles: (
		files: File[],
		options: {
			ignoreSelectedReferenceSlot?: boolean
			retainSelectedReferenceSlot?: boolean
			suppressPromptMention?: boolean
			pendingMentionHandles?: Array<CanvasUploadMentionHandle | undefined>
			isCurrent?: () => boolean
		},
	) => Promise<Array<UploadFileResponse | undefined | null>>
}

type PlannedInsert =
	| { type: "text"; text: string }
	| { type: "frame-placeholder"; text: string }
	| { type: "mention"; item: ReferenceResourcePanelItem }
	| { type: "upload"; file: File; pendingKey: string }
	| {
			type: "resolving"
			occurrenceKey: string
			fileName: string
			fileSize?: number
			pendingKey: string
	  }

type PendingPlanEntry = {
	pendingKey: string
	file: File
	kind: "upload" | "resolving"
	occurrenceKey?: string
}

type PendingOccurrence =
	| { destination: "prompt"; handle: CanvasUploadMentionHandle }
	| { destination: "selected-slot" }
	| { destination: "frame" }

const WHITESPACE_END_RE = /\s$/u
const WHITESPACE_START_RE = /^\s/u

function buildPromptPendingPlan(planned: PlannedInsert[]): PendingPlanEntry[] {
	const pendingPlan: PendingPlanEntry[] = []
	for (const entry of planned) {
		if (entry.type === "upload") {
			pendingPlan.push({
				pendingKey: entry.pendingKey,
				file: entry.file,
				kind: "upload",
			})
			continue
		}
		if (entry.type === "resolving") {
			pendingPlan.push({
				pendingKey: entry.pendingKey,
				file: new File([], entry.fileName, { type: "application/octet-stream" }),
				kind: "resolving",
				occurrenceKey: entry.occurrenceKey,
			})
		}
	}
	return pendingPlan
}

function padBracketPlaceholderText(
	placeholder: string,
	context: {
		isFirst: boolean
		isLast: boolean
		previousEndsWithWhitespace?: boolean
		nextStartsWithWhitespace?: boolean
	},
): string {
	let result = placeholder
	if (!context.isFirst && !context.previousEndsWithWhitespace) {
		result = ` ${result}`
	}
	if (!context.isLast && !context.nextStartsWithWhitespace) {
		result = `${result} `
	}
	return result
}

function resolvePlannedBoundary(
	entry: PlannedInsert | undefined,
	side: "start" | "end",
): { hasContent: boolean; hasWhitespace: boolean } {
	if (!entry) return { hasContent: false, hasWhitespace: false }
	if (entry.type === "text" || entry.type === "frame-placeholder") {
		const text = entry.text
		if (!text) return { hasContent: false, hasWhitespace: false }
		return {
			hasContent: true,
			hasWhitespace:
				side === "end" ? WHITESPACE_END_RE.test(text) : WHITESPACE_START_RE.test(text),
		}
	}
	return { hasContent: true, hasWhitespace: false }
}

function resolveDocumentInsertionBoundaries(
	editor: MessageEditorRef,
	selection?: MessageEditorSelectionRange,
): { hasContentBefore: boolean; hasContentAfter: boolean } {
	const prompt = editor.getCurrentPrompt?.() ?? ""
	if (!prompt) return { hasContentBefore: false, hasContentAfter: false }
	const from = selection?.from ?? 1
	const to = selection?.to ?? from
	// Single-paragraph editors roughly map PM positions as textOffset + 1.
	return {
		hasContentBefore: from > 1,
		hasContentAfter: to < prompt.length + 1,
	}
}

function toUploadResponseFromReference(asset: CanvasClipboardAsset): UploadFileResponse | null {
	const reference = asset.reference
	if (!reference?.path) return null
	return {
		path: reference.path,
		src: reference.path,
		fileName: reference.fileName || asset.fileName,
		file_id: reference.fileId,
	}
}

function toPanelItemFromReference(asset: CanvasClipboardAsset): ReferenceResourcePanelItem | null {
	const reference = asset.reference
	if (!reference?.path) return null
	return createReferenceResourcePanelItemFromPath(
		reference.path,
		reference.fileName || asset.fileName,
		{
			fileId: reference.fileId,
			mediaType: asset.type,
		},
	)
}

/**
 * Inserts ordered clipboard text/mentions immediately. Unresolved assets and local
 * files become pending chips (prompt) so UI appears before host resolve/upload finishes.
 */
export async function applyRichMessageClipboardParts(
	options: ApplyRichMessageClipboardPartsOptions,
): Promise<RichMessageClipboardSession | null> {
	const {
		parts,
		editor,
		controller,
		selection,
		isSessionCurrent,
		registerPendingResourcePath,
		replaceSelectedSlot,
		appendFrameItem,
		allocateFramePromptPlaceholder,
		uploadFiles,
	} = options
	if (!editor || !isSessionCurrent()) return null

	const resolveDestination =
		options.resolveAssetDestination ??
		((assetIndex: number): RichClipboardAssetDestination =>
			assetIndex === 0 && replaceSelectedSlot ? "selected-slot" : "prompt")

	const planned: PlannedInsert[] = []
	let slotReplaceFile: File | null = null
	const frameUploadFiles: File[] = []
	const pendingByOccurrenceKey = new Map<string, PendingOccurrence>()
	let assetIndex = 0

	const pushFramePlaceholder = (
		destination: "frame" | "selected-slot",
		currentAssetIndex: number,
	): string | null => {
		if (!allocateFramePromptPlaceholder) return null
		const placeholder = allocateFramePromptPlaceholder({
			destination,
			assetIndex: currentAssetIndex,
		})
		if (placeholder) {
			planned.push({ type: "frame-placeholder", text: placeholder })
		}
		return placeholder
	}

	for (const part of parts) {
		if (part.kind === "text") {
			planned.push({ type: "text", text: part.text })
			continue
		}

		const destination = resolveDestination(assetIndex)
		const asset = part.asset

		if (asset.reference?.kind === "current-canvas" || asset.reference?.kind === "project") {
			if (
				asset.reference.kind === "current-canvas" &&
				asset.reference.awaitingAttachmentConfirmation
			) {
				registerPendingResourcePath?.(asset.reference.path)
			}
			const item = createReferenceResourcePanelItemFromPath(
				asset.reference.path,
				asset.reference.fileName || asset.fileName,
				{ fileId: asset.reference.fileId, mediaType: asset.type },
			)
			if (destination === "selected-slot" && replaceSelectedSlot) {
				pushFramePlaceholder("selected-slot", assetIndex)
				replaceSelectedSlot(createUploadFileResponseFromPanelItem(item), {
					retainReferenceSlot: true,
				})
			} else if (destination === "frame") {
				const placeholder = pushFramePlaceholder("frame", assetIndex)
				// Allocator present + null means capacity full — skip append.
				if (!allocateFramePromptPlaceholder || placeholder) {
					appendFrameItem?.(item)
				}
			} else {
				planned.push({ type: "mention", item })
			}
			assetIndex += 1
			continue
		}

		if (asset.file) {
			if (destination === "selected-slot" && replaceSelectedSlot) {
				pushFramePlaceholder("selected-slot", assetIndex)
				slotReplaceFile = asset.file
			} else if (destination === "frame") {
				const placeholder = pushFramePlaceholder("frame", assetIndex)
				if (!allocateFramePromptPlaceholder || placeholder) {
					frameUploadFiles.push(asset.file)
				}
			} else {
				planned.push({
					type: "upload",
					file: asset.file,
					pendingKey: `upload:${assetIndex}`,
				})
			}
			assetIndex += 1
			continue
		}

		// Unresolved message-reference / materialize target: show pending immediately.
		if (destination === "selected-slot") {
			pushFramePlaceholder("selected-slot", assetIndex)
			pendingByOccurrenceKey.set(part.occurrenceKey, { destination: "selected-slot" })
		} else if (destination === "frame") {
			const placeholder = pushFramePlaceholder("frame", assetIndex)
			if (!allocateFramePromptPlaceholder || placeholder) {
				pendingByOccurrenceKey.set(part.occurrenceKey, { destination: "frame" })
			}
		} else {
			planned.push({
				type: "resolving",
				occurrenceKey: part.occurrenceKey,
				fileName: asset.fileName,
				pendingKey: part.occurrenceKey,
			})
		}
		assetIndex += 1
	}

	const pendingPlan = buildPromptPendingPlan(planned)

	let handles: CanvasUploadMentionHandle[] = []
	const pendingItemByKey = new Map<
		string,
		ReturnType<CanvasUploadMentionController["allocateBatch"]>["pendingItems"][number]
	>()
	const handleByKey = new Map<string, CanvasUploadMentionHandle>()

	if (pendingPlan.length > 0) {
		if (!controller) {
			for (let i = 0; i < planned.length; i += 1) {
				const entry = planned[i]
				if (entry?.type === "upload") {
					planned[i] = { type: "text", text: entry.file.name }
				} else if (entry?.type === "resolving") {
					planned[i] = { type: "text", text: entry.fileName }
				}
			}
		} else {
			const allocated = controller.allocateBatch(pendingPlan.map((entry) => entry.file))
			handles = allocated.handles
			pendingPlan.forEach((entry, index) => {
				const pendingItem = allocated.pendingItems[index]
				const handle = allocated.handles[index]
				if (pendingItem) pendingItemByKey.set(entry.pendingKey, pendingItem)
				if (handle) handleByKey.set(entry.pendingKey, handle)
				if (entry.kind === "resolving" && entry.occurrenceKey && handle) {
					pendingByOccurrenceKey.set(entry.occurrenceKey, {
						destination: "prompt",
						handle,
					})
				}
			})
		}
	}

	const insertParts: MessageEditorClipboardInsertPart[] = []
	const documentBoundaries = resolveDocumentInsertionBoundaries(editor, selection)
	for (let index = 0; index < planned.length; index += 1) {
		const entry = planned[index]
		if (!entry) continue
		if (entry.type === "frame-placeholder") {
			const before = resolvePlannedBoundary(planned[index - 1], "end")
			const after = resolvePlannedBoundary(planned[index + 1], "start")
			const isFirst = !before.hasContent && !documentBoundaries.hasContentBefore
			const isLast = !after.hasContent && !documentBoundaries.hasContentAfter
			insertParts.push({
				type: "text",
				text: padBracketPlaceholderText(entry.text, {
					isFirst,
					isLast,
					previousEndsWithWhitespace: before.hasWhitespace,
					nextStartsWithWhitespace: after.hasWhitespace,
				}),
			})
			continue
		}
		if (entry.type === "text") {
			insertParts.push({ type: "text", text: entry.text })
			continue
		}
		if (entry.type === "mention") {
			insertParts.push({ type: "mention", item: entry.item })
			continue
		}
		const pendingItem = pendingItemByKey.get(entry.pendingKey)
		if (pendingItem) {
			insertParts.push({ type: "pending", item: pendingItem })
		} else if (entry.type === "upload") {
			insertParts.push({ type: "text", text: entry.file.name })
		} else {
			insertParts.push({ type: "text", text: entry.fileName })
		}
	}

	if (insertParts.length > 0) {
		const inserted = editor.insertClipboardParts(insertParts, { selection })
		if (!inserted && handles.length > 0) {
			controller?.abandonHandles(handles)
			return null
		}
	} else if (handles.length > 0) {
		controller?.abandonHandles(handles)
	}

	if (!isSessionCurrent()) {
		if (handles.length > 0) controller?.abandonHandles(handles)
		return null
	}

	const uploadTasks: Array<Promise<unknown>> = []

	if (slotReplaceFile) {
		uploadTasks.push(
			uploadFiles([slotReplaceFile], {
				ignoreSelectedReferenceSlot: false,
				retainSelectedReferenceSlot: true,
				suppressPromptMention: true,
				isCurrent: isSessionCurrent,
			}),
		)
	}

	if (frameUploadFiles.length > 0) {
		uploadTasks.push(
			uploadFiles(frameUploadFiles, {
				ignoreSelectedReferenceSlot: true,
				suppressPromptMention: true,
				isCurrent: isSessionCurrent,
			}),
		)
	}

	const uploadPlan = pendingPlan.filter((entry) => entry.kind === "upload")
	if (uploadPlan.length > 0 && controller) {
		uploadTasks.push(
			uploadFiles(
				uploadPlan.map((entry) => entry.file),
				{
					ignoreSelectedReferenceSlot: true,
					suppressPromptMention: true,
					pendingMentionHandles: uploadPlan.map((entry) =>
						handleByKey.get(entry.pendingKey),
					),
					isCurrent: isSessionCurrent,
				},
			),
		)
	}

	if (uploadTasks.length > 0) {
		await Promise.all(uploadTasks)
	}

	const session: RichMessageClipboardSession = {
		async resolveOccurrence(occurrenceKey, asset) {
			if (!isSessionCurrent()) return
			const pending = pendingByOccurrenceKey.get(occurrenceKey)
			pendingByOccurrenceKey.delete(occurrenceKey)

			if (asset.reference) {
				if (
					asset.reference.kind === "current-canvas" &&
					asset.reference.awaitingAttachmentConfirmation
				) {
					registerPendingResourcePath?.(asset.reference.path)
				}
				const uploadInfo = toUploadResponseFromReference(asset)
				const item = toPanelItemFromReference(asset)
				if (!uploadInfo || !item) {
					if (pending?.destination === "prompt")
						controller?.fail(pending.handle, "上传失败")
					return
				}
				if (pending?.destination === "selected-slot") {
					replaceSelectedSlot?.(uploadInfo, { retainReferenceSlot: true })
					return
				}
				if (pending?.destination === "frame") {
					appendFrameItem?.(item)
					return
				}
				if (pending?.destination === "prompt") {
					controller?.resolve(pending.handle, uploadInfo)
					return
				}
				return
			}

			if (asset.file) {
				if (pending?.destination === "selected-slot") {
					await uploadFiles([asset.file], {
						ignoreSelectedReferenceSlot: false,
						retainSelectedReferenceSlot: true,
						suppressPromptMention: true,
						isCurrent: isSessionCurrent,
					})
					return
				}
				if (pending?.destination === "frame") {
					await uploadFiles([asset.file], {
						ignoreSelectedReferenceSlot: true,
						suppressPromptMention: true,
						isCurrent: isSessionCurrent,
					})
					return
				}
				if (pending?.destination === "prompt") {
					await uploadFiles([asset.file], {
						ignoreSelectedReferenceSlot: true,
						suppressPromptMention: true,
						pendingMentionHandles: [pending.handle],
						isCurrent: isSessionCurrent,
					})
					return
				}
			}

			if (pending?.destination === "prompt") {
				controller?.fail(pending.handle, "上传失败")
			}
		},
		failOccurrence(occurrenceKey, error) {
			const pending = pendingByOccurrenceKey.get(occurrenceKey)
			pendingByOccurrenceKey.delete(occurrenceKey)
			if (pending?.destination === "prompt") {
				controller?.fail(pending.handle, error || "上传失败")
			}
		},
	}

	return session
}
