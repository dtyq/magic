import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

const { modeServiceMock, isModeValidMock, isModeVisibleMock } = vi.hoisted(() => {
	const isModeValid = vi.fn()
	const isModeVisible = vi.fn()
	return {
		modeServiceMock: {
			defaultAgentCode: undefined as string | undefined,
			isModeValid,
			isModeVisible,
		},
		isModeValidMock: isModeValid,
		isModeVisibleMock: isModeVisible,
	}
})

vi.mock("../SuperMagicModeService", () => ({
	default: modeServiceMock,
}))

import {
	isAgentSelectionAvailable,
	resolveAgentSelection,
	resolveDefaultAgentSelection,
} from "../DefaultAgentSelectionService"

describe("DefaultAgentSelectionService", () => {
	beforeEach(() => {
		modeServiceMock.defaultAgentCode = undefined
		isModeValidMock.mockReset()
		isModeValidMock.mockReturnValue(false)
		isModeVisibleMock.mockReset()
		isModeVisibleMock.mockReturnValue(true)
	})

	it("resolves an available configured non-SMA employee as plain topic_mode", () => {
		modeServiceMock.defaultAgentCode = "agent-default"
		isModeValidMock.mockImplementation((mode) => mode === "agent-default")

		expect(resolveDefaultAgentSelection()).toEqual({
			modeIdentifier: "agent-default",
			topicPattern: "agent-default",
		})
	})

	it("uses general directly when featured config selects the built-in general mode", () => {
		modeServiceMock.defaultAgentCode = TopicMode.General

		expect(resolveDefaultAgentSelection()).toEqual({
			modeIdentifier: TopicMode.General,
			topicPattern: TopicMode.General,
		})
		expect(isModeValidMock).not.toHaveBeenCalled()
	})

	it("uses an available built-in mode without agent_code", () => {
		modeServiceMock.defaultAgentCode = TopicMode.PPT
		isModeValidMock.mockImplementation((mode) => mode === TopicMode.PPT)

		expect(resolveDefaultAgentSelection()).toEqual({
			modeIdentifier: TopicMode.PPT,
			topicPattern: TopicMode.PPT,
		})
	})

	it.each([undefined, null, "", "   "])(
		"falls back to general when default_agent_code is %s",
		(defaultAgentCode) => {
			modeServiceMock.defaultAgentCode = defaultAgentCode ?? undefined

			expect(resolveDefaultAgentSelection()).toEqual({
				modeIdentifier: TopicMode.General,
				topicPattern: TopicMode.General,
			})
		},
	)

	it("falls back to general when the configured employee is unavailable", () => {
		modeServiceMock.defaultAgentCode = "agent-disabled"

		expect(resolveDefaultAgentSelection()).toEqual({
			modeIdentifier: TopicMode.General,
			topicPattern: TopicMode.General,
		})
	})

	it("keeps a hidden configured employee when it is still in the mode list", () => {
		modeServiceMock.defaultAgentCode = "SMA-agent-hidden"
		isModeValidMock.mockImplementation((mode) => mode === "SMA-agent-hidden")
		isModeVisibleMock.mockReturnValue(false)

		expect(resolveDefaultAgentSelection()).toEqual({
			modeIdentifier: "SMA-agent-hidden",
			topicPattern: TopicMode.CustomAgent,
			agentCode: "SMA-agent-hidden",
		})
		expect(isModeVisibleMock).not.toHaveBeenCalled()
	})

	it("keeps an explicit topic custom_agent even when it is no longer in the list", () => {
		expect(resolveAgentSelection(TopicMode.CustomAgent, "historical-agent")).toEqual({
			modeIdentifier: "historical-agent",
			topicPattern: TopicMode.CustomAgent,
			agentCode: "historical-agent",
		})
	})

	it("keeps the employee code in crew creator mode", () => {
		expect(resolveAgentSelection(TopicMode.CrewCreator, "crew-123")).toEqual({
			modeIdentifier: TopicMode.CrewCreator,
			topicPattern: TopicMode.CrewCreator,
			agentCode: "crew-123",
		})
	})

	it("ignores a blank employee code in crew creator mode", () => {
		expect(resolveAgentSelection(TopicMode.CrewCreator, "  ")).toEqual({
			modeIdentifier: TopicMode.CrewCreator,
			topicPattern: TopicMode.CrewCreator,
		})
	})

	it("keeps an explicit non-SMA agent when the UI uses its identifier", () => {
		expect(resolveAgentSelection("historical-agent", "historical-agent")).toEqual({
			modeIdentifier: "historical-agent",
			topicPattern: TopicMode.CustomAgent,
			agentCode: "historical-agent",
		})
	})

	it("maps a non-SMA configured default as plain topic_mode", () => {
		modeServiceMock.defaultAgentCode = "agent-default"
		isModeValidMock.mockImplementation((mode) => mode === "agent-default")

		expect(resolveAgentSelection("agent-default")).toEqual({
			modeIdentifier: "agent-default",
			topicPattern: "agent-default",
		})
	})

	it("keeps the existing SMA employee recognition rule", () => {
		expect(resolveAgentSelection("SMA-user-selected")).toEqual({
			modeIdentifier: "SMA-user-selected",
			topicPattern: TopicMode.CustomAgent,
			agentCode: "SMA-user-selected",
		})
	})

	it("uses configured default when mode identifier is empty", () => {
		modeServiceMock.defaultAgentCode = TopicMode.PPT
		isModeValidMock.mockImplementation((mode) => mode === TopicMode.PPT)

		expect(resolveAgentSelection()).toEqual({
			modeIdentifier: TopicMode.PPT,
			topicPattern: TopicMode.PPT,
		})
	})

	it("uses configured default when mode is custom_agent without agent_code", () => {
		modeServiceMock.defaultAgentCode = "SMA-agent-default"
		isModeValidMock.mockImplementation((mode) => mode === "SMA-agent-default")

		expect(resolveAgentSelection(TopicMode.CustomAgent)).toEqual({
			modeIdentifier: "SMA-agent-default",
			topicPattern: TopicMode.CustomAgent,
			agentCode: "SMA-agent-default",
		})
	})

	it("clears agent_code when switching to a built-in mode", () => {
		expect(resolveAgentSelection(TopicMode.Chat, "stale-agent")).toEqual({
			modeIdentifier: TopicMode.Chat,
			topicPattern: TopicMode.Chat,
		})
	})

	it("returns true when general mode is selected", () => {
		expect(isAgentSelectionAvailable(TopicMode.General)).toBe(true)
	})

	it("returns false when a saved custom agent is no longer available", () => {
		isModeValidMock.mockImplementation((mode, agentCode) => {
			return mode === TopicMode.CustomAgent && agentCode === "historical-agent"
		})

		expect(isAgentSelectionAvailable(TopicMode.CustomAgent, "deleted-agent")).toBe(false)
	})

	it("returns true when a saved custom agent is still available", () => {
		isModeValidMock.mockImplementation((mode, agentCode) => {
			return mode === TopicMode.CustomAgent && agentCode === "historical-agent"
		})
		isModeVisibleMock.mockReturnValue(true)

		expect(isAgentSelectionAvailable(TopicMode.CustomAgent, "historical-agent")).toBe(true)
	})

	it("returns true when a saved custom agent is hidden for the current user", () => {
		isModeValidMock.mockReturnValue(true)
		isModeVisibleMock.mockReturnValue(false)

		expect(isAgentSelectionAvailable(TopicMode.CustomAgent, "hidden-agent")).toBe(true)
	})
})
