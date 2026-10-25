import {
	agentActionMocks,
	defaultProps,
	dispatchIframeMessage,
	flushReactEffects,
	hookState,
	useRendererTestSetup,
	virtualStorageMocks,
} from "./IsolatedHTMLRenderer.test-helpers"
import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import IsolatedHTMLRenderer from "../IsolatedHTMLRenderer"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { getIframeDownloadUrl } from "../iframe-api/iframeApi"

const boundary = vi.hoisted(() => ({
	getTables: vi.fn(async () => [{ id: "source-table" }]),
	dispatchMessage: vi.fn(async () => true),
	processMentions: vi.fn(async (content: unknown) => content),
}))
vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: () => false,
}))
vi.mock("@/pages/superMagic/pages/Workspace/types", () => ({
	AgentType: { Official: 1, Custom: 2, Public: 3 },
}))
vi.mock("../iframe-api/magicBaseApi", () => ({ getMagicBaseTables: boundary.getTables }))
vi.mock("@/services/superMagic/SuperMagicModeService", () => ({ default: { _modeList: [] } }))
vi.mock("@/services/superMagic/topicModel", () => ({
	superMagicTopicModelService: { saveModel: vi.fn() },
}))
vi.mock("@/pages/superMagic/services/messageSendFlowService", () => ({
	messageSendService: { dispatchMessage: boundary.dispatchMessage },
}))
vi.mock("@/pages/superMagic/services/messageSendPreparation", () => ({
	resolveMessageSendContext: (context: unknown) => context,
	processMessageMentions: boundary.processMentions,
	releaseHtmlScreenshotsAfterSend: vi.fn(),
}))
vi.mock("@/pages/superMagic/components/MessageEditor/services/uploadMentionService", () => ({
	collectMentionItemsFromContent: () => [],
}))
vi.mock("@/pages/superMagic/utils/notifySpecifiedAgentUnavailable", () => ({
	notifySpecifiedAgentUnavailable: vi.fn(),
}))

