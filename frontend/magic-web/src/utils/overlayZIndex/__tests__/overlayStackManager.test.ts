import { beforeEach, describe, expect, test } from "vitest"

import { acquireOverlayZIndex, resetOverlayStackForTest } from "../overlayStackManager"

describe("overlayStackManager", () => {
	beforeEach(() => {
		resetOverlayStackForTest()
	})

	test("后打开的浮层层级更高", () => {
		const first = acquireOverlayZIndex({ scope: "global" })
		const second = acquireOverlayZIndex({ scope: "global" })

		expect(first.overlayZIndex).toBe(1010)
		expect(first.contentZIndex).toBe(1011)
		expect(second.overlayZIndex).toBe(1020)
		expect(second.contentZIndex).toBe(1021)
	})

	test("乱序释放后中途打开的新浮层沿用本轮最高游标", () => {
		const first = acquireOverlayZIndex({ scope: "global" })
		const second = acquireOverlayZIndex({ scope: "global" })
		const third = acquireOverlayZIndex({ scope: "global" })

		second.release()
		third.release()

		const fourth = acquireOverlayZIndex({ scope: "global" })

		expect(first.overlayZIndex).toBe(1010)
		expect(fourth.overlayZIndex).toBe(1040)
	})

	test("activeCount 清空后游标回到 scope 基准", () => {
		const first = acquireOverlayZIndex({ scope: "global" })
		const second = acquireOverlayZIndex({ scope: "global" })

		first.release()
		second.release()

		const nextRound = acquireOverlayZIndex({ scope: "global" })

		expect(nextRound.overlayZIndex).toBe(1010)
	})

	test("显式 zIndex 默认参与自动管理并抬高后续分配", () => {
		const first = acquireOverlayZIndex({ scope: "global" })
		const elevated = acquireOverlayZIndex({ scope: "global", zIndex: 1300 })
		const afterElevated = acquireOverlayZIndex({ scope: "global" })

		expect(first.overlayZIndex).toBe(1010)
		expect(elevated.overlayZIndex).toBe(1300)
		expect(afterElevated.overlayZIndex).toBe(1310)
	})

	test("zIndexManaged 为 false 时不注册且不影响后续分配", () => {
		const manual = acquireOverlayZIndex({
			scope: "global",
			zIndex: 1300,
			zIndexManaged: false,
		})
		const managed = acquireOverlayZIndex({ scope: "global" })

		expect(manual.overlayZIndex).toBe(1300)
		expect(manual.contentZIndex).toBe(1301)
		expect(managed.overlayZIndex).toBe(1010)

		manual.release()
		const afterManualRelease = acquireOverlayZIndex({ scope: "global" })

		expect(afterManualRelease.overlayZIndex).toBe(1020)
	})

	test("不同 scope 的层级互不影响", () => {
		const globalEntry = acquireOverlayZIndex({ scope: "global" })
		const fullscreenEntry = acquireOverlayZIndex({ scope: "fullscreen" })
		const nextGlobalEntry = acquireOverlayZIndex({ scope: "global" })

		expect(globalEntry.overlayZIndex).toBe(1010)
		expect(fullscreenEntry.overlayZIndex).toBe(9010)
		expect(nextGlobalEntry.overlayZIndex).toBe(1020)
	})

	test("release 重复调用只释放一次", () => {
		const first = acquireOverlayZIndex({ scope: "global" })
		const second = acquireOverlayZIndex({ scope: "global" })

		first.release()
		first.release()
		second.release()

		const nextRound = acquireOverlayZIndex({ scope: "global" })

		expect(nextRound.overlayZIndex).toBe(1010)
	})

	test("交易层最低 1400 在栈顶已超过 1400 时仍能盖住其它浮层", () => {
		const elevated = acquireOverlayZIndex({ scope: "global", zIndex: 1500 })
		const stacked = acquireOverlayZIndex({ scope: "global" })
		const paidPackage = acquireOverlayZIndex({ zIndex: 1400 })

		expect(elevated.overlayZIndex).toBe(1500)
		expect(stacked.contentZIndex).toBe(1511)
		expect(paidPackage.overlayZIndex).toBeGreaterThanOrEqual(1400)
		expect(paidPackage.contentZIndex).toBeGreaterThan(stacked.contentZIndex)

		paidPackage.release()
		stacked.release()
		elevated.release()
	})
})
