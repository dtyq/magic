import { act, renderHook } from "@testing-library/react"
import { useState, type ReactNode, type RefObject } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StylePanelStoreProvider } from "../../../../iframe-bridge/contexts/StylePanelContext"
import type { HTMLEditorV2Ref } from "../../../../iframe-bridge/types/props"
import type { SelectedInfo } from "../../types"
import { useSelectionMessages } from "../useSelectionMessages"

describe("useSelectionMessages", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("does not let a delayed deselection clear a newer selection", async () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		try {
			const pendingDisable: Array<() => void> = []
			const disableTextEditing = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						pendingDisable.push(resolve)
					}),
			)
			const editorRef = {
				current: { disableTextEditing } as unknown as HTMLEditorV2Ref,
			} as RefObject<HTMLEditorV2Ref>
			const previousSelection: SelectedInfo = {
				selector: "img.previous",
				rect: { top: 10, left: 10, width: 20, height: 20 },
				computedStyles: {},
			}
			const nextSelection: SelectedInfo = {
				selector: "img.next",
				rect: { top: 20, left: 20, width: 20, height: 20 },
				computedStyles: {},
			}

			const wrapper = ({ children }: { children: ReactNode }) => (
				<StylePanelStoreProvider>{children}</StylePanelStoreProvider>
			)
			const { result } = renderHook(
				() => {
					const [selectedInfoList, setSelectedInfoList] = useState([previousSelection])
					useSelectionMessages({
						iframeRef: { current: iframe },
						editorRef,
						selectedInfoList,
						setSelectedInfoList,
						setHoveredRect: vi.fn(),
						setIsSelectionMode: vi.fn(),
					})
					return selectedInfoList
				},
				{ wrapper },
			)

			const dispatch = (type: string, payload?: unknown) => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: { version: "1.0.0", category: "event", type, payload },
						source: iframe.contentWindow,
					}),
				)
			}

			await act(async () => {
				dispatch("ELEMENTS_DESELECTED", {})
				dispatch("ELEMENT_SELECTED", {
					selector: nextSelection.selector,
					tagName: "img",
					rect: nextSelection.rect,
					computedStyles: {},
					isImageElement: true,
				})
				await Promise.resolve()
			})

			expect(pendingDisable).toHaveLength(2)

			await act(async () => {
				pendingDisable[1]()
				await Promise.resolve()
			})
			expect(result.current).toEqual([
				expect.objectContaining({ selector: nextSelection.selector }),
			])

			await act(async () => {
				pendingDisable[0]()
				await Promise.resolve()
			})
			expect(result.current).toEqual([
				expect.objectContaining({ selector: nextSelection.selector }),
			])
		} finally {
			iframe.remove()
		}
	})

	it("maps childRects from ELEMENT_SELECTED onto selectedInfoList[0]", async () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		try {
			const childRects = [
				{ top: 8, left: 8, width: 80, height: 40, position: "static", display: "block" },
				{ top: 8, left: 108, width: 80, height: 40, position: "static", display: "block" },
			]
			const wrapper = ({ children }: { children: ReactNode }) => (
				<StylePanelStoreProvider>{children}</StylePanelStoreProvider>
			)
			const { result } = renderHook(
				() => {
					const [selectedInfoList, setSelectedInfoList] = useState<SelectedInfo[]>([])
					useSelectionMessages({
						iframeRef: { current: iframe },
						selectedInfoList,
						setSelectedInfoList,
						setHoveredRect: vi.fn(),
						setIsSelectionMode: vi.fn(),
					})
					return selectedInfoList
				},
				{ wrapper },
			)

			await act(async () => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							version: "1.0.0",
							category: "event",
							type: "ELEMENT_SELECTED",
							payload: {
								selector: "div#cards",
								tagName: "div",
								rect: { top: 0, left: 0, width: 200, height: 40 },
								computedStyles: {},
								childRects,
							},
						},
						source: iframe.contentWindow,
					}),
				)
				await Promise.resolve()
			})

			expect(result.current[0]?.childRects).toEqual(childRects)
		} finally {
			iframe.remove()
		}
	})
})
