import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MagicAgentApi } from "../MagicAgentApi"
import { callMagic, createMagicApiHarness, getMagicMember } from "./magic-api-test-helpers"

describe("MagicAgentApi contracts", () => {
	let host: ReturnType<typeof createMagicApiHarness>

	beforeEach(() => {
		host = createMagicApiHarness()
		vi.useFakeTimers()
		new MagicAgentApi().install()
	})
	afterEach(() => host.cleanup())

	it.each([
		["agent.getAgents", "getAgents"],
		["project.createTopicAndSend", "createTopicAndSend"],
		["project.sendMessage", "sendMessage"],
	])(
		"installs %s with the same legacy %s function and preserves existing methods",
		(path, alias) => {
			const installed = getMagicMember(path)
			expect(installed).toBeTypeOf("function")
			expect(installed).toBe(getMagicMember(alias))
			new MagicAgentApi().install()
			expect(getMagicMember(path)).toBe(installed)
			expect(getMagicMember(alias)).toBe(installed)
		},
	)

	it("preserves independently provided namespace and legacy functions", () => {
		const getAgents = vi.fn()
		const legacyGetAgents = vi.fn()
		const sendMessage = vi.fn()
		window.Magic = {
			agent: { getAgents },
			getAgents: legacyGetAgents,
			project: { sendMessage },
		}
		new MagicAgentApi().install()
		expect(window.Magic.agent?.getAgents).toBe(getAgents)
		expect(window.Magic.getAgents).toBe(legacyGetAgents)
		expect(window.Magic.project?.sendMessage).toBe(sendMessage)
		expect(window.Magic.project?.createTopicAndSend).toBeTypeOf("function")
	})

	it.each(["agent.getAgents", "getAgents"])("%s returns the agent list", async (path) => {
		const agents = [{ id: "writer", name: "Writer", icon: "", color: "blue", type: "official" }]
		const pending = callMagic(path)
		expect(host.latestRequest()).toEqual({
			type: "MAGIC_GET_AGENTS_REQUEST",
			requestId: expect.any(String),
		})
		host.respond({ agents })
		await expect(pending).resolves.toEqual(agents)
	})

	it("defaults a missing agent list to an empty array", async () => {
		const pending = callMagic("agent.getAgents")
		host.respond()
		await expect(pending).resolves.toEqual([])
	})

	const richMessage = {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
	}
	it.each(["project.createTopicAndSend", "createTopicAndSend"])(
		"%s forwards text and options and extracts topic ID",
		async (path) => {
			const pending = callMagic(path, "  Hello  ", { agentId: "writer", model: "model-1" })
			expect(host.latestRequest()).toMatchObject({
				type: "MAGIC_CREATE_TOPIC_AND_SEND_REQUEST",
				message: "  Hello  ",
				agentId: "writer",
				model: "model-1",
			})
			host.respond({ topicId: "topic-1", ignored: true })
			await expect(pending).resolves.toEqual({ topicId: "topic-1" })
		},
	)

	it.each(["project.sendMessage", "sendMessage"])(
		"%s forwards rich text and resolves void",
		async (path) => {
			const pending = callMagic(path, richMessage, { model: "model-1" })
			expect(host.latestRequest()).toMatchObject({
				type: "MAGIC_SEND_MESSAGE_REQUEST",
				message: richMessage,
				model: "model-1",
			})
			host.respond({ content: "not a return value" })
			await expect(pending).resolves.toBeUndefined()
		},
	)

	it("accepts rich text when creating a topic and defaults a missing topic ID", async () => {
		const pending = callMagic("project.createTopicAndSend", richMessage)
		expect(host.latestRequest().message).toEqual(richMessage)
		host.respond()
		await expect(pending).resolves.toEqual({ topicId: "" })
	})

	describe.each(["project.createTopicAndSend", "project.sendMessage"])(
		"%s validation",
		(path) => {
			it.each(["", " \n\t", null, undefined, 1, true, {}, [], { content: [] }, { type: "" }])(
				"rejects invalid message %j before allocating a host request",
				async (message) => {
					await expect(callMagic(path, message)).rejects.toThrow("message must be")
					expect(host.postMessage).not.toHaveBeenCalled()
					expect(host.pendingListeners()).toHaveLength(0)
					expect(vi.getTimerCount()).toBe(0)
				},
			)
		},
	)
})
