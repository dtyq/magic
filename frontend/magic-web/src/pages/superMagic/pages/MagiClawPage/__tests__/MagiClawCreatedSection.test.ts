import { describe, expect, it } from "vitest"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { getMagiClawMenuActionSequence } from "../magiClawMenuActions"

describe("getMagiClawMenuActionSequence", () => {
	it("returns the running menu from Figma for running claws", () => {
		expect(getMagiClawMenuActionSequence(MAGIC_CLAW_STATUS.RUNNING)).toEqual([
			"restart",
			"stop",
			"divider",
			"delete",
		])
	})

	it("returns the pending menu from Figma for pending claws", () => {
		expect(getMagiClawMenuActionSequence(MAGIC_CLAW_STATUS.PENDING)).toEqual(["delete"])
	})

	it("falls back to the stopped menu for exited and unknown statuses", () => {
		expect(getMagiClawMenuActionSequence(MAGIC_CLAW_STATUS.EXITED)).toEqual([
			"start",
			"divider",
			"delete",
		])
		expect(getMagiClawMenuActionSequence("Unsupported")).toEqual(["start", "divider", "delete"])
	})
})
