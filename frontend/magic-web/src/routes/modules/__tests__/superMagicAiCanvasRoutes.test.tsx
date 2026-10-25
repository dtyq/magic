import { describe, expect, it, vi } from "vitest"
import { getRoutePath, routesMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"

vi.mock("@/routes/modules/admin/routes", () => ({ default: [] }))
vi.mock("@dtyq/magic-admin-v2", () => ({ createRouteObjects: () => [], RuntimeMode: {} }))
vi.mock("antd", async (importOriginal) => {
	const actual = await importOriginal<typeof import("antd")>()
	const fallbackDatePicker = Object.assign(() => null, {
		RangePicker: () => null,
		MonthPicker: () => null,
		YearPicker: () => null,
		WeekPicker: () => null,
	})
	return { ...actual, DatePicker: actual.DatePicker ?? fallbackDatePicker }
})

describe("AI canvas routes", () => {
	it.each([
		["/global/super/ai-canvas", RouteName.AiCanvas],
		["/global/super/ai-canvas/project-1", RouteName.AiCanvasProjectState],
		["/global/super/project-1", RouteName.SuperWorkspaceProjectState],
		["/global/super/project-1/topic-1", RouteName.SuperWorkspaceProjectTopicState],
	])(
		"matches %s without confusing the canvas home, canvas projects and projects",
		(pathname, name) => {
			expect(routesMatch(pathname)?.route.name).toBe(name)
		},
	)

	it("builds the canvas project address without a topic", () => {
		expect(
			getRoutePath({
				name: RouteName.AiCanvasProjectState,
				params: { clusterCode: "global", projectId: "project-1" },
			}),
		).toBe("/global/super/ai-canvas/project-1")
	})
})
