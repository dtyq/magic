import type { ReactNode } from "react"
import { renderHook } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { useChatSidebarSelection } from "../useChatSidebarSelection"

describe("chat sidebar route selection", () => {
	it.each([
		["/global/super/new-chat", true, true, undefined],
		["/global/super/new-chat/", true, true, undefined],
		["/global/super/chat/project-1", true, false, "project-1"],
		["/global/super/chat/project-1/topic-1", true, false, "project-1"],
		["/global/super/workspace/workspace-1", false, false, undefined],
		["/global/super/project-1/topic-1", false, false, undefined],
		["/global/super", false, false, undefined],
	])("resolves %s", (pathname, isChatRoute, isChatHome, projectId) => {
		const { result } = renderHook(useChatSidebarSelection, {
			wrapper: ({ children }: { children: ReactNode }) => (
				<MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
			),
		})
		expect(result.current).toEqual({ isChatRoute, isChatHome, projectId })
	})
})
