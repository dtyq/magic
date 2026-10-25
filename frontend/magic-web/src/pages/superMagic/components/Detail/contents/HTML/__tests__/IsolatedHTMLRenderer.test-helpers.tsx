import { act, render } from "@testing-library/react"
import { type ReactElement, type ReactNode } from "react"
import { afterEach, beforeEach, vi, type MockInstance } from "vitest"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import type { UseIframeAgentOptions } from "../iframe-api/hooks/useIframeAgent"
import type { useHTMLEditorV2 } from "../hooks/useHTMLEditorV2"

const hookState = vi.hoisted(() => ({
	editorContentInjectedValues: [] as boolean[],
	isManualZoom: false,
	shouldApplyScaling: false,
	realAPIHooks: false,
	editorOptions: null as Parameters<typeof useHTMLEditorV2>[0] | null,
}))

const envMock = vi.hoisted(() => vi.fn(() => ""))

const virtualStorageMocks = vi.hoisted(() => ({
	buildNamespace: vi.fn(() => "magic-html-storage:test"),
	createContext: vi.fn(async () => ({
		protocol: "magic-html-virtual-storage",
		renderId: "render-1",
		token: "token-1",
		namespace: "magic-html-storage:test",
		targetOrigin: "*",
		snapshot: {
			localStorage: {},
			sessionStorage: {},
			cookies: {},
			indexedDB: {},
		},
	})),
	getFullContent: vi.fn((content: string) => `<!doctype html>${content}`),
}))

const iframeMessageMocks = vi.hoisted(() => ({
	handleAgentMessage: vi.fn(async () => true),
	handleMagicUploadFiles: vi.fn(),
	handleMagicAddFilesToMessage: vi.fn(),
	handleMagicDownloadFiles: vi.fn(),
}))

const agentActionMocks = vi.hoisted(() => ({
	useIframeAgentActions: vi.fn(),
	agentOptions: null as UseIframeAgentOptions | null,
	authorizeHtmlPermission: vi.fn(async () => true),
	authorizeHtmlPermissions: vi.fn(async () => true),
}))

const i18nState = vi.hoisted(() => ({
	language: "zh-CN",
	resolvedLanguage: "zh-CN",
	on: vi.fn(),
	off: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: i18nState,
	}),
}))

vi.mock("@/utils/env", () => ({
	env: envMock,
	isDev: false,
	isCommercial: vi.fn(() => true),
	isPrivateDeployment: vi.fn(() => false),
	isInternationalEnv: vi.fn(() => false),
	isProductionEnv: vi.fn(() => false),
	isTestEnv: vi.fn(() => true),
	getPrivateDeploymentConfig: vi.fn(() => null),
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			report: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
		}),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {},
	FileApi: {},
}))

const userState = vi.hoisted(() => ({
	user: {
		authorization: "",
		organizationCode: "",
		userInfo: null as null | Record<string, string>,
	},
}))
vi.mock("@/models/user", () => ({ userStore: userState }))

vi.mock("@/pages/chatNew/components/MessageEditor/components/InputFiles/utils", () => ({
	genFileData: (file: File) => ({ name: file.name, file, status: "init" }),
}))

vi.mock("@/pages/superMagic/utils/projectAttachments/attachmentMutationWaiter", () => ({
	waitForProjectAttachmentChange: vi.fn(async () => ({
		projectId: "project-1",
		status: "applied",
		matchMode: "exact-file",
	})),
}))

vi.mock("@/models/config/stores/theme.store", () => ({
	themeStore: {
		theme: "light",
		mode: "light",
		setTheme: vi.fn(),
		setMode: vi.fn(),
		syncDocumentDarkClass: vi.fn(),
	},
}))

vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: {
			rendererContainer: "renderer-container",
			hiddenScrollbar: "hidden-scrollbar",
			pptManualZoomScrollbar: "ppt-manual-zoom-scrollbar",
			iframe: "iframe",
			shadowHost: "shadow-host",
			loadingContainer: "loading-container",
		},
		cx: (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" "),
	}),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(() => ({ destroy: vi.fn() })),
		info: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		error: vi.fn(),
		loading: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/hooks/useUploadFiles", () => ({
	useUpload: () => ({
		upload: vi.fn(async () => ({ fullfilled: [], rejected: [] })),
	}),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/UploadTokenService", () => ({
	superMagicUploadTokenService: {
		getUploadTokenUrl: "",
		getUploadToken: vi.fn(),
		saveFileToProject: vi.fn(),
	},
}))

vi.mock("../iframe-api/iframeApi", () => ({
	saveIframeFileContent: vi.fn(),
	createIframeFile: vi.fn(),
	deleteIframeFile: vi.fn(),
	deleteIframeFiles: vi.fn(),
	moveIframeFile: vi.fn(),
	renameIframeFile: vi.fn(),
	getIframeFileInfo: vi.fn(),
	getIframeDownloadUrl: vi.fn(async () => [
		{ file_id: "source-file", url: "https://files.example/source" },
	]),
}))

