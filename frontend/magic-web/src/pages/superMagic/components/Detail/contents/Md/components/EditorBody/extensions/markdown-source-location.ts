import type { Node as ProseMirrorNode } from "@/infrastructure/editors/tiptap/pm-model"
import { Extension } from "@/infrastructure/editors/tiptap/core"
import { Plugin } from "@/infrastructure/editors/tiptap/pm-state"
import { Decoration, DecorationSet } from "@/infrastructure/editors/tiptap/pm-view"
import type MarkdownIt from "markdown-it"
import type Token from "markdown-it/lib/token.mjs"
import {
	mapSourceRange,
	SOURCE_START,
	SOURCE_END,
	SOURCE_KIND,
	type SourceReplacement,
} from "../source-location"

const SOURCE_ATTRIBUTE = "markdownSourceRange"

/** 使用当前 markdown-it 的 token.map；NodeView 的外层标记由 decoration 负责。 */
export function createMarkdownSourceLocation(
	getParseSource: () => { content: string; replacements: SourceReplacement[] },
) {
	return Extension.create({
		name: "markdownSourceLocation",
		addGlobalAttributes() {
			return [
				{
					types: [
						"paragraph",
						"heading",
						"listItem",
						"taskItem",
						"blockquote",
						"codeBlock",
						"table",
						"tableRow",
						"tableCell",
						"tableHeader",
						"image",
						"markdownFrontmatter",
						"safeHtmlDiv",
					],
					attributes: {
						[SOURCE_ATTRIBUTE]: {
							default: null,
							rendered: false,
							parseHTML: (element: HTMLElement) => {
								const source = element.closest(`[${SOURCE_START}][${SOURCE_END}]`)
								return source
									? {
											start: Number(source.getAttribute(SOURCE_START)),
											end: Number(source.getAttribute(SOURCE_END)),
										}
									: null
							},
						},
					},
				},
			]
		},
		addStorage() {
			return {
				markdown: {
					parse: {
						setup(md: MarkdownIt) {
							// setup 每次解析都会调用。规则按名称替换，不能叠加 renderer 包装。
							const annotateSource: Parameters<typeof md.core.ruler.push>[1] = (
								state,
							) => {
								const parseSource = getParseSource()
								const offsets = [0]
								for (let index = 0; index < parseSource.content.length; index++)
									if (parseSource.content[index] === "\n") offsets.push(index + 1)
								const annotate = (token: Token, inherited?: [number, number]) => {
									const map = token.map ?? inherited
									if (map && token.nesting !== -1) {
										const range = mapSourceRange(
											offsets[map[0]] ?? 0,
											offsets[map[1]] ?? parseSource.content.length,
											parseSource.replacements,
										)
										token.attrSet(SOURCE_START, String(range.start))
										token.attrSet(SOURCE_END, String(range.end))
									}
									token.children?.forEach((child) =>
										annotate(child, map ?? undefined),
									)
								}
								let rowMap: [number, number] | undefined
								state.tokens.forEach((token) => {
									if (token.type === "tr_open") rowMap = token.map ?? undefined
									annotate(
										token,
										/^(th|td)_open$/.test(token.type) ? rowMap : undefined,
									)
								})
							}
							try {
								md.core.ruler.at("markdown_source_location", annotateSource)
							} catch {
								md.core.ruler.push("markdown_source_location", annotateSource)
							}
							for (const name of ["fence", "code_block", "html_block"]) {
								const original = md.renderer.rules[name]
								if (
									!original ||
									(original as typeof original & { sourceLocation?: boolean })
										.sourceLocation
								)
									continue
								const render: NonNullable<typeof original> = (
									tokens,
									index,
									...args
								) => {
									const html = original(tokens, index, ...args)
									const token = tokens[index]
									return `<!--markdown-source:${token.attrGet(SOURCE_START)}:${token.attrGet(SOURCE_END)}-->${html}<!--markdown-source-end-->`
								}
								Object.assign(render, { sourceLocation: true })
								md.renderer.rules[name] = render
							}
						},
						updateDOM(element: HTMLElement) {
							const walker = document.createTreeWalker(
								element,
								NodeFilter.SHOW_COMMENT,
							)
							const comments: Comment[] = []
							while (walker.nextNode()) comments.push(walker.currentNode as Comment)
							for (const comment of comments) {
								const match = comment.data.match(/^markdown-source:(\d+):(\d+)$/)
								if (!match) continue
								let sibling = comment.nextSibling
								while (
									sibling &&
									!(
										sibling.nodeType === Node.COMMENT_NODE &&
										sibling.textContent === "markdown-source-end"
									)
								) {
									if (sibling instanceof HTMLElement) {
										sibling.setAttribute(SOURCE_START, match[1])
										sibling.setAttribute(SOURCE_END, match[2])
									}
									sibling = sibling.nextSibling
								}
							}
						},
					},
				},
			}
		},
		addProseMirrorPlugins() {
			const createDecorations = (doc: ProseMirrorNode) => {
				const decorations: Decoration[] = []
				doc.descendants((node, pos) => {
					const range = node.attrs[SOURCE_ATTRIBUTE] as {
						start: number
						end: number
					} | null
					if (!range || node.isText) return
					decorations.push(
						Decoration.node(pos, pos + node.nodeSize, {
							[SOURCE_START]: String(range.start),
							[SOURCE_END]: String(range.end),
							...(["codeBlock", "markdownFrontmatter"].includes(node.type.name)
								? { [SOURCE_KIND]: "code-block" }
								: {}),
						}),
					)
				})
				return DecorationSet.create(doc, decorations)
			}
			const plugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
				state: {
					init: (_, state) => createDecorations(state.doc),
					// 原文没变时复用位置标记，搜索和光标移动不重新遍历整篇文档。
					apply: (transaction, decorations) =>
						transaction.docChanged ? createDecorations(transaction.doc) : decorations,
				},
				props: { decorations: (state) => plugin.getState(state) ?? null },
			})
			return [plugin]
		},
	})
}
