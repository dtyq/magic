import { afterEach, describe, expect, it, vi } from "vitest"
import type { Container } from "@/services/ServiceContainer"
import { authSessionCoordinator } from "../AuthSessionCoordinator"

describe("AuthSessionCoordinator", () => {
	afterEach(() => {
		window.history.pushState({}, "", "/")
	})

	it("skips session cleanup on share routes", async () => {
		window.history.pushState({}, "", "/share/files/943535117533392896")
		const service = { get: vi.fn() } as unknown as Container

		await authSessionCoordinator.invalidate({
			service,
			reason: "token-expired",
			source: "http",
		})

		expect(service.get).not.toHaveBeenCalled()
	})
})
