import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { useOverlayZIndex } from "../useOverlayZIndex"
import {
	acquireOverlayZIndex,
	resetOverlayStackForTest,
} from "@/utils/overlayZIndex/overlayStackManager"

describe("useOverlayZIndex", () => {
	beforeEach(() => {
		resetOverlayStackForTest()
	})

	test("open 从 false 变 true 时分配层级", async () => {
		const { result, rerender } = renderHook(({ open }) => useOverlayZIndex({ open }), {
			initialProps: { open: false },
		})

		expect(result.current.overlayZIndex).toBe(1000)

		rerender({ open: true })

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1010)
		})
		expect(result.current.contentZIndex).toBe(1011)
	})

	test("重复 render 不重复分配层级", async () => {
		const { result, rerender } = renderHook(() =>
			useOverlayZIndex({ open: true, zIndex: 1200 }),
		)

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1200)
		})

		rerender()

		expect(result.current.overlayZIndex).toBe(1200)
	})

	test("open 从 true 变 false 时释放层级", async () => {
		const { result, rerender } = renderHook(({ open }) => useOverlayZIndex({ open }), {
			initialProps: { open: true },
		})

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1010)
		})

		act(() => {
			rerender({ open: false })
		})

		const nextDuringExit = acquireOverlayZIndex({ scope: "global" })
		expect(nextDuringExit.overlayZIndex).toBe(1020)

		act(() => {
			result.current.releaseOverlayZIndex()
			nextDuringExit.release()
		})

		const nextRound = acquireOverlayZIndex({ scope: "global" })
		expect(nextRound.overlayZIndex).toBe(1010)
	})

	test("组件卸载时释放层级", async () => {
		const { result, unmount } = renderHook(() => useOverlayZIndex({ open: true }))

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1010)
		})

		unmount()

		const nextRound = acquireOverlayZIndex({ scope: "global" })
		expect(nextRound.overlayZIndex).toBe(1010)
	})

	test("打开期间 zIndex 变化不触发重新分配", async () => {
		const { result, rerender } = renderHook(
			({ zIndex }) => useOverlayZIndex({ open: true, zIndex }),
			{ initialProps: { zIndex: 1200 } },
		)

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1200)
		})

		rerender({ zIndex: 1300 })

		expect(result.current.overlayZIndex).toBe(1200)
	})

	test("关闭态重复 render 时 releaseOverlayZIndex 引用保持稳定", () => {
		const { result, rerender } = renderHook(() => useOverlayZIndex({ open: false }))

		const firstRelease = result.current.releaseOverlayZIndex
		rerender()
		expect(result.current.releaseOverlayZIndex).toBe(firstRelease)

		act(() => {
			result.current.releaseOverlayZIndex()
			result.current.releaseOverlayZIndex()
		})

		expect(result.current.overlayZIndex).toBe(1000)
	})

	test("显式 release 前保持当前层级占用", async () => {
		const { result, rerender } = renderHook(({ open }) => useOverlayZIndex({ open }), {
			initialProps: { open: true },
		})

		await waitFor(() => {
			expect(result.current.overlayZIndex).toBe(1010)
		})

		rerender({ open: false })

		const nextDuringExit = acquireOverlayZIndex({ scope: "global" })
		expect(nextDuringExit.overlayZIndex).toBe(1020)

		act(() => {
			result.current.releaseOverlayZIndex()
			nextDuringExit.release()
		})

		const nextRound = acquireOverlayZIndex({ scope: "global" })
		expect(nextRound.overlayZIndex).toBe(1010)
	})
})
