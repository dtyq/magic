import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/apis", () => ({
	ContactApi: {},
	FlowApi: {},
}))

import { getMCPAccess, loadMCPWithInstalledConnectorReconciliation } from "../mcp-access"
import { defaultMCPStore } from "../mcp-store"

const createAccess = (
	mcpList: Array<{ id: string }>,
	load = vi.fn().mockResolvedValue(undefined),
) => ({
	mcpList,
	load,
	save: vi.fn().mockResolvedValue(undefined),
})

describe("getMCPAccess", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("returns shared default store without params", () => {
		expect(getMCPAccess()).toBe(defaultMCPStore)
	})

	it("returns cached project store for the same storage key", () => {
		const firstAccess = getMCPAccess({ storageKey: "project-id" })
		const secondAccess = getMCPAccess({ storageKey: "project-id" })

		expect(firstAccess).toBe(secondAccess)
		expect(firstAccess).not.toBe(defaultMCPStore)
	})

	it("returns shared temp store when temp storage is enabled", () => {
		const firstAccess = getMCPAccess({ useTempStorage: true })
		const secondAccess = getMCPAccess({ useTempStorage: true })

		expect(firstAccess).toBe(secondAccess)
		expect(firstAccess).not.toBe(defaultMCPStore)
	})

	it("clears project connectors when the installed bucket is empty", async () => {
		const installedAccess = createAccess([])
		const activeAccess = createAccess([{ id: "project-mcp" }])

		await loadMCPWithInstalledConnectorReconciliation({
			installedAccess: installedAccess as never,
			activeAccess: activeAccess as never,
			activeStorageKey: "project-id",
		})

		expect(activeAccess.save).toHaveBeenCalledWith({
			selectedIds: new Set(),
			items: [],
		})
		expect(installedAccess.save).not.toHaveBeenCalled()
	})

	it("removes only project connectors that are not installed", async () => {
		const installedAccess = createAccess([{ id: "shared-mcp" }, { id: "installed-only" }])
		const activeAccess = createAccess([{ id: "shared-mcp" }, { id: "project-only" }])

		await loadMCPWithInstalledConnectorReconciliation({
			installedAccess: installedAccess as never,
			activeAccess: activeAccess as never,
			activeStorageKey: "project-id",
		})

		expect(activeAccess.save).toHaveBeenCalledWith({
			selectedIds: new Set(["shared-mcp"]),
			items: [{ id: "shared-mcp" }],
		})
	})

	it("does not enable installed connectors missing from the project setting", async () => {
		const installedAccess = createAccess([{ id: "shared-mcp" }, { id: "installed-only" }])
		const activeAccess = createAccess([{ id: "shared-mcp" }])

		await loadMCPWithInstalledConnectorReconciliation({
			installedAccess: installedAccess as never,
			activeAccess: activeAccess as never,
			activeStorageKey: "project-id",
		})

		expect(activeAccess.save).not.toHaveBeenCalled()
	})

	it.each(["installed", "active"])(
		"does not clean the project setting when the %s request fails",
		async (failedAccess) => {
			const failedLoad = vi.fn().mockRejectedValue(new Error("request failed"))
			const installedAccess = createAccess(
				[],
				failedAccess === "installed" ? failedLoad : undefined,
			)
			const activeAccess = createAccess(
				[{ id: "project-mcp" }],
				failedAccess === "active" ? failedLoad : undefined,
			)

			await expect(
				loadMCPWithInstalledConnectorReconciliation({
					installedAccess: installedAccess as never,
					activeAccess: activeAccess as never,
					activeStorageKey: `failed-${failedAccess}`,
				}),
			).rejects.toThrow("request failed")

			expect(activeAccess.save).not.toHaveBeenCalled()
		},
	)

	it("shares an in-flight cleanup between input surfaces", async () => {
		const installedAccess = createAccess([])
		const activeAccess = createAccess([{ id: "project-mcp" }])

		await Promise.all([
			loadMCPWithInstalledConnectorReconciliation({
				installedAccess: installedAccess as never,
				activeAccess: activeAccess as never,
				activeStorageKey: "project-id",
			}),
			loadMCPWithInstalledConnectorReconciliation({
				installedAccess: installedAccess as never,
				activeAccess: activeAccess as never,
				activeStorageKey: "project-id",
			}),
		])

		expect(activeAccess.save).toHaveBeenCalledTimes(1)
	})
})