vi.mock("../iframe-bridge/contexts/StylePanelContext", () => ({
	StylePanelStoreProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../hooks/useHTMLEditorV2", () => ({
	useHTMLEditorV2: vi.fn((options: Parameters<typeof useHTMLEditorV2>[0]) => {
		hookState.editorOptions = options
		hookState.editorContentInjectedValues.push(options.contentInjected)
		return { isEditorReady: false }
	}),
}))

vi.mock("../hooks/useZoomControls", () => ({
	useZoomControls: () => ({
		scaleRatio: 1,
		shouldApplyScaling: hookState.shouldApplyScaling,
		isScaleReady: true,
		isManualZoom: hookState.isManualZoom,
		handleScaleChange: vi.fn(),
		handleResetZoom: vi.fn(),
		getContentWrapperStyle: () => ({}),
		getIframeStyle: () => ({}),
	}),
}))

vi.mock("../media/useMediaScenario", () => ({
	useMediaScenario: () => ({
		isMediaScenario: false,
		injectMediaScript: (content: string) => content,
		handleMediaSpeakerEdit: vi.fn(),
		saveMediaConfiguration: vi.fn(),
	}),
}))

vi.mock("../media/utils", () => ({
	MEDIA_MESSAGE_TYPES: {
		SPEAKER_EDITED: "MEDIA_SPEAKER_EDITED",
		IMAGE_URL_REQUEST: "MEDIA_IMAGE_URL_REQUEST",
	},
	handleMediaImageUrlRequest: vi.fn(),
}))

vi.mock("../hooks/useImageDrop", () => ({
	useImageDrop: () => ({
		isDragOver: false,
		isGlobalDragActive: false,
		dragOverHandlers: {
			onDragEnter: vi.fn(),
			onDragOver: vi.fn(),
			onDragLeave: vi.fn(),
			onDrop: vi.fn(),
		},
	}),
}))

vi.mock("../hooks/useDevConsole", () => ({
	useDevConsole: () => ({
		enabled: false,
		toggle: vi.fn(),
		consoleEntries: [],
		networkEntries: [],
		apiCallEntries: [],
		messageEntries: [],
		storageSnapshot: null,
		storageLoading: false,
		activeTab: "console",
		setActiveTab: vi.fn(),
		clearConsole: vi.fn(),
		clearNetwork: vi.fn(),
		clearApiCalls: vi.fn(),
		clearMessages: vi.fn(),
		clearAll: vi.fn(),
		sendErrorToAgent: vi.fn(),
		executeCode: vi.fn(),
		requestCompletions: vi.fn(async () => []),
		requestStorageSnapshot: vi.fn(),
		consoleErrorCount: 0,
		networkErrorCount: 0,
		apiCallErrorCount: 0,
	}),
}))

vi.mock("@/components/business/ElementInspector", () => ({
	useElementInspector: () => ({
		active: false,
		hoveredElement: null,
		selectedElement: null,
		clearSelection: vi.fn(),
		stop: vi.fn(),
		start: vi.fn(),
		toggle: vi.fn(),
	}),
	ElementInspectorOverlay: () => null,
	buildAgentPromptContent: vi.fn(() => ""),
}))

vi.mock("../hooks/useInspectorToolbarMode", () => ({
	useInspectorToolbarMode: () => ({
		hideInfoCard: false,
		isAppendPicking: false,
		startInToolbarMode: vi.fn(),
		startInAppendMode: vi.fn(),
		resetSelection: vi.fn(),
		inspectorModeRef: { current: "devConsole" },
	}),
}))

vi.mock("../hooks/useFetchInterceptionCache", () => ({
	useFetchInterceptionCache: () => ({
		handleFetchIntercepted: vi.fn(),
		dynamicDependencyEntries: [],
	}),
}))

vi.mock("../utils/virtual-storage", () => ({
	buildHtmlVirtualStorageNamespace: virtualStorageMocks.buildNamespace,
	createVirtualStorageContext: virtualStorageMocks.createContext,
	virtualStorageRegistry: {
		register: vi.fn(),
		unregister: vi.fn(),
	},
}))

vi.mock("../utils/full-content", () => ({
	decodeHTMLEntities: (content: string) => content,
	getFullContent: virtualStorageMocks.getFullContent,
}))

vi.mock("../hooks/useCurrentHtmlFileInfo", () => ({
	useCurrentHtmlFileInfo: () => ({
		relativeFilePath: "index.html",
		fileName: "index.html",
	}),
}))

vi.mock("../hooks/useHtmlAppPermissions", () => ({
	useHtmlAppPermissions: () => ({
		htmlAppConfig: null,
		htmlAppConfigState: { loading: false, error: null },
		htmlAppInstanceKey: "test-app",
		authorizeHtmlPermission: agentActionMocks.authorizeHtmlPermission,
		authorizeHtmlPermissions: agentActionMocks.authorizeHtmlPermissions,
	}),
}))