// Keep the renderer and FS/DB/Agent hooks/services real. Only network and the final
// message dispatch boundary are replaced, so replies exercise the actual routing.
describe("IsolatedHTMLRenderer entry contexts", () => {
	useRendererTestSetup()
	let actions: typeof import("../hooks/useIframeAgentActions")
	beforeAll(async () => {
		actions = await vi.importActual("../hooks/useIframeAgentActions")
	})
	beforeEach(() => {
		hookState.realAPIHooks = true
		agentActionMocks.useIframeAgentActions.mockImplementation(actions.useIframeAgentActions)
	})

	it.each([
		{
			name: "ordinary HTML",
			origin: undefined,
			host: "host-project",
			lazy: false,
			share: false,
		},
		{
			name: "embedded micro app",
			origin: "source-project",
			host: "host-project",
			lazy: false,
			share: true,
		},
		{
			name: "published micro app",
			origin: "source-project",
			host: undefined,
			lazy: true,
			share: true,
		},
		{
			name: "shared HTML without a host",
			origin: "source-project",
			host: undefined,
			lazy: false,
			share: true,
		},
		{
			name: "shared PPT without a host",
			origin: "source-project",
			host: undefined,
			lazy: false,
			share: true,
		},
	])(
		"keeps origin and conversation boundaries for $name",
		async ({ name, origin, host, lazy, share }) => {
			const expectedOrigin = origin ?? host
			const topicStore = { selectedTopic: { id: "host-topic" } } as TopicStore
			const runtimeProject = { id: "runtime-project" } as ProjectListItem
			const ensureConversation = vi.fn(async () => ({
				selectedProject: runtimeProject,
				topicStore,
			}))
			const access = share
				? createShareFileAccess({ token: "share-token", projectId: "source-project" })
				: null
			render(
				<FileAccessProvider value={access}>
					<HostConversationProvider
						selectedProject={host ? ({ id: host } as ProjectListItem) : null}
						topicStore={host ? topicStore : undefined}
						ensureConversation={lazy ? ensureConversation : undefined}
					>
						<IsolatedHTMLRenderer
							{...defaultProps}
							projectId={origin}
							isPptRender={name.includes("PPT")}
							attachmentList={[
								{ file_id: "source-file", relative_file_path: "index.html" },
							]}
						/>
					</HostConversationProvider>
				</FileAccessProvider>,
			)
			await flushReactEffects()
			const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			const post = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			dispatchIframeMessage(iframe, "MAGIC_FS_GET_FILE_URL_REQUEST", window.location.origin, {
				requestId: "file",
				path: "index.html",
				projectId: "forged-project",
			})
			dispatchIframeMessage(iframe, "MAGIC_DB_GET_TABLES_REQUEST", window.location.origin, {
				requestId: "db",
				projectId: "forged-project",
			})
			await flushReactEffects()
			expect(getIframeDownloadUrl).toHaveBeenCalledWith(["source-file"], access)
			expect(boundary.getTables).toHaveBeenCalledWith(expectedOrigin, access)
			expect(post).toHaveBeenCalledWith(
				expect.objectContaining({
					requestId: "file",
					success: true,
					url: "https://files.example/source",
				}),
				window.location.origin,
			)
			expect(post).toHaveBeenCalledWith(
				expect.objectContaining({
					requestId: "db",
					success: true,
					content: [{ id: "source-table" }],
				}),
				"*",
			)
			expect(virtualStorageMocks.buildNamespace).toHaveBeenCalledWith({
				projectId: expectedOrigin,
				fileId: "history-file",
			})
			expect(ensureConversation).not.toHaveBeenCalled()

			dispatchIframeMessage(iframe, "MAGIC_SEND_MESSAGE_REQUEST", window.location.origin, {
				requestId: "send",
				message: "hello from iframe",
				projectId: "forged-project",
			})
			await flushReactEffects()
			if (!host && !lazy) {
				expect(post).toHaveBeenCalledWith(
					expect.objectContaining({
						requestId: "send",
						success: false,
						error: "htmlEditor.projectContextUnavailable",
					}),
					window.location.origin,
				)
				expect(boundary.dispatchMessage).not.toHaveBeenCalled()
				expect(agentActionMocks.authorizeHtmlPermission).not.toHaveBeenCalled()
			} else {
				expect(post).toHaveBeenCalledWith(
					expect.objectContaining({ requestId: "send", success: true }),
					window.location.origin,
				)
				expect(boundary.processMentions).toHaveBeenCalledWith(
					expect.any(Object),
					expectedOrigin,
					"host-topic",
				)
				expect(boundary.dispatchMessage).toHaveBeenCalledWith(
					expect.objectContaining({
						context: expect.objectContaining({
							selectedProject: expect.objectContaining({
								id: lazy ? "runtime-project" : host,
							}),
							topicStore,
						}),
					}),
				)
				expect(ensureConversation).toHaveBeenCalledTimes(lazy ? 1 : 0)
			}
		},
	)
	it("routes file replies to the new window after query-only navigation", async () => {
		const props = {
			...defaultProps,
			projectId: "source-project",
			attachmentList: [{ file_id: "source-file", relative_file_path: "index.html" }],
		}
		const { rerender } = render(
			<IsolatedHTMLRenderer
				{...props}
				htmlNavigation={{ filePath: "index.html", search: "?page=1" }}
			/>,
		)
		await flushReactEffects()
		const previous = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const oldPost = vi
			.spyOn(previous.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		rerender(
			<IsolatedHTMLRenderer
				{...props}
				htmlNavigation={{ filePath: "index.html", search: "?page=2" }}
			/>,
		)
		await flushReactEffects()
		const current = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		expect(current).not.toBe(previous)
		const post = vi
			.spyOn(current.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(current, "MAGIC_FS_GET_FILE_URL_REQUEST", window.location.origin, {
			requestId: "new-navigation",
			path: "index.html",
		})
		await flushReactEffects()
		expect(post).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "new-navigation", success: true }),
			window.location.origin,
		)
		expect(oldPost).not.toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "new-navigation" }),
			expect.anything(),
		)
	})

	it.each(["preview cancelled", "authentication failed"])(
		"stops before creating a conversation when %s",
		async (failure) => {
			const order: string[] = []
			const ensureConversation = vi.fn(async () => null)
			const requestPreviewMode = vi.fn(async () => {
				order.push("preview")
				return false
			})
			const requireAuthentication = vi.fn(async () => {
				order.push("authentication")
				if (failure === "authentication failed") throw new Error("Login cancelled")
			})
			render(
				<HostConversationProvider
					ensureConversation={ensureConversation}
					requestPreviewMode={requestPreviewMode}
					requireAuthentication={requireAuthentication}
				>
					<IsolatedHTMLRenderer {...defaultProps} projectId="source-project" />
				</HostConversationProvider>,
			)
			await flushReactEffects()
			const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			const post = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			dispatchIframeMessage(iframe, "MAGIC_SEND_MESSAGE_REQUEST", window.location.origin, {
				requestId: "cancelled-send",
				message: "must not send",
			})
			await flushReactEffects()
			expect(post).toHaveBeenCalledWith(
				expect.objectContaining({
					requestId: "cancelled-send",
					success: false,
					error:
						failure === "authentication failed"
							? "Login cancelled"
							: "microAppPage.conversation.switchToPreviewCancelled",
				}),
				window.location.origin,
			)
			expect(order).toEqual(
				failure === "authentication failed"
					? ["authentication"]
					: ["authentication", "preview"],
			)
			expect(ensureConversation).not.toHaveBeenCalled()
			expect(boundary.dispatchMessage).not.toHaveBeenCalled()
		},
	)
})
