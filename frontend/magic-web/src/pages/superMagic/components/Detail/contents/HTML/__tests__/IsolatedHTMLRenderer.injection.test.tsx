import {
	hookState,
	envMock,
	virtualStorageMocks,
	iframeMessageMocks,
	agentActionMocks,
	defaultHostProject,
	defaultProps,
	renderIsolated,
	getSetContentCalls,
	dispatchIframeMessage,
	flushReactEffects,
	useRendererTestSetup,
} from "./IsolatedHTMLRenderer.test-helpers"
import IsolatedHTMLRenderer from "../IsolatedHTMLRenderer"
import { act, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { IsolatedHTMLRendererRef } from "../IsolatedHTMLRenderer"

describe("IsolatedHTMLRenderer iframe injection", () => {
	useRendererTestSetup()

	it("enables presentation and low-risk media capabilities for HTML previews", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)
		await flushReactEffects()

		const iframe = screen.getByTestId("isolated-html-content-iframe")
		expect(screen.getByTestId("html-editor-canvas")).toBeInTheDocument()
		const sandboxTokens = iframe.getAttribute("sandbox")?.split(/\s+/) ?? []
		const allowedFeatures = iframe
			.getAttribute("allow")
			?.split(";")
			.map((feature) => feature.trim())
			.filter(Boolean)

		expect(sandboxTokens).toEqual(
			expect.arrayContaining(["allow-orientation-lock", "allow-presentation"]),
		)
		expect(allowedFeatures).toEqual(
			expect.arrayContaining([
				"fullscreen",
				"autoplay",
				"picture-in-picture",
				"encrypted-media",
				"web-share",
				"clipboard-write",
			]),
		)
	})

	it("does not expose fixed editor test ids from an inactive cached preview", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} isVisible={false} isEditMode />)
		await flushReactEffects()

		expect(screen.queryByTestId("html-editor-canvas")).not.toBeInTheDocument()
		expect(screen.queryByTestId("isolated-html-content-iframe")).not.toBeInTheDocument()
	})

	it("unmounts the portaled context toolbar when the cached tab is inactive", async () => {
		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} isEditMode isVisible isTabActive />,
		)
		await flushReactEffects()

		expect(screen.getByTestId("html-editor-context-panel")).toBeInTheDocument()

		rerender(
			<IsolatedHTMLRenderer {...defaultProps} isEditMode isVisible isTabActive={false} />,
		)
		await flushReactEffects()

		expect(screen.queryByTestId("html-editor-context-panel")).not.toBeInTheDocument()
	})

	it("shows the scrollbar style only while a PPT is manually zoomed", async () => {
		hookState.isManualZoom = true
		hookState.shouldApplyScaling = true

		const { container, rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} isPptRender manualScale={1.2} />,
		)

		const getScrollableContent = () => container.querySelector(".ppt-manual-zoom-scrollbar")

		await flushReactEffects()
		expect(getScrollableContent()).toBeInTheDocument()

		rerender(<IsolatedHTMLRenderer {...defaultProps} manualScale={1.2} />)

		await flushReactEffects()
		expect(getScrollableContent()).not.toBeInTheDocument()
	})

	it("uses the MicroApp entry marker for storage across html file switches", async () => {
		renderIsolated(
			<IsolatedHTMLRenderer
				{...defaultProps}
				fileId="student-file"
				virtualStorageMarkerId="index-file"
			/>,
		)

		await flushReactEffects()

		expect(virtualStorageMocks.buildNamespace).toHaveBeenCalledWith({
			projectId: "project-1",
			fileId: "index-file",
		})

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		vi.spyOn(iframe.contentWindow as Window, "postMessage").mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()

		expect(virtualStorageMocks.getFullContent).toHaveBeenCalledWith(
			defaultProps.content,
			"index-file",
			expect.any(Object),
		)
	})

	it("does not rebuild virtual storage or re-inject content when the selected topic changes", async () => {
		const firstTopicStore = { selectedTopic: { id: "topic-a" } }
		const secondTopicStore = { selectedTopic: { id: "topic-b" } }

		const { rerender } = render(
			<HostConversationProvider
				selectedProject={{ id: "project-1", current_topic_id: "topic-a" }}
				topicStore={firstTopicStore as unknown as TopicStore}
			>
				<IsolatedHTMLRenderer {...defaultProps} />
			</HostConversationProvider>,
		)
		await flushReactEffects()

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()

		expect(getSetContentCalls(postMessage)).toHaveLength(1)
		const namespaceCallsBefore = virtualStorageMocks.buildNamespace.mock.calls.length
		const contextCallsBefore = virtualStorageMocks.createContext.mock.calls.length

		// 模拟微应用编辑页「新建话题」：仅当前话题变化，入口文件与项目不变。
		rerender(
			<HostConversationProvider
				selectedProject={{ id: "project-1", current_topic_id: "topic-b" }}
				topicStore={secondTopicStore as unknown as TopicStore}
			>
				<IsolatedHTMLRenderer {...defaultProps} />
			</HostConversationProvider>,
		)
		await flushReactEffects()
		await flushReactEffects()

		expect(virtualStorageMocks.buildNamespace.mock.calls).toHaveLength(namespaceCallsBefore)
		expect(virtualStorageMocks.createContext.mock.calls).toHaveLength(contextCallsBefore)
		// 不该因话题切换而再次向 iframe 注入内容。
		expect(getSetContentCalls(postMessage)).toHaveLength(1)
	})

	it("passes the explicit projectId to Agent actions", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} projectId="project-from-preview" />)
		await flushReactEffects()

		expect(agentActionMocks.useIframeAgentActions).toHaveBeenCalledWith(
			"project-from-preview",
			undefined,
			defaultHostProject,
			{ microAppId: undefined, microAppName: undefined },
			undefined,
		)
	})

	it("asks for authentication before message permissions without creating the runtime project", async () => {
		const requireAuthentication = vi
			.fn()
			.mockRejectedValue(new Error("Authentication required"))
		const ensureConversation = vi.fn()
		render(
			<HostConversationProvider
				requireAuthentication={requireAuthentication}
				ensureConversation={ensureConversation}
			>
				<IsolatedHTMLRenderer {...defaultProps} projectId="published-origin" />
			</HostConversationProvider>,
		)
		await flushReactEffects()
		expect(requireAuthentication).not.toHaveBeenCalled()
		expect(ensureConversation).not.toHaveBeenCalled()
		await expect(
			agentActionMocks.agentOptions?.authorizePermission?.("project.message.write"),
		).rejects.toThrow("Authentication required")
		expect(requireAuthentication).toHaveBeenCalledTimes(1)
		expect(agentActionMocks.authorizeHtmlPermission).not.toHaveBeenCalled()
		expect(ensureConversation).not.toHaveBeenCalled()

		requireAuthentication.mockResolvedValue(undefined)
		await expect(
			agentActionMocks.agentOptions?.authorizePermission?.("project.message.write"),
		).resolves.toBe(true)
		expect(agentActionMocks.authorizeHtmlPermission).toHaveBeenCalledWith(
			"project.message.write",
		)
		expect(ensureConversation).not.toHaveBeenCalled()
	})

	it("denies comparison-preview permissions without opening authorization", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} disableHtmlAppPermissions />)
		await flushReactEffects()

		await expect(
			agentActionMocks.agentOptions?.authorizePermission?.("fs.project.read"),
		).resolves.toBe(false)
		await expect(
			agentActionMocks.agentOptions?.authorizePermission?.("project.message.write"),
		).resolves.toBe(false)
		expect(agentActionMocks.authorizeHtmlPermission).not.toHaveBeenCalled()
	})

	it("does not read window.project_id when host props omit projectId", async () => {
		;(window as Window & { project_id?: string }).project_id = "share-window-project"

		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} projectId={undefined} />, {
			selectedProject: undefined,
		})
		await flushReactEffects()

		expect(agentActionMocks.useIframeAgentActions).toHaveBeenCalledWith(
			undefined,
			undefined,
			undefined,
			{ microAppId: undefined, microAppName: undefined },
			undefined,
		)
	})

	it("passes the scoped topic store to Agent actions", async () => {
		const scopedTopicStore = { selectedTopic: { id: "topic-from-micro-app" } }

		renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} projectId="project-from-preview" />,
			{
				topicStore: scopedTopicStore as unknown as TopicStore,
			},
		)
		await flushReactEffects()

		expect(agentActionMocks.useIframeAgentActions).toHaveBeenCalledWith(
			"project-from-preview",
			scopedTopicStore,
			defaultHostProject,
			{ microAppId: undefined, microAppName: undefined },
			undefined,
		)
	})

	it("does not inject content into a sibling iframe from another iframeReady message", async () => {
		renderIsolated(
			<>
				<IsolatedHTMLRenderer
					{...defaultProps}
					fileId="history-file-a"
					content="<html><body>A</body></html>"
				/>
				<IsolatedHTMLRenderer
					{...defaultProps}
					fileId="history-file-b"
					content="<html><body>B</body></html>"
				/>
			</>,
		)

		const [iframeA, iframeB] = screen.getAllByTestId(
			"isolated-html-content-iframe",
		) as HTMLIFrameElement[]
		const postMessageA = vi
			.spyOn(iframeA.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		const postMessageB = vi
			.spyOn(iframeB.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())

		dispatchIframeMessage(iframeA, "iframeReady")

		await flushReactEffects()
		await flushReactEffects()

		expect(getSetContentCalls(postMessageA)).toHaveLength(1)
		expect(getSetContentCalls(postMessageB)).toHaveLength(0)

		dispatchIframeMessage(iframeB, "iframeReady")

		await flushReactEffects()

		expect(getSetContentCalls(postMessageB)).toHaveLength(1)
	})

	it("does not send content twice for iframeReady and pageLoaded", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())

		dispatchIframeMessage(iframe, "iframeReady")
		dispatchIframeMessage(iframe, "pageLoaded")
		await flushReactEffects()

		expect(getSetContentCalls(postMessage)).toHaveLength(1)
	})

	it("reloads unchanged content in a fresh iframe and preserves navigation", async () => {
		const publish = vi.spyOn(pubsub, "publish")
		renderIsolated(
			<IsolatedHTMLRenderer
				{...defaultProps}
				htmlNavigation={{
					filePath: "index.html",
					search: "?page=2",
					hash: "#details",
					anchor: "details",
				}}
			/>,
		)
		await flushReactEffects()
		let iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const originalContextCalls = virtualStorageMocks.createContext.mock.calls.length
		for (let reload = 0; reload < 2; reload += 1) {
			vi.spyOn(iframe.contentWindow as Window, "postMessage").mockImplementation(vi.fn())
			dispatchIframeMessage(iframe, "iframeReady")
			await flushReactEffects()
			const oldIframe = iframe
			dispatchIframeMessage(oldIframe, "MAGIC_RELOAD_REQUEST")
			await flushReactEffects()
			iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			expect(iframe).not.toBe(oldIframe)
			const postMessage = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			dispatchIframeMessage(iframe, "iframeReady")
			await flushReactEffects()
			expect(getSetContentCalls(postMessage)).toHaveLength(1)
			expect(getSetContentCalls(postMessage)[0][0]).toMatchObject({
				content: `<!doctype html>${defaultProps.content}`,
				locationSearch: "?page=2",
				locationAnchor: "#details",
			})
		}
		expect(virtualStorageMocks.createContext).toHaveBeenCalledTimes(originalContextCalls + 2)
		expect(publish).not.toHaveBeenCalledWith(PubSubEvents.Super_Magic_Detail_Refresh)
	})

	it("reloads only the requesting iframe and rejects foreign or stale reload messages", async () => {
		renderIsolated(
			<>
				<IsolatedHTMLRenderer {...defaultProps} fileId="file-a" />
				<IsolatedHTMLRenderer {...defaultProps} fileId="file-b" />
			</>,
		)
		await flushReactEffects()
		const [iframeA, iframeB] = screen.getAllByTestId(
			"isolated-html-content-iframe",
		) as HTMLIFrameElement[]
		const oldWindow = iframeA.contentWindow
		dispatchIframeMessage(iframeA, "MAGIC_RELOAD_REQUEST", "https://untrusted.example")
		dispatchIframeMessage(iframeA, "MAGIC_RELOAD_REQUEST", window.location.origin, {}, window)
		await flushReactEffects()
		expect(screen.getAllByTestId("isolated-html-content-iframe")).toEqual([iframeA, iframeB])
		dispatchIframeMessage(iframeA, "MAGIC_RELOAD_REQUEST")
		await flushReactEffects()
		const [reloadedA, unchangedB] = screen.getAllByTestId(
			"isolated-html-content-iframe",
		) as HTMLIFrameElement[]
		expect(reloadedA).not.toBe(iframeA)
		expect(unchangedB).toBe(iframeB)
		dispatchIframeMessage(
			reloadedA,
			"MAGIC_RELOAD_REQUEST",
			window.location.origin,
			{},
			oldWindow,
		)
		await flushReactEffects()
		expect(screen.getAllByTestId("isolated-html-content-iframe")).toEqual([reloadedA, iframeB])
	})

	it("reloads the original content when resetContent is called", async () => {
		const rendererRef = createRef<IsolatedHTMLRendererRef>()
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} ref={rendererRef} />)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())

		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		expect(getSetContentCalls(postMessage)).toHaveLength(1)

		await act(async () => {
			rendererRef.current?.resetContent()
			await Promise.resolve()
		})

		const nextIframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		expect(nextIframe).not.toBe(iframe)
		const nextPostMessage = vi
			.spyOn(nextIframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(nextIframe, "iframeReady")
		await flushReactEffects()
		const setContentCalls = getSetContentCalls(nextPostMessage)
		expect(setContentCalls).toHaveLength(1)
		expect(setContentCalls[0][0].content).toBe(getSetContentCalls(postMessage)[0][0].content)
	})

	it("updates location query when the same HTML navigation changes", async () => {
		const firstNavigation = {
			filePath: "index.html",
			search: "?value=123",
			hash: "",
			anchor: "",
		}
		const secondNavigation = {
			...firstNavigation,
			search: "?value=456",
		}

		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} htmlNavigation={firstNavigation} />,
		)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())

		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()

		expect(getSetContentCalls(postMessage)).toHaveLength(1)
		expect(getSetContentCalls(postMessage)[0][0]).toMatchObject({
			locationSearch: "?value=123",
		})

		rerender(<IsolatedHTMLRenderer {...defaultProps} htmlNavigation={secondNavigation} />)
		const nextIframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		await flushReactEffects()

		expect(nextIframe).not.toBe(iframe)
		expect(nextIframe.src).toBe(iframe.src)
		expect(getSetContentCalls(postMessage)).toHaveLength(1)

		const nextPostMessage = vi
			.spyOn(nextIframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(nextIframe, "iframeReady")
		await flushReactEffects()

		expect(getSetContentCalls(nextPostMessage)).toHaveLength(1)
		expect(getSetContentCalls(nextPostMessage)[0][0]).toMatchObject({
			locationSearch: "?value=456",
		})
	})

	it("recreates a cross-origin sandbox shell for query updates", async () => {
		const externalShellUrl = "https://husky.example/husky.html"
		envMock.mockReturnValue(externalShellUrl)

		const firstNavigation = {
			filePath: "index.html",
			search: "?value=123",
			hash: "",
			anchor: "",
		}
		const secondNavigation = { ...firstNavigation, search: "?value=456" }
		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} htmlNavigation={firstNavigation} />,
		)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())

		dispatchIframeMessage(iframe, "iframeReady", "https://husky.example")
		await flushReactEffects()

		rerender(<IsolatedHTMLRenderer {...defaultProps} htmlNavigation={secondNavigation} />)
		const nextIframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		await flushReactEffects()

		expect(nextIframe).not.toBe(iframe)
		expect(nextIframe.src).toBe(externalShellUrl)
		expect(getSetContentCalls(postMessage)).toHaveLength(1)

		const nextPostMessage = vi
			.spyOn(nextIframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(nextIframe, "iframeReady", "https://husky.example")
		await flushReactEffects()

		expect(getSetContentCalls(nextPostMessage)).toHaveLength(1)
		expect(getSetContentCalls(nextPostMessage)[0][0]).toMatchObject({
			locationSearch: "?value=456",
		})
	})

	it("does not open a tab when iframe navigation points at the preview shell", async () => {
		const openNewTab = vi.fn()
		const iframeProps = { ...defaultProps, openNewTab, fileId: "cover-file" }
		renderIsolated(<IsolatedHTMLRenderer {...iframeProps} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "linkClicked", window.location.origin, {
			href: "/husky.html",
		})
		await flushReactEffects()

		expect(openNewTab).not.toHaveBeenCalled()
	})

	it("opens a tab when iframe navigation points to index.html", async () => {
		const openNewTab = vi.fn()
		const iframeProps = { ...defaultProps, openNewTab, fileId: "detail-file" }
		renderIsolated(<IsolatedHTMLRenderer {...iframeProps} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "linkClicked", window.location.origin, {
			href: "index.html",
		})
		await flushReactEffects()

		expect(openNewTab).toHaveBeenCalledWith("detail-file", "index.html", false, {
			target: "_self",
			background: false,
			history: "push",
		})
	})

	it("opens a tab when iframe navigation points to index.html with an external index.html shell", async () => {
		envMock.mockReturnValue("https://husky.example/index.html")
		const openNewTab = vi.fn()
		const iframeProps = { ...defaultProps, openNewTab, fileId: "detail-file" }
		renderIsolated(<IsolatedHTMLRenderer {...iframeProps} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "iframeReady", "https://husky.example")
		await flushReactEffects()

		dispatchIframeMessage(iframe, "linkClicked", "https://husky.example", {
			href: "index.html",
		})
		await flushReactEffects()

		expect(openNewTab).toHaveBeenCalledWith("detail-file", "index.html", false, {
			target: "_self",
			background: false,
			history: "push",
		})

		dispatchIframeMessage(iframe, "linkClicked", "https://husky.example", {
			href: "./index.html",
		})
		await flushReactEffects()

		expect(openNewTab).toHaveBeenCalledWith("detail-file", "./index.html", false, {
			target: "_self",
			background: false,
			history: "push",
		})
	})

	it("keeps the renderer file identity when a link message contains a forged fileId", async () => {
		const openNewTab = vi.fn()
		const iframeProps = { ...defaultProps, openNewTab, fileId: "current-file" }
		renderIsolated(<IsolatedHTMLRenderer {...iframeProps} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "linkClicked", window.location.origin, {
			href: "/target.html",
			autoEdit: true,
			fileId: "forged-file",
		})
		await flushReactEffects()

		expect(openNewTab).toHaveBeenCalledWith("current-file", "/target.html", true, {
			target: "_self",
			background: false,
			history: "push",
		})
	})

	it("accepts same-origin link messages from a nested iframe of the current preview", async () => {
		const openNewTab = vi.fn()
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} openNewTab={openNewTab} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const nestedSource = {} as Window
		vi.spyOn(iframe.contentWindow as Window, "frames", "get").mockReturnValue([
			nestedSource,
		] as unknown as Window[])

		dispatchIframeMessage(
			iframe,
			"linkClicked",
			window.location.origin,
			{ href: "/nested-target.html" },
			nestedSource,
		)
		await flushReactEffects()

		expect(openNewTab).toHaveBeenCalledWith("history-file", "/nested-target.html", false, {
			target: "_self",
			background: false,
			history: "push",
		})
	})

	it("forwards named targets, background and history while normalizing invalid intent fields", async () => {
		const openNewTab = vi.fn()
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} openNewTab={openNewTab} />)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "linkClicked", window.location.origin, {
			href: "/target.html",
			target: "report",
			background: true,
			history: "replace",
		})
		await flushReactEffects()
		expect(openNewTab).toHaveBeenLastCalledWith("history-file", "/target.html", false, {
			target: "report",
			background: true,
			history: "replace",
		})
		dispatchIframeMessage(iframe, "linkClicked", window.location.origin, {
			href: "/target.html",
			target: {},
			background: "true",
			history: "traverse",
		})
		await flushReactEffects()
		expect(openNewTab).toHaveBeenLastCalledWith("history-file", "/target.html", false, {
			target: "_self",
			background: false,
			history: "push",
		})
	})

	it("ignores same-origin link messages from an unrelated source", async () => {
		const openNewTab = vi.fn()
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} openNewTab={openNewTab} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(
			iframe,
			"linkClicked",
			window.location.origin,
			{ href: "/target.html" },
			window,
		)
		await flushReactEffects()

		expect(openNewTab).not.toHaveBeenCalled()
	})

	it("ignores link messages from an unexpected origin", async () => {
		const openNewTab = vi.fn()
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} openNewTab={openNewTab} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "linkClicked", "https://untrusted.example", {
			href: "/target.html",
		})
		await flushReactEffects()

		expect(openNewTab).not.toHaveBeenCalled()
	})

	it("ignores input messages from an unexpected source", async () => {
		const publish = vi.spyOn(pubsub, "publish")
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(
			iframe,
			"MAGIC_SET_INPUT_MESSAGE",
			window.location.origin,
			{ message: "forged input" },
			window,
		)
		await flushReactEffects()

		expect(publish).not.toHaveBeenCalledWith(PubSubEvents.Set_Input_Message, "forged input")
	})

	it("accepts input messages from the current iframe source", async () => {
		const publish = vi.spyOn(pubsub, "publish")
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		dispatchIframeMessage(iframe, "MAGIC_SET_INPUT_MESSAGE", window.location.origin, {
			message: "trusted input",
		})
		await flushReactEffects()

		expect(publish).toHaveBeenCalledWith(PubSubEvents.Set_Input_Message, "trusted input")
	})

	it("ignores privileged legacy messages from an unexpected source", async () => {
		const saveEditContent = vi.fn()
		const publish = vi.spyOn(pubsub, "publish")
		renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} isEditMode saveEditContent={saveEditContent} />,
		)

		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const forgedSource = window
		dispatchIframeMessage(
			iframe,
			"MAGIC_DOWNLOAD_FILES_REQUEST",
			window.location.origin,
			{ requestId: "forged-download", filePaths: ["secret.txt"] },
			forgedSource,
		)
		dispatchIframeMessage(
			iframe,
			"MAGIC_SEND_MESSAGE_REQUEST",
			window.location.origin,
			{ requestId: "forged-send", message: "forged message" },
			forgedSource,
		)
		dispatchIframeMessage(
			iframe,
			"saveContent",
			window.location.origin,
			{ content: "forged content" },
			forgedSource,
		)
		dispatchIframeMessage(iframe, "MAGIC_SET_INPUT_MESSAGE", "https://untrusted.example", {
			message: "wrong-origin input",
		})
		await flushReactEffects()

		expect(iframeMessageMocks.handleMagicDownloadFiles).not.toHaveBeenCalled()
		expect(iframeMessageMocks.handleAgentMessage).not.toHaveBeenCalled()
		expect(saveEditContent).not.toHaveBeenCalled()
		expect(publish).not.toHaveBeenCalledWith(PubSubEvents.Set_Input_Message, expect.anything())
		expect(publish).not.toHaveBeenCalledWith(
			PubSubEvents.Set_Input_Message,
			"wrong-origin input",
		)
	})
})
