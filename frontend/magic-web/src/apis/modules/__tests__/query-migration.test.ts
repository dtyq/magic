import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ServiceHttpClient, type RequestConfig } from "@/infrastructure/network/http/clients"
import { generateAuthApi } from "../auth"
import { generateBotApi } from "../bot"
import { generateChatApi } from "../chat/chat"
import { generateContactApi } from "../contact"
import { generateKnowledgeApi } from "../knowledge/knowledge"
import { generateCollaborationApi } from "../superMagic/collaboration"

describe("API query migration transport contracts", () => {
	let client: ServiceHttpClient
	let prepared: RequestConfig<Headers>

	beforeEach(() => {
		client = new ServiceHttpClient({
			baseURL: "https://api.test",
			getBaseURL: () => "https://api.test",
		})
		client.addRequestInterceptor((request) => {
			prepared = request
			return request
		})
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(
				async () =>
					new Response(JSON.stringify({ data: {} }), {
						headers: { "Content-Type": "application/json" },
					}),
			),
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("substitutes mapped path params and encodes queries through the client", async () => {
		await generateContactApi(client).getOrganization({
			department_id: "department-1",
			sum_type: 1,
			page_token: "next+page&中文",
		})
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/api/v1/contact/departments/department-1/children?sum_type=1&page_token=next%2Bpage%26%E4%B8%AD%E6%96%87",
			expect.anything(),
		)
		expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty("params")
	})

	it("preserves the legacy missing department id while using the new query path", async () => {
		await generateContactApi(client).searchOrganizations({ name: "a&b" })
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/api/v1/contact/departments/undefined?name=a%26b",
			expect.anything(),
		)
	})

	it("preserves the legacy missing knowledge code instead of substituting id", async () => {
		await generateKnowledgeApi(client).rebuildKnowledge("knowledge-1")
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/api/v1/knowledge-bases/undefined",
			expect.objectContaining({ method: "POST", body: undefined }),
		)
	})

	it("keeps status in PUT query rather than accidentally moving it into the body", async () => {
		await generateBotApi(client).updateBotStatus("agent-1", 0)
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/api/v1/agents/agent-1/status?status=0",
			expect.objectContaining({ method: "PUT", body: undefined }),
		)
	})

	it("keeps the authorization header callback and request flags", async () => {
		await generateAuthApi(client).bindMagicAuthorization("test-token", "", "org-1", {
			skipAppInitWait: true,
		})
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/api/v1/auth/status?login_code=",
			expect.objectContaining({ priority: "high" }),
		)
		expect(prepared.skipAppInitWait).toBe(true)
		const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Headers
		expect(headers.get("authorization")).toBe("test-token")
		expect(headers.get("Organization-Code")).toBe("org-1")
	})

	it("keeps legacy unused ASR params absent and autocomplete data in the body", async () => {
		const api = generateChatApi(client, {} as Parameters<typeof generateChatApi>[1])
		await api.getVoiceInputToken({ duration: 600, refresh: true })
		const data = { conversation_id: "conversation-1", topic_id: "topic-1", message: "a&b" }
		await api.getAiAutoCompletion(data)
		expect(fetch).toHaveBeenNthCalledWith(
			1,
			"https://api.test/api/v1/asr/tokens",
			expect.anything(),
		)
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"https://api.test/api/v1/im/typing/completions",
			expect.objectContaining({ method: "POST", body: JSON.stringify(data) }),
		)
	})

	it("preserves options and applies array/nullish rules to collaboration queries", async () => {
		const signal = new AbortController().signal
		await generateCollaborationApi(client).getCollaborationProjects(
			{ page: 0, name: "", creator_user_ids: ["user+1", "user&2"] },
			{
				signal,
				enableAuthorization: false,
				params: { extra: false, missing: null, omitted: undefined },
			},
		)
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/api/v1/super-agent/collaboration-projects?page=0&name=&creator_user_ids%5B%5D=user%2B1&creator_user_ids%5B%5D=user%262&extra=false",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		)
		expect(prepared.enableAuthorization).toBe(false)
		expect(prepared.signal?.aborted).toBe(false)
	})
})
