import Mention from "@tiptap/extension-mention"
import type { Editor } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { Suggestion } from "@tiptap/suggestion"
import { Plugin, PluginKey } from "@tiptap/pm/state"

// Types
import type { MentionPanelPluginOptions, TiptapMentionAttributes } from "./types"
import {
	getMentionUniqueId,
	getMentionDisplayName,
	getMentionDescription,
	getMentionIcon,
} from "./types"

// Suggestion configuration
import { createMentionPanelSuggestion } from "./suggestion"
import { MentionItemType } from "../types"
import MentionNodeView from "./MentionNodeView"

function deletePreviousTextCharBeforeMention(editor: Editor) {
	const { selection } = editor.state
	if (!selection.empty) return false

	const { $from, from } = selection
	const nodeBefore = $from.nodeBefore
	const nodeAfter = $from.nodeAfter

	if (!nodeBefore?.isText || nodeAfter?.type.name !== "mention") {
		return false
	}

	if ((nodeBefore.text?.length ?? 0) === 0 || from <= 0) {
		return false
	}

	editor.view.dispatch(editor.state.tr.delete(from - 1, from))
	return true
}

function deleteNextTextCharAfterMention(editor: Editor) {
	const { selection } = editor.state
	if (!selection.empty) return false

	const { $from, from } = selection
	const nodeBefore = $from.nodeBefore
	const nodeAfter = $from.nodeAfter

	if (nodeBefore?.type.name !== "mention" || !nodeAfter?.isText) {
		return false
	}

	if ((nodeAfter.text?.length ?? 0) === 0) {
		return false
	}

	editor.view.dispatch(editor.state.tr.delete(from, from + 1))
	return true
}

/**
 * MentionExtension - Tiptap extension for MentionPanel integration
 *
 * Extends the base Mention extension to use our custom MentionPanel component
 * instead of the default suggestion dropdown.
 */
