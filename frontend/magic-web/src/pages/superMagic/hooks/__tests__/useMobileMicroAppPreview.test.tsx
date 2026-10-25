import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMobileMicroAppPreview } from "../useMobileMicroAppPreview"

vi.mock("@/utils/pubsub", () => {
	const handlers = new Map<string, Set<(payload: unknown) => void>>()

	return {
		default: {
			subscribe: vi.fn((eventName: string, handler: (payload: unknown) => void) => {
				const nextHandlers = handlers.get(eventName) || new Set()
				nextHandlers.add(handler)
				handlers.set(eventName, nextHandlers)
			}),
			unsubscribe: vi.fn((eventName: string, handler?: (payload: unknown) => void) => {
				if (!handler) {
					handlers.delete(eventName)
					return
				}
				handlers.get(eventName)?.delete(handler)
			}),
			publish: vi.fn((eventName: string, payload: unknown) => {
				handlers.get(eventName)?.forEach((handler) => handler(payload))
			}),
		},
		PubSubEvents: {
			Open_Micro_App_Tab: "open_micro_app_tab",
		},
	}
})

describe("useMobileMicroAppPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("opens mobile micro-app preview from the shared tab event", () => {
		const { result } = renderHook(() => useMobileMicroAppPreview())

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-1",
				appName: "深圳卓悦线上内购",
			})
		})

		expect(result.current.visible).toBe(true)
		expect(result.current.previewData).toEqual({
			appId: "app-1",
			appName: "深圳卓悦线上内购",
		})
	})

	it("ignores invalid micro-app preview events", () => {
		const { result } = renderHook(() => useMobileMicroAppPreview())

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "  ",
				appName: "missing id",
			})
		})

		expect(result.current.visible).toBe(false)
		expect(result.current.previewData).toBeNull()
	})
})
