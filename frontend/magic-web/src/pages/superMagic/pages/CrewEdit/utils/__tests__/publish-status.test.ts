import { describe, expect, it } from "vitest"
import { hasCrewUnpublishedChanges } from "../publish-status"

describe("hasCrewUnpublishedChanges", () => {
	it("returns true when the crew was never published", () => {
		expect(
			hasCrewUnpublishedChanges({
				latestPublishedAt: null,
				updatedAt: "2026-03-21T10:00:00.000Z",
			}),
		).toBe(true)
	})

	it("returns false when update time matches publish time", () => {
		expect(
			hasCrewUnpublishedChanges({
				latestPublishedAt: "2026-03-21T10:00:00.000Z",
				updatedAt: "2026-03-21T10:00:00.000Z",
			}),
		).toBe(false)
	})

	it("returns true when update time is newer than publish time", () => {
		expect(
			hasCrewUnpublishedChanges({
				latestPublishedAt: "2026-03-21T10:00:00.000Z",
				updatedAt: "2026-03-21T10:00:01.000Z",
			}),
		).toBe(true)
	})
})
