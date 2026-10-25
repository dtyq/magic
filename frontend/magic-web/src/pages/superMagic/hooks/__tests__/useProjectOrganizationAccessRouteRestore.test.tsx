import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useProjectOrganizationAccessRouteRestore } from "../useProjectOrganizationAccessRouteRestore"
import type { ProjectOrganizationAccessStatus } from "../../contexts/ProjectOrganizationAccessContext"

const mocks = vi.hoisted(() => ({
	historyListener: null as
		| null
		| ((update: { action: string; location: { pathname: string } }) => void),
}))

vi.mock("@/routes/history", () => ({
	baseHistory: {
		location: { pathname: "/global/super/project-a/topic-a" },
		listen: vi.fn(
			(listener: (update: { action: string; location: { pathname: string } }) => void) => {
				mocks.historyListener = listener
				return vi.fn()
			},
		),
	},
}))

describe("useProjectOrganizationAccessRouteRestore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.historyListener = null
	})

	it("waits for access before initial restore and ignores later PUSH checks", () => {
		const restoreStateFromPathname = vi.fn()
		const { rerender } = renderHook(
			({ status }: { status: ProjectOrganizationAccessStatus }) =>
				useProjectOrganizationAccessRouteRestore({ status, restoreStateFromPathname }),
			{ initialProps: { status: "loading" as ProjectOrganizationAccessStatus } },
		)

		expect(restoreStateFromPathname).not.toHaveBeenCalled()
		rerender({ status: "ready" })
		expect(restoreStateFromPathname).toHaveBeenCalledWith("/global/super/project-a/topic-a")

		restoreStateFromPathname.mockClear()
		rerender({ status: "loading" })
		rerender({ status: "ready" })
		expect(restoreStateFromPathname).not.toHaveBeenCalled()
	})

	it("defers POP restoration until the destination project check is ready", () => {
		const restoreStateFromPathname = vi.fn()
		const { rerender } = renderHook(
			({ status }: { status: ProjectOrganizationAccessStatus }) =>
				useProjectOrganizationAccessRouteRestore({ status, restoreStateFromPathname }),
			{ initialProps: { status: "loading" as ProjectOrganizationAccessStatus } },
		)

		act(() => {
			mocks.historyListener?.({
				action: "POP",
				location: { pathname: "/global/super/project-b/topic-b" },
			})
		})
		expect(restoreStateFromPathname).not.toHaveBeenCalled()

		rerender({ status: "ready" })
		expect(restoreStateFromPathname).toHaveBeenCalledWith("/global/super/project-b/topic-b")
	})
})
