import { diffArrays } from "diff"
import { Fragment, Slice, type Node as PMNode } from "@/infrastructure/editors/tiptap/pm-model"
import type { AiPatchItem } from "./types"

let proposalSequence = 0

interface Token {
	node: PMNode
	size: number
}

function sameMarkup(before: PMNode, after: PMNode): boolean {
	// Markdown omits editor-generated node IDs. An absent ID must not turn an unchanged
	// heading into a replacement, while explicit IDs and semantic attributes still compare.
	if (before.attrs.id && after.attrs.id == null)
		return before.type
			.create({ ...before.attrs, id: null }, before.content, before.marks)
			.sameMarkup(after)
	return before.sameMarkup(after)
}

function sameNode(before: PMNode, after: PMNode): boolean {
	if (!sameMarkup(before, after) || before.childCount !== after.childCount) return false
	if (before.isText) return before.text === after.text
	for (let index = 0; index < before.childCount; index++)
		if (!sameNode(before.child(index), after.child(index))) return false
	return true
}

function inlineTokens(node: PMNode): Token[] {
	const tokens: Token[] = []
	node.forEach((child) => {
		if (child.isText) {
			// Code points keep emoji intact while size retains ProseMirror's UTF-16 offsets.
			for (const value of child.text || "")
				tokens.push({
					node: child.type.schema.text(value, child.marks),
					size: value.length,
				})
		} else tokens.push({ node: child, size: child.nodeSize })
	})
	return tokens
}

export function diffDocuments(before: PMNode, after: PMNode, revision: number): AiPatchItem[] {
	const patches: AiPatchItem[] = []
	const proposalId = ++proposalSequence

	function add(from: number, to: number, replacement: Slice, kind: AiPatchItem["kind"]) {
		const oldContent = before.slice(from, to)
		patches.push({
			id: `ai-patch-${proposalId}-${patches.length}`,
			from,
			to,
			kind,
			oldContent,
			replacement,
			oldText: oldContent.content.textBetween(0, oldContent.content.size, "\n"),
			newText: replacement.content.textBetween(0, replacement.content.size, "\n"),
			revision,
		})
	}

	function compareInline(oldNode: PMNode, newNode: PMNode, start: number) {
		const changes = diffArrays(inlineTokens(oldNode), inlineTokens(newNode), {
			comparator: (left, right) => left.node.eq(right.node),
			timeout: 100,
		})
		// A completely rewritten large paragraph must not monopolize the editor's main thread.
		if (!changes) {
			add(start, start + oldNode.content.size, new Slice(newNode.content, 0, 0), "inline")
			return
		}
		let position = start
		let from = start
		let removed = 0
		let added: PMNode[] = []
		function flush() {
			if (removed || added.length)
				add(from, from + removed, new Slice(Fragment.fromArray(added), 0, 0), "inline")
			removed = 0
			added = []
		}
		for (const change of changes) {
			if (!change.added && !change.removed) {
				flush()
				position += change.value.reduce((size, token) => size + token.size, 0)
				from = position
			} else if (change.removed) {
				removed += change.value.reduce((size, token) => size + token.size, 0)
				position += change.value.reduce((size, token) => size + token.size, 0)
			} else added.push(...change.value.map((token) => token.node))
		}
		flush()
	}

	function compareChildren(oldNode: PMNode, newNode: PMNode, start: number) {
		const children = (node: PMNode) => {
			const result: PMNode[] = []
			node.forEach((child) => result.push(child))
			return result
		}
		const changes = diffArrays(children(oldNode), children(newNode), {
			comparator: sameNode,
			timeout: 100,
		})
		if (!changes) {
			add(start, start + oldNode.content.size, new Slice(newNode.content, 0, 0), "block")
			return
		}
		let position = start
		let from = start
		let removed: PMNode[] = []
		let added: PMNode[] = []
		function flush() {
			if (removed.length === added.length) {
				let cursor = from
				removed.forEach((oldChild, index) => {
					const newChild = added[index]
					if (sameMarkup(oldChild, newChild) && !oldChild.isLeaf) {
						if (oldChild.isTextblock) compareInline(oldChild, newChild, cursor + 1)
						else compareChildren(oldChild, newChild, cursor + 1)
					} else
						add(
							cursor,
							cursor + oldChild.nodeSize,
							new Slice(Fragment.from(newChild), 0, 0),
							"block",
						)
					cursor += oldChild.nodeSize
				})
			} else if (removed.length || added.length) {
				add(from, position, new Slice(Fragment.fromArray(added), 0, 0), "block")
			}
			removed = []
			added = []
		}
		for (const change of changes) {
			if (!change.added && !change.removed) {
				flush()
				position += change.value.reduce((size, node) => size + node.nodeSize, 0)
				from = position
			} else if (change.removed) {
				removed.push(...change.value)
				position += change.value.reduce((size, node) => size + node.nodeSize, 0)
			} else added.push(...change.value)
		}
		flush()
	}

	compareChildren(before, after, 0)
	return patches
}
