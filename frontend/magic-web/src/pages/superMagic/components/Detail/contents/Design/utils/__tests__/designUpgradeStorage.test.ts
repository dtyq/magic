import { beforeEach, describe, expect, it } from "vitest"
import {
	clearPendingDesignUpgrade,
	readPendingDesignUpgrade,
	writePendingDesignUpgrade,
} from "../designUpgradeStorage"

const identity = {
	projectId: "project-1",
	designProjectId: "design-1",
	magicProjectJsFileId: "file-1",
}

describe("designUpgradeStorage", () => {
	beforeEach(async () => {
		await clearPendingDesignUpgrade(identity)
	})

	it("persists and clears a pending upgrade by project identity", async () => {
		const upgrade = {
			reason: "sidecar-retry" as const,
			fileId: "file-1",
			sourceVersion: "3.0.0",
			targetVersion: "3.0.0",
			createdAt: Date.now(),
		}

		expect(await writePendingDesignUpgrade(identity, upgrade)).toBe(true)
		expect(await readPendingDesignUpgrade(identity)).toEqual(upgrade)
		await clearPendingDesignUpgrade(identity)
		expect(await readPendingDesignUpgrade(identity)).toBeNull()
	})

	it("does not persist an upgrade without a complete identity", async () => {
		expect(
			await writePendingDesignUpgrade(
				{ projectId: "project-1" },
				{
					reason: "legacy-dsl",
					fileId: "file-1",
					sourceVersion: "2.0.0",
					targetVersion: "3.0.0",
					createdAt: Date.now(),
				},
			),
		).toBe(false)
	})
})
