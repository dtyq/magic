import { describe, expect, it } from "vitest"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { getMagicClawStatusBadgeConfig } from "../MagiClawStatusBadge"
import { MAGI_CLAW_DISPLAY_STATUS } from "../magiClawDisplayStatus"

describe("getMagicClawStatusBadgeConfig", () => {
	it("should map known statuses to the expected badge config", () => {
		expect(getMagicClawStatusBadgeConfig(MAGIC_CLAW_STATUS.PENDING)).toEqual({
			dotClassName: "bg-orange-500",
			labelKey: "superLobster.created.status.starting",
		})

		expect(getMagicClawStatusBadgeConfig(MAGIC_CLAW_STATUS.RUNNING)).toEqual({
			dotClassName: "bg-green-500",
			labelKey: "superLobster.created.status.running",
		})

		expect(getMagicClawStatusBadgeConfig(MAGI_CLAW_DISPLAY_STATUS.RESTARTING)).toEqual({
			dotClassName: "bg-orange-500",
			labelKey: "superLobster.created.status.restarting",
		})

		expect(getMagicClawStatusBadgeConfig(MAGIC_CLAW_STATUS.EXITED)).toEqual({
			dotClassName: "bg-slate-400",
			labelKey: "superLobster.created.status.stopped",
		})
	})

	it("should fall back to unknown when status is unsupported", () => {
		expect(getMagicClawStatusBadgeConfig("Unsupported")).toEqual({
			dotClassName: "bg-slate-400",
			labelKey: "superLobster.created.status.unknown",
		})
	})
})
