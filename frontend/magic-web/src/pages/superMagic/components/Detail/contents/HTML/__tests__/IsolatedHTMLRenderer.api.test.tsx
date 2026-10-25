import {
	agentActionMocks,
	defaultProps,
	dispatchIframeMessage,
	envMock,
	flushReactEffects,
	renderIsolated,
	useRendererTestSetup,
	userState,
} from "./IsolatedHTMLRenderer.test-helpers"
import IsolatedHTMLRenderer from "../IsolatedHTMLRenderer"
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { USER_INFO_SCOPES } from "../iframe-api/types"

describe("IsolatedHTMLRenderer real API hook routing", () => {
	useRendererTestSetup()

	it.each([window.location.origin, "https://sandbox.example"])(
		"returns display-only user data through the real hook/service to %s",
		async (origin) => {
			envMock.mockReturnValue(`${origin}/husky.html`)
			userState.user.userInfo = {
				user_id: "private-id",
				real_name: "Display Name",
				avatar: "avatar",
				organization_code: "private-org",
			}
			renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />, null)
			await flushReactEffects()
			const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			const postMessage = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			dispatchIframeMessage(iframe, "MAGIC_GET_USER_INFO_REQUEST", origin, {
				requestId: "user-display",
			})
			await flushReactEffects()
			expect(postMessage).toHaveBeenCalledWith(
				{
					type: "MAGIC_GET_USER_INFO_RESPONSE",
					requestId: "user-display",
					success: true,
					userInfo: { name: "Display Name", avatar: "avatar" },
				},
				origin,
			)
			expect(agentActionMocks.authorizeHtmlPermissions).not.toHaveBeenCalled()
		},
	)

	it("returns a permission denial through the real user-info hook without leaking identity", async () => {
		userState.user.userInfo = { user_id: "private-id", real_name: "Display Name" }
		agentActionMocks.authorizeHtmlPermissions.mockResolvedValue(false)
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)
		await flushReactEffects()
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "MAGIC_GET_USER_INFO_REQUEST", window.location.origin, {
			requestId: "private-user",
			scopes: [USER_INFO_SCOPES.IDENTITY],
			reason: "test identity",
		})
		await flushReactEffects()
		expect(agentActionMocks.authorizeHtmlPermissions).toHaveBeenCalledWith(
			[USER_INFO_SCOPES.IDENTITY],
			{ reason: "test identity", presentation: "userInfo" },
		)
		expect(postMessage).toHaveBeenCalledWith(
			{
				type: "MAGIC_GET_USER_INFO_RESPONSE",
				requestId: "private-user",
				success: false,
				error: "User denied access to requested profile fields",
			},
			window.location.origin,
		)
	})

	it("denies identity requests in comparison previews without authorization", async () => {
		userState.user.userInfo = { user_id: "private-id", real_name: "Display Name" }
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} disableHtmlAppPermissions />)
		await flushReactEffects()
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "MAGIC_GET_USER_INFO_REQUEST", window.location.origin, {
			requestId: "comparison-identity",
			scopes: [USER_INFO_SCOPES.IDENTITY],
		})
		await flushReactEffects()

		expect(agentActionMocks.authorizeHtmlPermissions).not.toHaveBeenCalled()
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "comparison-identity", success: false }),
			window.location.origin,
		)
	})

	it("routes a sibling request only to its own service and ignores unrelated senders", async () => {
		userState.user.userInfo = { real_name: "Display Name" }
		renderIsolated(
			<>
				<IsolatedHTMLRenderer {...defaultProps} fileId="a" />
				<IsolatedHTMLRenderer {...defaultProps} fileId="b" />
			</>,
		)
		await flushReactEffects()
		const [a, b] = screen.getAllByTestId("isolated-html-content-iframe") as HTMLIFrameElement[]
		const postA = vi.spyOn(a.contentWindow as Window, "postMessage").mockImplementation(vi.fn())
		const postB = vi.spyOn(b.contentWindow as Window, "postMessage").mockImplementation(vi.fn())
		dispatchIframeMessage(
			a,
			"MAGIC_GET_USER_INFO_REQUEST",
			window.location.origin,
			{ requestId: "sibling" },
			b.contentWindow,
		)
		await flushReactEffects()
		expect(postA).not.toHaveBeenCalled()
		expect(postB).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "sibling", success: true }),
			window.location.origin,
		)
		postB.mockClear()
		dispatchIframeMessage(
			a,
			"MAGIC_GET_USER_INFO_REQUEST",
			window.location.origin,
			{ requestId: "forged" },
			window,
		)
		dispatchIframeMessage(a, "MAGIC_GET_USER_INFO_REQUEST", "https://wrong.example", {
			requestId: "forged",
		})
		await flushReactEffects()
		expect(postA).not.toHaveBeenCalled()
		expect(postB).not.toHaveBeenCalled()
	})

	it("returns a semantic database error without host context through the real database hook", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />, null)
		await flushReactEffects()
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "MAGIC_DB_GET_TABLES_REQUEST", window.location.origin, {
			requestId: "missing-host",
			projectId: "forged-project",
		})
		await flushReactEffects()
		expect(postMessage).toHaveBeenCalledWith(
			{
				type: "MAGIC_DB_GET_TABLES_RESPONSE",
				requestId: "missing-host",
				success: false,
				error: "htmlEditor.projectContextUnavailable",
			},
			"*",
		)
	})
})