vi.mock("../iframe-api/hooks/useIframeFS", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../iframe-api/hooks/useIframeFS")>()
	return {
		useIframeFS: (options: Parameters<typeof actual.useIframeFS>[0]) => {
			const useFS = hookState.realAPIHooks
				? actual.useIframeFS
				: () => ({ handleFSMessage: vi.fn(async () => false) })
			return useFS(options)
		},
	}
})

vi.mock("../iframe-api/hooks/useIframeLLM", () => ({
	useIframeLLM: () => ({
		handleLLMMessage: vi.fn(async () => false),
	}),
}))

vi.mock("../iframe-api/hooks/useIframeAgent", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../iframe-api/hooks/useIframeAgent")>()
	return {
		useIframeAgent: (options: UseIframeAgentOptions) => {
			agentActionMocks.agentOptions = options
			const useAgent = hookState.realAPIHooks
				? actual.useIframeAgent
				: () => ({ handleAgentMessage: iframeMessageMocks.handleAgentMessage })
			return useAgent(options)
		},
	}
})

vi.mock("../hooks/useIframeAgentActions", () => ({
	useIframeAgentActions: (...args: [string | undefined, unknown?]) => {
		const realActions = agentActionMocks.useIframeAgentActions(...args)
		return (
			realActions ?? {
				getAgentList: vi.fn(),
				createTopicAndSend: vi.fn(),
				sendMessage: vi.fn(),
			}
		)
	},
}))

vi.mock("../iframe-api/hooks/useMagicFiles", () => ({
	useMagicFiles: () => ({
		handleMagicUploadFiles: iframeMessageMocks.handleMagicUploadFiles,
		handleMagicAddFilesToMessage: iframeMessageMocks.handleMagicAddFilesToMessage,
		handleMagicDownloadFiles: iframeMessageMocks.handleMagicDownloadFiles,
	}),
}))

vi.mock("../components/SelectionOverlay", () => ({
	SelectionOverlay: () => null,
}))

vi.mock("../components/DropOverlay", () => ({
	DropOverlay: () => null,
}))

vi.mock("../components/StylePanel", () => ({
	StylePanel: () => null,
}))

vi.mock("../components/ElementContextPanel", () => ({
	ElementContextPanel: () => <div data-testid="html-editor-context-panel" />,
}))

vi.mock("../components/StylePanel/controls", () => ({
	ZoomControls: () => null,
}))

vi.mock("../components/DevConsole", () => ({
	DevConsolePanel: () => null,
}))

const defaultHostProject = { id: "project-1" }

const defaultProps = {
	content: "<html><body>history</body></html>",
	filePathMapping: new Map<string, string>(),
	openNewTab: vi.fn(),
	fileId: "history-file",
	attachmentList: [],
	isVisible: true,
}

function renderIsolated(
	ui: ReactElement,
	host: {
		selectedProject?: { id: string; current_topic_id?: string } | null
		topicStore?: TopicStore
	} | null = {},
) {
	if (host === null) {
		return render(ui)
	}

	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<HostConversationProvider
				selectedProject={
					"selectedProject" in host ? host.selectedProject : defaultHostProject
				}
				topicStore={host.topicStore}
			>
				{children}
			</HostConversationProvider>
		)
	}

	return render(ui, { wrapper: Wrapper })
}

function getSetContentCalls(postMessage: MockInstance<typeof window.postMessage>) {
	return postMessage.mock.calls.filter(([message]) => message?.type === "setContent")
}

function dispatchIframeMessage(
	iframe: HTMLIFrameElement,
	type: string,
	origin = window.location.origin,
	extraData: Record<string, unknown> = {},
	source: Window | null = iframe.contentWindow,
) {
	act(() => {
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type, ...extraData },
				origin,
				source,
			}),
		)
	})
}

async function flushReactEffects() {
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
	})
}

// Only surrounding UI and external boundaries are mocked. The renderer, navigation
// service and user-info hook/service execute their real lifecycle and message routing.
export function useRendererTestSetup() {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		i18nState.language = "zh-CN"
		i18nState.resolvedLanguage = "zh-CN"
		envMock.mockReturnValue("")
		userState.user.userInfo = null
		agentActionMocks.authorizeHtmlPermissions.mockResolvedValue(true)
		hookState.editorContentInjectedValues = []
		hookState.editorOptions = null
		hookState.isManualZoom = false
		hookState.shouldApplyScaling = false
		hookState.realAPIHooks = false
		agentActionMocks.useIframeAgentActions.mockReset()
	})

	afterEach(() => {
		act(() => {
			vi.runOnlyPendingTimers()
		})
		vi.useRealTimers()
		vi.restoreAllMocks()
		delete (window as Window & { project_id?: string }).project_id
	})
}

export {
	i18nState,
	hookState,
	envMock,
	virtualStorageMocks,
	iframeMessageMocks,
	agentActionMocks,
	userState,
	defaultHostProject,
	defaultProps,
	renderIsolated,
	getSetContentCalls,
	dispatchIframeMessage,
	flushReactEffects,
}
