import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { useMobileAntdPopupLayer } from "../useMobileAntdPopupLayer"
import {
	acquireOverlayZIndex,
	getOverlayScopeBaseZIndex,
	resetOverlayStackForTest,
} from "@/utils/overlayZIndex/overlayStackManager"

describe("useMobileAntdPopupLayer", () => {
	beforeEach(() => {
		resetOverlayStackForTest()
		document
			.querySelectorAll("[data-mobile-antd-popup-layer]")
			.forEach((node) => node.parentNode?.removeChild(node))
	})

	test("open=true 时 overlayZIndex 高于全局基准", async () => {
		const { result, rerender } = renderHook(({ open }) => useMobileAntdPopupLayer({ open }), {
			initialProps: { open: false },
		})

		expect(result.current.overlayZIndex).toBe(getOverlayScopeBaseZIndex("global"))

		rerender({ open: true })

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBeGreaterThan(getOverlayScopeBaseZIndex("global"))
		})
	})

	test("嵌套浮层时第二次 acquire 层级更高", async () => {
		const modalLayer = acquireOverlayZIndex({ scope: "global" })

		const { result, rerender } = renderHook(({ open }) => useMobileAntdPopupLayer({ open }), {
			initialProps: { open: false },
		})

		rerender({ open: true })

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBeGreaterThan(modalLayer.contentZIndex)
		})

		modalLayer.release()
	})

	test("open=false 后释放层级并可回收", async () => {
		const { result, rerender } = renderHook(({ open }) => useMobileAntdPopupLayer({ open }), {
			initialProps: { open: true },
		})

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1010)
		})

		act(() => {
			rerender({ open: false })
		})

		const nextRound = acquireOverlayZIndex({ scope: "global" })
		expect(nextRound.overlayZIndex).toBe(1010)
		nextRound.release()
	})

	test("open=true 时创建 portal 容器并供 getContainer 返回", async () => {
		const { result, rerender } = renderHook(({ open }) => useMobileAntdPopupLayer({ open }), {
			initialProps: { open: false },
		})

		rerender({ open: true })

		await waitFor(() => {
			const container = result.current.getContainer()
			expect(container).not.toBe(document.body)
			expect(container.getAttribute("data-mobile-antd-popup-layer")).toBe("true")
		})
	})

	test("open=false 时移除 portal 容器", async () => {
		const { result, rerender } = renderHook(({ open }) => useMobileAntdPopupLayer({ open }), {
			initialProps: { open: true },
		})

		await waitFor(() => {
			expect(document.querySelectorAll("[data-mobile-antd-popup-layer]").length).toBe(1)
		})

		rerender({ open: false })

		await waitFor(() => {
			expect(document.querySelectorAll("[data-mobile-antd-popup-layer]").length).toBe(0)
		})

		expect(result.current.getContainer()).toBe(document.body)
	})
})
