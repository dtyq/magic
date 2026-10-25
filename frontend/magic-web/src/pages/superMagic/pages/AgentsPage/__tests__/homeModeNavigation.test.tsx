import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect, useState, type ComponentType, ReactNode } from "react"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router"
import { describe, expect, it, vi } from "vitest"
import Home from "../index.desktop"
import { useKeepAlive } from "@/hooks/router/useKeepAlive"

vi.mock("@/components/fallback/LoadingFallback", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const { homeMount, homeUnmount } = vi.hoisted(() => ({
	homeMount: vi.fn(),
	homeUnmount: vi.fn(),
}))
vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: { user_id: "user" }, organizationCode: "org" } },
}))
vi.mock("@/pages/superMagic/hooks/useFeaturedModeListRefresh", () => ({
	useFeaturedModeListRefreshOnAgentsPageMount: vi.fn(),
}))
vi.mock("../components/Header", () => ({ default: () => <div>workspace header</div> }))
/**
 * The home also mounts the new-user benefits card. It is not what this file is about — the card is
 * told nothing about routes and holds no editor state — but its own graph reaches the admin package
 * through the user hooks it reads, and that package imports through an alias only the app's build
 * resolves, not this test's. Standing it in keeps the two halves of the shell under test: the bar
 * that swaps with the route, and the editor session that is recreated with it.
 */
vi.mock("../../../components/NewUserBenefits", () => ({
	default: () => <div>new user benefits</div>,
}))
vi.mock("../../ChatHomePage/components/ChatConversationSwitcher", () => ({
	default: () => <div>chat header</div>,
}))
vi.mock("../../ChatHomePage/components/ChatHomeEditor", () => ({
	default: function ChatEditor() {
		const [value, setValue] = useState("")
		return (
			<input
				aria-label="chat session"
				value={value}
				onChange={(e) => setValue(e.target.value)}
			/>
		)
	},
}))
vi.mock("../../../components/MainInputContainer", () => ({
	default: function Container({
		EditorComponent,
		editorSessionKey,
	}: {
		EditorComponent?: ComponentType
		editorSessionKey?: string
	}) {
		useEffect(() => {
			homeMount()
			return homeUnmount
		}, [])
		return (
			<div data-testid="persistent-home">
				{EditorComponent ? (
					<EditorComponent key={editorSessionKey} />
				) : (
					<input aria-label="task session" />
				)}
			</div>
		)
	},
}))

function Navigation() {
	const navigate = useNavigate()
	return (
		<>
			<button onClick={() => navigate("/global/super/new-chat")}>chat</button>
			<button onClick={() => navigate("/global/super/workspace/workspace-1")}>task</button>
			<button onClick={() => navigate(-1)}>back</button>
		</>
	)
}

function CachedLayout() {
	// Exercise the real outer route cache; an incorrectly cached home creates a second editor.
	const { Content } = useKeepAlive()
	return Content
}

describe("desktop creation home navigation", () => {
	it("preserves the home DOM across route changes while isolating editor sessions", async () => {
		render(
			<MemoryRouter initialEntries={["/global/super/workspace/workspace-1"]}>
				<Navigation />
				<Routes>
					<Route element={<CachedLayout />}>
						<Route
							path="/:clusterCode/super/workspace/:workspaceId"
							element={<Home />}
						/>
						<Route path="/:clusterCode/super/new-chat" element={<Home />} />
					</Route>
				</Routes>
			</MemoryRouter>,
		)
		const home = screen.getByTestId("persistent-home")
		fireEvent.click(screen.getByText("chat", { selector: "button" }))
		fireEvent.change(screen.getByLabelText("chat session"), {
			target: { value: "old session" },
		})
		expect(screen.getByText("chat header")).toBeInTheDocument()
		fireEvent.click(screen.getByText("task", { selector: "button" }))
		expect(screen.getByLabelText("task session")).toBeInTheDocument()
		expect(screen.queryByLabelText("chat session")).not.toBeInTheDocument()
		fireEvent.click(screen.getByText("back", { selector: "button" }))
		await waitFor(() => expect(screen.getByLabelText("chat session")).toHaveValue(""))
		expect(screen.getByTestId("persistent-home")).toBe(home)
		expect(homeMount).toHaveBeenCalledTimes(1)
		expect(homeUnmount).not.toHaveBeenCalled()
	})
})
