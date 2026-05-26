import { describe, expect, it } from "vitest"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { MAGI_CLAW_DISPLAY_STATUS } from "../magiClawDisplayStatus"
import { resolveMagiClawActionAvailability } from "../resolveMagiClawActionAvailability"

describe("resolveMagiClawActionAvailability", () => {
	it("exposes restart and stop only while running", () => {
		const availability = resolveMagiClawActionAvailability({
			displayStatus: MAGIC_CLAW_STATUS.RUNNING,
		})

		expect(availability.restart).toEqual({ visible: true, disabled: false })
		expect(availability.stop).toEqual({ visible: true, disabled: false })
		expect(availability.start).toEqual({ visible: false, disabled: true })
		expect(availability.edit).toEqual({ visible: true, disabled: false })
		expect(availability.delete).toEqual({ visible: true, disabled: false })
	})

	it("blocks lifecycle and edit actions while pending", () => {
		const availability = resolveMagiClawActionAvailability({
			displayStatus: MAGIC_CLAW_STATUS.PENDING,
		})

		expect(availability.restart.visible).toBe(false)
		expect(availability.stop.visible).toBe(false)
		expect(availability.start.visible).toBe(false)
		expect(availability.edit).toEqual({ visible: true, disabled: true })
		expect(availability.delete).toEqual({ visible: true, disabled: false })
	})

	it("treats restarting like pending for lifecycle actions", () => {
		const availability = resolveMagiClawActionAvailability({
			displayStatus: MAGI_CLAW_DISPLAY_STATUS.RESTARTING,
		})

		expect(availability.restart.visible).toBe(false)
		expect(availability.stop.visible).toBe(false)
		expect(availability.start.visible).toBe(false)
		expect(availability.edit.disabled).toBe(true)
	})

	it("exposes start only while stopped", () => {
		const availability = resolveMagiClawActionAvailability({
			displayStatus: MAGIC_CLAW_STATUS.EXITED,
		})

		expect(availability.start).toEqual({ visible: true, disabled: false })
		expect(availability.restart.visible).toBe(false)
		expect(availability.stop.visible).toBe(false)
	})

	it("disables lifecycle and delete actions while a request is in flight", () => {
		const availability = resolveMagiClawActionAvailability({
			displayStatus: MAGIC_CLAW_STATUS.RUNNING,
			isActionLoading: true,
		})

		expect(availability.restart.disabled).toBe(true)
		expect(availability.stop.disabled).toBe(true)
		expect(availability.delete.disabled).toBe(true)
		expect(availability.edit.disabled).toBe(true)
	})
})
