import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateSuperMagicApi } from "../superMagic"

type MicroAppHttpClientMock = Pick<ServiceHttpClient, "get" | "post" | "put" | "delete">

describe("SuperMagic micro app API", () => {
	it("reads and creates a runtime project with string-safe parsing", async () => {
		const client: MicroAppHttpClientMock = {
			get: vi.fn().mockResolvedValue({}),
			post: vi.fn().mockResolvedValue({}),
			put: vi.fn(),
			delete: vi.fn(),
		}
		const api = generateSuperMagicApi(client as ServiceHttpClient)
		await api.getMicroAppRuntimeProject("app-1", { enableErrorMessagePrompt: false })
		await api.ensureMicroAppRuntimeProject("app-1")
		expect(client.get).toHaveBeenCalledWith(
			"/api/v1/super-agent/micro-app-projects/app-1/runtime-project",
			{ parseJsonLargeIntAsString: true, enableErrorMessagePrompt: false },
		)
		expect(client.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/micro-app-projects/app-1/runtime-project",
			undefined,
			{ parseJsonLargeIntAsString: true },
		)
	})

	it("uses the workspace and list query endpoints", async () => {
		const client: MicroAppHttpClientMock = {
			get: vi.fn().mockResolvedValue({}),
			post: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
		}
		const api = generateSuperMagicApi(client as ServiceHttpClient)

		await api.getMicroAppWorkspace()
		await api.getMicroApps({
			page: 2,
			page_size: 50,
			keyword: "客户跟进",
			scope: "collaborated",
		})
		await api.getMicroApps({
			page: 1,
			page_size: 20,
			scope: "accessible",
		})
		await api.getMentionMicroApps({
			page: 1,
			page_size: 100,
			keyword: "客户",
		})

		expect(client.get).toHaveBeenNthCalledWith(
			1,
			"/api/v1/super-agent/workspaces/app/micro-app",
		)
		expect(client.get).toHaveBeenNthCalledWith(2, "/api/v1/super-agent/micro-apps/queries", {
			params: { page: 2, page_size: 50, keyword: "客户跟进", scope: "collaborated" },
			parseJsonLargeIntAsString: true,
		})
		expect(client.get).toHaveBeenNthCalledWith(3, "/api/v1/super-agent/micro-apps/queries", {
			params: { page: 1, page_size: 20, keyword: "", scope: "accessible" },
			parseJsonLargeIntAsString: true,
		})
		expect(client.get).toHaveBeenNthCalledWith(4, "/api/v1/super-agent/micro-apps/mention", {
			params: { page: 1, page_size: 100, keyword: "客户" },
			parseJsonLargeIntAsString: true,
		})
	})

	it("records an authenticated micro app visit", async () => {
		const client: MicroAppHttpClientMock = {
			get: vi.fn(),
			post: vi.fn().mockResolvedValue({ recorded: true }),
			put: vi.fn(),
			delete: vi.fn(),
		}
		const api = generateSuperMagicApi(client as ServiceHttpClient)

		await api.recordMicroAppVisit("app-1")

		expect(client.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/micro-apps/app-1/visit",
			undefined,
		)
	})

	it("creates, edits, deletes, and publishes with app fields and string-safe parsing", async () => {
		const client: MicroAppHttpClientMock = {
			get: vi.fn(),
			post: vi.fn().mockResolvedValue({ app_id: "100000000000009001" }),
			put: vi.fn().mockResolvedValue({ app_id: "100000000000009001" }),
			delete: vi.fn(),
		}
		const api = generateSuperMagicApi(client as ServiceHttpClient)

		await api.createMicroAppProject({
			workspace_id: "workspace-1",
			dynamic_params: { agent_mode: "micro-app", message_version: "v2" },
		})
		await api.updateMicroApp("100000000000009001", {
			app_name: "客户跟进助手",
			cover_file_key: null,
		})
		await api.deleteMicroApp("100000000000009001")
		await api.publishMicroAppProject("100000000000009001", {
			app_name: "客户跟进助手",
			share_type: 4,
			cover_file_key: "micro-app/covers/customer.png",
			extra: { pure_mode: true },
		})

		expect(client.post).toHaveBeenNthCalledWith(
			1,
			"/api/v1/super-agent/micro-app-projects",
			{
				workspace_id: "workspace-1",
				project_name: "",
				dynamic_params: { agent_mode: "micro-app", message_version: "v2" },
			},
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.put).toHaveBeenCalledWith(
			"/api/v1/super-agent/micro-apps/100000000000009001",
			{ app_name: "客户跟进助手", cover_file_key: null },
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.delete).toHaveBeenCalledWith(
			"/api/v1/super-agent/micro-apps/100000000000009001",
			undefined,
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.post).toHaveBeenNthCalledWith(
			2,
			"/api/v1/super-agent/micro-app-projects/100000000000009001/publish",
			{
				app_name: "客户跟进助手",
				share_type: 4,
				cover_file_key: "micro-app/covers/customer.png",
				extra: { pure_mode: true },
			},
			{ parseJsonLargeIntAsString: true },
		)
	})
})