export const MentionExtension = Mention.extend<MentionPanelPluginOptions>({
	name: "mention",

	priority: 1000, // Higher priority to override default mention

	addOptions() {
		return {
			...this.parent?.(),
			language: "en",
			searchPlaceholder: undefined,
			allowSpaces: true,
			allowedPrefixes: null,
			renderText: ({ node }) =>
				`@${getMentionDisplayName(node.attrs as TiptapMentionAttributes)}`,
			getParentContainer: undefined,
			onInsert: undefined,
			onInsertItems: undefined,
			onRemove: undefined,
			onRemoveItems: undefined,
			disableKeyboardShortcuts: false,
			isAllowedMention: undefined,
			dataService: undefined,
			nodeViewRenderers: undefined,
			shouldSkipInsertSync: undefined,
			shouldSkipRemoveSync: undefined,
		}
	},

	addNodeView() {
		return ReactNodeViewRenderer(MentionNodeView)
	},

	addStorage() {
		return {
			language: this.options.language,
			disableKeyboardShortcuts: this.options.disableKeyboardShortcuts,
			enabled: true,
			// 最近一次通过键盘输入 "@" 的时间戳（毫秒）
			lastAtInputAt: 0,
			// 最近一次通过键盘输入 "@" 在文档中的起始位置
			lastAtInputPos: -1,
		}
	},

	addAttributes() {
		const parentAttrs =
			(this.parent?.() as Record<string, Record<string, unknown>> | undefined) || {}
		const idAttrs = parentAttrs.id || {}
		const labelAttrs = parentAttrs.label || {}
		const mentionSuggestionCharAttrs = parentAttrs.mentionSuggestionChar || {}
		return {
			...parentAttrs,
			id: {
				default: null,
				...idAttrs,
			},
			label: {
				default: null,
				...labelAttrs,
			},
			mentionSuggestionChar: {
				default: "@",
				...mentionSuggestionCharAttrs,
			},
			type: {
				default: "default",
				parseHTML: (element) => {
					return element.getAttribute("data-type") || "default"
				},
				renderHTML: (attributes) => ({ "data-type": attributes.type }),
			},
			data: {
				default: {},
				parseHTML: (element) => {
					const data = element.getAttribute("data-data")
					try {
						return data ? JSON.parse(data) : {}
					} catch {
						return {}
					}
				},
				renderHTML: (attributes) => ({
					"data-data": JSON.stringify(attributes.data || {}),
				}),
			},
		}
	},

	addKeyboardShortcuts() {
		return {
			// Handle Backspace key - delete entire mention when cursor is inside or right after mention
			Backspace: ({ editor }) => {
				// Check if mention extension is enabled
				if (!this.storage.enabled) {
					return false
				}

				const { selection, doc } = editor.state
				const { from, to, empty } = selection

				if (!empty) {
					return false
				}

				// Fallback for marker-like mentions whose custom NodeView can make the
				// browser/PM default backspace path no-op at the text|mention boundary.
				if (deletePreviousTextCharBeforeMention(editor)) {
					return true
				}

				// Check if cursor is right after a mention node
				if (from > 0) {
					const nodeAfter = doc.nodeAt(from - 1)
					if (nodeAfter && nodeAfter.type.name === "mention") {
						// Delete the entire mention node
						const tr = editor.state.tr.delete(from - 1, from)
						editor.view.dispatch(tr)
						return true
					}
				}

				// Check if cursor is inside a mention node
				const resolvedPos = doc.resolve(from)
				let mentionNode = null
				let mentionPos = -1

				// Find the closest mention node
				for (let depth = resolvedPos.depth; depth >= 0; depth--) {
					const node = resolvedPos.node(depth)
					if (node.type.name === "mention") {
						mentionNode = node
						mentionPos = resolvedPos.start(depth) - 1
						break
					}
				}

				if (mentionNode && mentionPos >= 0) {
					// Delete the entire mention node
					const tr = editor.state.tr.delete(mentionPos, mentionPos + mentionNode.nodeSize)
					editor.view.dispatch(tr)
					return true
				}

				return false
			},

			// Handle Delete key - delete entire mention when cursor is inside or right before mention
			Delete: ({ editor }) => {
				// Check if mention extension is enabled
				if (!this.storage.enabled) {
					return false
				}

				const { selection, doc } = editor.state
				const { from, to, empty } = selection

				if (!empty) {
					return false
				}

				// Symmetric fallback for deleting the first character after a mention.
				if (deleteNextTextCharAfterMention(editor)) {
					return true
				}

				// Check if cursor is right before a mention node
				if (from < doc.content.size) {
					const nodeAfter = doc.nodeAt(from)
					if (nodeAfter && nodeAfter.type.name === "mention") {
						// Delete the entire mention node
						const tr = editor.state.tr.delete(from, from + nodeAfter.nodeSize)
						editor.view.dispatch(tr)
						return true
					}
				}

				// Check if cursor is inside a mention node
				const resolvedPos = doc.resolve(from)
				let mentionNode = null
				let mentionPos = -1

				// Find the closest mention node
				for (let depth = resolvedPos.depth; depth >= 0; depth--) {
					const node = resolvedPos.node(depth)
					if (node.type.name === "mention") {
						mentionNode = node
						mentionPos = resolvedPos.start(depth) - 1
						break
					}
				}

				if (mentionNode && mentionPos >= 0) {
					// Delete the entire mention node
					const tr = editor.state.tr.delete(mentionPos, mentionPos + mentionNode.nodeSize)
					editor.view.dispatch(tr)
					return true
				}

				return false
			},
		}
	},

	addCommands() {
		return {
			updateMentionLanguage: (language: string) => () => {
				this.storage.language = language
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				this.options.language = language as any
				return true
			},
			updateMentionKeyboardShortcuts: (disabled: boolean) => () => {
				this.storage.disableKeyboardShortcuts = disabled
				this.options.disableKeyboardShortcuts = disabled
				return true
			},
			updateMentionEnabled: (enabled: boolean) => () => {
				this.storage.enabled = enabled
				return true
			},
		}
	},

	addProseMirrorPlugins() {
		// Use our custom suggestion plugin and deletion tracking plugin
		return [
			// 记录用户最近一次输入 @ 的时间，用于 suggestion 激活门控
			new Plugin({
				key: new PluginKey("mentionTriggerTracker"),
				props: {
					handleTextInput: (_view, from, _to, text) => {
						const lastAtIndex = text.lastIndexOf("@")
						if (lastAtIndex !== -1) {
							this.storage.lastAtInputAt = Date.now()
							this.storage.lastAtInputPos = from + lastAtIndex
						}
						return false
					},
				},
			}),
			Suggestion({
				editor: this.editor,
				...createMentionPanelSuggestion(this.options),
			}),
			// Plugin to track mention insertions (including paste)
			new Plugin({
				key: new PluginKey("mentionInsertion"),
				appendTransaction: (transactions, oldState, newState) => {
					const { onInsert, onInsertItems } = this.options

					if (!onInsert && !onInsertItems) return

					const tr = newState.tr

					// Check for inserted mentions
					const insertedMentions: TiptapMentionAttributes[] = []

					// Get all mention nodes from old state
					const oldMentions = new Map<
						string,
						{
							item: TiptapMentionAttributes
							pos: number
						}
					>()
					oldState.doc.descendants((node, pos) => {
						if (node.type.name === "mention") {
							const attrs = node.attrs as TiptapMentionAttributes
							const uniqueId = getMentionUniqueId(attrs)
							oldMentions.set(`${pos}-${uniqueId}`, {
								item: {
									type: attrs.type,
									data: attrs.data,
								},
								pos,
							})
						}
					})

					// Get all mention nodes from new state
					const newMentions = new Map<string, TiptapMentionAttributes>()
					newState.doc.descendants((node, pos) => {
						if (node.type.name === "mention") {
							const attrs = node.attrs as TiptapMentionAttributes
							const uniqueId = getMentionUniqueId(attrs)

							const isAllowed = this.options.dataService
								? (this.options.isAllowedMention?.(
										attrs,
										this.options.dataService,
									) ?? true)
								: true

							if (!isAllowed) {
								tr.delete(pos, pos + node.nodeSize)
							} else {
								newMentions.set(`${pos}-${uniqueId}`, {
									type: attrs.type,
									data: attrs.data,
								})
							}
						}
					})

					// Find inserted mentions
					Array.from(newMentions.entries()).forEach(([key, mentionAttrs]) => {
						if (!oldMentions.has(key)) {
							insertedMentions.push(mentionAttrs)
						}
					})

					// 去重处理：基于 mention 的唯一 ID 去重
					const uniqueInsertedMentions = Array.from(
						new Map(
							insertedMentions.map((mention) => [
								getMentionUniqueId(mention),
								mention,
							]),
						).values(),
					)

					// 恢复内容期间跳过，避免与 restoreMentionItems 冲突
					if (this.options.shouldSkipInsertSync?.()) {
						return tr
					}

					if (uniqueInsertedMentions.length > 0) {
						const mentionItems = uniqueInsertedMentions.map((mention) => ({
							id: getMentionUniqueId(mention),
							type: mention.type,
							name: getMentionDisplayName(mention),
							icon: getMentionIcon(mention),
							description: getMentionDescription(mention),
							data: mention.data,
						}))

						// 优先使用 onInsertItems 批量处理
						if (onInsertItems) {
							onInsertItems(mentionItems)
						} else if (onInsert) {
							// onInsert 现在只处理单个 mention
							mentionItems.forEach((item) => onInsert(item))
						}
					}

					return tr
				},
			}),
			// Plugin to track mention deletions
			new Plugin({
				key: new PluginKey("mentionRemoval"),
				appendTransaction: (transactions, oldState, newState) => {
					const {
						onRemove,
						onRemoveItems,
						shouldSkipRemoveSync,
						shouldRestoreRemovedMention,
					} = this.options

					if (!onRemove && !onRemoveItems) return
					if (shouldSkipRemoveSync?.()) {
						return
					}

					// Check for deleted mentions
					const deletedMentions: Array<{
						item: TiptapMentionAttributes
						pos: number
					}> = []

					// Get all mention nodes from old state
					const oldMentions = new Map<
						string,
						{
							item: TiptapMentionAttributes
							pos: number
						}
					>()
					oldState.doc.descendants((node, pos) => {
						if (node.type.name === "mention") {
							const attrs = node.attrs as TiptapMentionAttributes
							const uniqueId = getMentionUniqueId(attrs)
							oldMentions.set(`${pos}-${uniqueId}`, {
								item: {
									type: attrs.type,
									data: attrs.data,
								},
								pos,
							})
						}
					})

					// Get all mention nodes from new state
					const newMentions = new Map<string, TiptapMentionAttributes>()
					newState.doc.descendants((node, pos) => {
						if (node.type.name === "mention") {
							const attrs = node.attrs as TiptapMentionAttributes
							const uniqueId = getMentionUniqueId(attrs)
							newMentions.set(`${pos}-${uniqueId}`, {
								type: attrs.type,
								data: attrs.data,
							})
						}
					})

					// Find deleted mentions
					Array.from(oldMentions.entries()).forEach(([key, mentionAttrs]) => {
						if (!newMentions.has(key)) {
							deletedMentions.push({
								item: mentionAttrs.item,
								pos: mentionAttrs.pos,
							})
						}
					})

					// Check if deleted mentions still exist elsewhere in the document
					const itemsToRemove: { item: TiptapMentionAttributes; stillExists: boolean }[] =
						[]
					const mentionsToRestore: Array<{
						item: TiptapMentionAttributes
						pos: number
					}> = []

					deletedMentions.forEach((deletedMention) => {
						const deletedId = getMentionUniqueId(deletedMention.item)
						const stillExists = Array.from(newMentions.values()).some(
							(mention) => getMentionUniqueId(mention) === deletedId,
						)
						itemsToRemove.push({ item: deletedMention.item, stillExists })

						if (
							!stillExists &&
							shouldRestoreRemovedMention?.(deletedMention.item, stillExists)
						) {
							mentionsToRestore.push(deletedMention)
						}
					})

					const restoreTransaction = newState.tr
					const mentionNode = newState.schema.nodes.mention
					if (mentionsToRestore.length > 0) {
						mentionsToRestore
							.map((mention) => ({
								...mention,
								pos: transactions.reduce((position, transaction) => {
									return transaction.mapping.map(position, -1)
								}, mention.pos),
							}))
							.sort((left, right) => left.pos - right.pos)
							.forEach((mention) => {
								const restorePos = Math.max(
									0,
									Math.min(mention.pos, restoreTransaction.doc.content.size),
								)
								restoreTransaction.insert(
									restorePos,
									mentionNode.create(mention.item),
								)
							})
					}

					// 批量处理移除的 mentions
					if (itemsToRemove.length > 0) {
						// 优先使用 onRemoveItems 批量处理
						if (onRemoveItems) {
							onRemoveItems(itemsToRemove)
						} else if (onRemove) {
							// 兼容旧的 onRemove 接口
							itemsToRemove.forEach(({ item, stillExists }) => {
								onRemove(item, stillExists)
							})
						}
					}

					if (restoreTransaction.steps.length > 0) {
						return restoreTransaction
					}

					return null
				},
			}),
		]
	},

	renderHTML({ node, HTMLAttributes }) {
		const attrs = node.attrs as TiptapMentionAttributes
		let displayName = getMentionDisplayName(attrs)
		const description = getMentionDescription(attrs)
		const icon = getMentionIcon(attrs)
		const uniqueId = getMentionUniqueId(attrs)

		if (attrs.type === MentionItemType.FOLDER) {
			displayName = `${displayName}/`
		}

		return [
			"span",
			{
				...HTMLAttributes,
				class: "magic-mention",
				"data-id": uniqueId,
				"data-label": displayName,
				"data-type": attrs.type,
				"data-description": description,
				"data-icon": icon,
				"data-data": JSON.stringify(attrs.data || {}),
			},
			`@${displayName}`,
		]
	},

	parseHTML() {
		return [
			{
				tag: "span.magic-mention",
				getAttrs: (element) => {
					const el = element as HTMLElement
					const type = el.getAttribute("data-type") || "default"

					if (type === MentionItemType.MCP) {
						return false
					}

					let data = {}
					try {
						const dataStr = el.getAttribute("data-data")
						data = dataStr ? JSON.parse(dataStr) : {}
					} catch {
						data = {}
					}
					return { type, data }
				},
			},
		]
	},
})

export default MentionExtension
