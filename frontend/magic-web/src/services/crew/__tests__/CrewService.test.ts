import { beforeEach, describe, expect, it, vi } from "vitest"
import { CrewApi } from "@/apis"
import { CrewService } from "../CrewService"

const trackMock = vi.hoisted(() => vi.fn())

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: trackMock },
}))

vi.mock("@/apis", () => ({
	CrewApi: {
		checkAgentAccess: vi.fn(),
		hireStoreAgent: vi.fn(),
		createAgent: vi.fn(),
	},
}))

describe("CrewService.checkAgentAccess", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("maps an access-check response", async () => {
		vi.mocked(CrewApi.checkAgentAccess).mockResolvedValue({
			code: "SMA-access-mock",
			exists: true,
			can_use: false,
		})
		const service = new CrewService()

		await expect(service.checkAgentAccess("SMA-request-mock")).resolves.toEqual({
			code: "SMA-access-mock",
			exists: true,
			canUse: false,
		})
	})
})

describe("CrewService.resolveAgentAccess", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns ready without hiring an already usable agent", async () => {
		vi.mocked(CrewApi.checkAgentAccess).mockResolvedValue({
			code: "SMA-ready-mock",
			exists: true,
			can_use: true,
		})
		const service = new CrewService()

		await expect(
			service.resolveAgentAccess("SMA-request-mock", { autoHire: true }),
		).resolves.toEqual({
			status: "ready",
			code: "SMA-ready-mock",
			hired: false,
		})
		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
	})

	it("hires an available agent that the current user has not hired", async () => {
		vi.mocked(CrewApi.checkAgentAccess).mockResolvedValue({
			code: "SMA-hire-mock",
			exists: true,
			can_use: false,
		})
		vi.mocked(CrewApi.hireStoreAgent).mockResolvedValue([])
		const service = new CrewService()

		await expect(
			service.resolveAgentAccess("SMA-hire-mock", { autoHire: true }),
		).resolves.toEqual({
			status: "ready",
			code: "SMA-hire-mock",
			hired: true,
		})
		expect(CrewApi.hireStoreAgent).toHaveBeenCalledWith({ code: "SMA-hire-mock" })
	})

	it("deduplicates concurrent hire requests", async () => {
		vi.mocked(CrewApi.checkAgentAccess).mockResolvedValue({
			code: "SMA-concurrent-mock",
			exists: true,
			can_use: false,
		})
		vi.mocked(CrewApi.hireStoreAgent).mockResolvedValue([])
		const service = new CrewService()

		await Promise.all([
			service.resolveAgentAccess("SMA-concurrent-mock", { autoHire: true }),
			service.resolveAgentAccess("SMA-concurrent-mock", { autoHire: true }),
		])

		expect(CrewApi.hireStoreAgent).toHaveBeenCalledTimes(1)
	})

	it("keeps invalid and non-auto-hire states side effect free", async () => {
		vi.mocked(CrewApi.checkAgentAccess)
			.mockResolvedValueOnce({ code: "SMA-missing-mock", exists: false, can_use: false })
			.mockResolvedValueOnce({ code: "SMA-unavailable-mock", exists: true, can_use: false })
		const service = new CrewService()

		await expect(
			service.resolveAgentAccess("SMA-missing-mock", { autoHire: true }),
		).resolves.toEqual({
			status: "invalid",
			code: "SMA-missing-mock",
			hired: false,
		})
		await expect(service.resolveAgentAccess("SMA-unavailable-mock")).resolves.toEqual({
			status: "unavailable",
			code: "SMA-unavailable-mock",
			hired: false,
		})
		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
	})
})

describe("CrewService creation-attempt analytics", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("reports the agent and backing project/topic attempts before creation", async () => {
		vi.mocked(CrewApi.createAgent).mockResolvedValue({
			id: "agent-9",
			code: "SMA-9",
		})
		const service = new CrewService()

		await service.createAgent({ name_i18n: { zh_CN: "", en_US: "" } } as never)

		expect(trackMock).toHaveBeenNthCalledWith(1, "agent_create_attempted")
		expect(trackMock).toHaveBeenNthCalledWith(2, "project_create_attempted", {
			sceneOverride: "crew",
		})
	})

	it("createDefaultAgent uses the same attempt path", async () => {
		vi.mocked(CrewApi.createAgent).mockResolvedValue({
			id: "agent-default",
			code: "SMA-default",
		})
		const service = new CrewService()

		await service.createDefaultAgent()

		expect(trackMock).toHaveBeenCalledWith("agent_create_attempted")
	})

	it("keeps the attempt when createAgent fails", async () => {
		vi.mocked(CrewApi.createAgent).mockRejectedValue(new Error("create-failed"))
		const service = new CrewService()

		await expect(
			service.createAgent({ name_i18n: { zh_CN: "", en_US: "" } } as never),
		).rejects.toThrow("create-failed")
		expect(trackMock).toHaveBeenCalledWith("agent_create_attempted")
	})
})
