import { describe, expect, it, vi } from "vitest"

import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	resolveMicroAppModelSelectionMode,
	resolveMicroAppRuntimeModelSelectionMode,
} from "../microAppModelMode"

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		resolveModelSelectionMode: vi.fn((preferredMode: TopicMode, fallbackMode: TopicMode) =>
			preferredMode === TopicMode.CustomAgent ? fallbackMode : preferredMode,
		),
	},
}))

describe("resolveMicroAppModelSelectionMode", () => {
	it("always uses the default model catalog", () => {
		expect(resolveMicroAppModelSelectionMode()).toBe(TopicMode.Default)
	})
})

describe("resolveMicroAppRuntimeModelSelectionMode", () => {
	it("falls back to default when the employee catalog is empty", () => {
		expect(resolveMicroAppRuntimeModelSelectionMode(TopicMode.CustomAgent, "SMA123")).toBe(
			TopicMode.Default,
		)
	})

	it("keeps a mode that already has models", () => {
		expect(resolveMicroAppRuntimeModelSelectionMode(TopicMode.General, undefined)).toBe(
			TopicMode.General,
		)
	})
})
