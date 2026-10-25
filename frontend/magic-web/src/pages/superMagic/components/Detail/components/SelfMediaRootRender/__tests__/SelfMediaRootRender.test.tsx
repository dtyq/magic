import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import superZhCN from "@/assets/locales/zh_CN/super.json"

const mockSendSelfMediaPrePublishAnalysis = vi.hoisted(() => vi.fn())
const mockSendSelfMediaPostPublishDataRefresh = vi.hoisted(() => vi.fn())
const mockBuildSelfMediaPostAutoSyncTaskData = vi.hoisted(() => vi.fn())
const mockSaveSelfMediaPostAutoSyncTask = vi.hoisted(() => vi.fn())
const mockDisableSelfMediaPostAutoSyncTask = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())
const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockLoadPostOpsSource = vi.hoisted(() => vi.fn())
const mockLoadPostOpsMetrics = vi.hoisted(() => vi.fn())
const mockLoadPostOpsComments = vi.hoisted(() => vi.fn())
const mockLoadPostOpsReview = vi.hoisted(() => vi.fn())
const mockLoadPostOpsReviewHtml = vi.hoisted(() => vi.fn())
const mockSavePostOpsSource = vi.hoisted(() => vi.fn())
const mockAICardCreateDialogRender = vi.hoisted(() => vi.fn())
const mockLanguageModel = vi.hoisted(() => ({
	id: "model-1",
	group_id: "group-1",
	model_id: "gpt-5",
	model_name: "GPT-5",
	provider_model_id: "gpt-5",
	model_description: "",
	model_icon: "",
	model_status: "normal",
	sort: 1,
}))

const mockStore = vi.hoisted(() => ({
	platforms: ["rednote"],
	resolvedPlatform: "rednote",
	rootLoading: false,
	sharedPostFallback: false,
	activePostIndex: 0,
	allPosts: [
		{
			platform: "rednote",
			index: 0,
			entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
			post: {
				meta: {
					id: "post-1",
					title: "Post One",
					feedTitle: "Post One Feed",
					author: "Magic Lab",
				},
				cards: [],
			},
		},
	],
	posts: [
		{
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [],
		},
	],
	handleChangePlatform: vi.fn(),
	openPostDetail: vi.fn(),
	ensurePlatformPostLoaded: vi.fn(),
	goHomeList: vi.fn(),
	init: vi.fn(),
}))

vi.mock("react-dom", async () => {
	const actual = await vi.importActual<typeof import("react-dom")>("react-dom")
	return {
		...actual,
		createPortal: (node: React.ReactNode) => node,
	}
})

vi.mock("@/components/tiptap-templates/simple/simple-editor", async () => {
	const React = await vi.importActual<typeof import("react")>("react")
	return {
		SimpleEditor: React.forwardRef(({ content }: { content?: string }, _ref) =>
			React.createElement(
				"div",
				{ "data-testid": "simple-editor-markdown-preview" },
				content,
			),
		),
	}
})

vi.mock("@/pages/superMagic/components/MessageEditor/types", () => ({
	ModelStatusEnum: {
		Disabled: "disabled",
		Deleted: "deleted",
	},
	ModelTagEnum: {},
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", async () => {
	const React = await vi.importActual<typeof import("react")>("react")
	return {
		default: React.forwardRef(function MockIsolatedHTMLRenderer(
			props: {
				content?: string
				htmlRelativeFolderPath?: string
			},
			ref,
		) {
			void ref
			return React.createElement(
				"div",
				{
					"data-testid": "self-media-ops-review-html-renderer",
					"data-relative-file-path": props.htmlRelativeFolderPath,
				},
				props.content,
			)
		}),
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en" },
		t: (key: string, options?: Record<string, unknown>) => {
			// The operations overview uses the shared selfMedia namespace. Keep its Chinese
			// assertions backed by real locale data rather than returning untranslated keys.
			if (key.startsWith("selfMedia.")) {
				const localeKey = key.slice("selfMedia.".length) as keyof typeof superZhCN.selfMedia
				const value = superZhCN.selfMedia[localeKey]
				if (typeof value === "string")
					return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
						String(options?.[name] ?? ""),
					)
			}
			const text =
				(
					{
						"detail.selfMedia.platform.switcher.label": "Platform",
						"detail.selfMedia.platform.actions.create": "New article",
						"detail.selfMedia.platform.actions.back": "Back to content",
						"detail.selfMedia.home.title": "Article home",
						"detail.selfMedia.home.subtitle": "Manage articles",
						"detail.selfMedia.home.create": "New article",
						"detail.selfMedia.home.emptyTitle": "No articles yet",
						"detail.selfMedia.home.emptyDesc": "Create your first article",
						"detail.selfMedia.home.engagement.comments": "Comments",
						"detail.selfMedia.home.engagement.likes": "Likes",
						"detail.selfMedia.home.engagement.reads": "Reads",
						"detail.selfMedia.home.articleCount": "1 article",
						"detail.selfMedia.home.postReviewCard": "Create review",
						"detail.selfMedia.home.openOpsReview": "Review",
						"detail.selfMedia.home.postReviewCardName": "Review: {{title}}",
						"detail.selfMedia.opsReview.title": "Operations review",
						"detail.selfMedia.opsReview.close": "Close review",
						"detail.selfMedia.opsReview.sync": "Sync data",
						"detail.selfMedia.opsReview.edit": "Edit data",
						"detail.selfMedia.opsReview.summaryTitle": "Performance brief",
						"detail.selfMedia.opsReview.metricsTitle": "Core metrics",
						"detail.selfMedia.opsReview.trendTitle": "Sync trend",
						"detail.selfMedia.opsReview.impactTitle": "Impact map",
						"detail.selfMedia.opsReview.qualityTitle": "Quality mix",
						"detail.selfMedia.opsReview.funnelTitle": "Traffic efficiency",
						"detail.selfMedia.opsReview.commentsTitle": "Audience feedback",
						"detail.selfMedia.opsReview.actionsTitle": "Next actions",
						"detail.selfMedia.opsReview.reviewTitle": "Review report",
						"detail.selfMedia.opsReview.empty": "No data yet",
						"detail.selfMedia.opsReview.engagementRate": "Engagement rate",
						"detail.selfMedia.opsReview.conversionSignal": "Comment intent",
						"detail.selfMedia.opsReview.kpiHints.reach": "Reach scale",
						"detail.selfMedia.opsReview.kpiHints.preference": "Preference",
						"detail.selfMedia.opsReview.kpiHints.spread": "Distribution",
						"detail.selfMedia.opsReview.kpiHints.intent": "Intent",
						"detail.selfMedia.opsReview.kpiHints.efficiency": "Efficiency",
						"detail.selfMedia.opsReview.brief.reachTrend": "Reads change",
						"detail.selfMedia.opsReview.brief.efficiency": "Efficiency",
						"detail.selfMedia.opsReview.brief.intent": "Intent",
						"detail.selfMedia.opsReview.brief.consulting":
							"{{count}} consulting signal(s)",
						"detail.selfMedia.opsReview.funnel.reach": "Reach",
						"detail.selfMedia.opsReview.funnel.engagement": "Engagement",
						"detail.selfMedia.opsReview.funnel.intent": "Intent",
						"detail.selfMedia.opsReview.sourceStatus.fetched": "Fetched",
						"detail.selfMedia.opsReview.sourceStatus.pending": "Pending",
						"detail.selfMedia.opsReview.sourceStatus.failed": "Failed",
						"detail.selfMedia.opsReview.sourceStatus.unknown": "Not fetched",
						"detail.selfMedia.opsReview.deltaReads": "Reads change",
						"detail.selfMedia.opsReview.reviewHtmlTitle": "HTML review report",
						"detail.selfMedia.home.opsData": "Data",
						"detail.selfMedia.home.dataSyncNow": "Sync",
						"detail.selfMedia.home.dataOverview": "Data overview",
						"detail.selfMedia.home.autoSync": "Auto sync",
						"detail.selfMedia.home.autoSyncDescription": "Run on a schedule",
						"detail.selfMedia.home.autoSyncStatus": "Status",
						"detail.selfMedia.home.autoSyncEnabled": "On",
						"detail.selfMedia.home.autoSyncDisabled": "Off",
						"detail.selfMedia.home.autoSyncDaily": "Daily",
						"detail.selfMedia.home.autoSyncWeekly": "Weekly",
						"detail.selfMedia.home.autoSyncMonthly": "Monthly",
						"detail.selfMedia.home.autoSyncWeekdayPlaceholder": "Weekday",
						"detail.selfMedia.home.autoSyncMonthDayPlaceholder": "Day",
						"detail.selfMedia.home.autoSyncSave": "Save auto sync",
						"detail.selfMedia.home.autoSyncTurnOff": "Turn off auto sync",
						"detail.selfMedia.home.loadingAutoSync": "Loading auto sync",
						"detail.selfMedia.home.mentionPost": "Mention this article",
						"detail.selfMedia.analysis.action": "Diagnose",
						"detail.selfMedia.home.bindPublishedLink": "Add link",
						"detail.selfMedia.home.editPublishedLink": "Edit link",
						"detail.selfMedia.home.publishedLinkInput": "Published content link",
						"detail.selfMedia.home.publishedLinkPlaceholder":
							"Paste the published content link",
						"detail.selfMedia.home.loadingPublishedLink": "Loading link...",
						"detail.selfMedia.home.bindPublishedLinkAction": "Save link",
						"detail.selfMedia.home.bindAndFetchPublishedData":
							"Save and fetch article data",
						"detail.selfMedia.opsRefresh.missingSourceUrl":
							"Please bind the published article URL first.",
						"detail.selfMedia.opsRefresh.startFailed":
							"Failed to start data sync. Please try again later.",
						"detail.selfMedia.opsRefresh.startFailedWithReason":
							"Failed to start data sync: {{reason}}",
						"detail.selfMedia.mentionPost.success": "Mention added to the input box",
						"detail.selfMedia.mentionPost.startFailed":
							"Failed to mention the article. Please try again later.",
						"detail.selfMedia.mentionPost.startFailedWithReason":
							"Failed to mention the article: {{reason}}",
						"detail.selfMedia.analysis.startFailedWithReason":
							"Failed to start pre-publish diagnosis: {{reason}}",
						"detail.selfMedia.errors.noProjectSelected":
							"Current project information is missing. Refresh the page and try again.",
						"detail.selfMedia.errors.postDirectoryMissing":
							"Could not find the current post folder. Refresh the file list and try again.",
						"detail.selfMedia.errors.projectContextMissing":
							"Project or workspace information is missing. Refresh the page and try again.",
						"detail.selfMedia.errors.publishedUrlMissing":
							"The published article URL is missing. Bind the link again first.",
						"detail.selfMedia.errors.taskIdMissing":
							"The scheduled task did not return a task ID.",
						"detail.selfMedia.home.opsOverview.title": "Operations loop",
						"detail.selfMedia.home.opsOverview.content": "Content",
						"detail.selfMedia.home.opsOverview.source": "Published link",
						"detail.selfMedia.home.opsOverview.metrics": "Metrics",
						"detail.selfMedia.home.opsOverview.comments": "Feedback",
						"detail.selfMedia.home.opsOverview.review": "Review",
						"detail.selfMedia.home.opsOverview.progress": "{{done}}/{{total}}",
						"detail.selfMedia.home.opsArtifacts.sourceReady": "Link bound",
						"detail.selfMedia.home.opsArtifacts.sourceMissing": "Link missing",
						"detail.selfMedia.home.opsArtifacts.metricsReady": "Metrics ready",
						"detail.selfMedia.home.opsArtifacts.commentsReady": "Feedback ready",
						"detail.selfMedia.home.opsArtifacts.reviewReady": "Review ready",
						"detail.selfMedia.home.opsArtifacts.metricsMissing": "Data not fetched",
						"detail.selfMedia.home.opsArtifacts.commentsMissing":
							"Feedback not organized",
						"detail.selfMedia.home.opsArtifacts.reviewMissing": "Review not created",
						"detail.selfMedia.home.referenceData": "Reference data",
						"detail.selfMedia.home.brandConfig": "Brand config",
						"detail.selfMedia.initPanel.platforms.rednote": "RedNote",
						"detail.selfMedia.initPanel.platforms.instagram": "Instagram",
					} as Record<string, string>
				)[key] ?? key
			return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
				String(options?.[name] ?? ""),
			)
		},
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({ zhCNModules: {}, enUSModules: {} }),
	getAdminLocaleModules: () => ({ zhCNModules: {}, enUSModules: {} }),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/query", () => ({
	getSuperIdState: () => ({
		projectId: "project-1",
		topicId: "topic-1",
		workspaceId: "workspace-1",
	}),
}))

vi.mock("@/types/scheduledTask", () => ({
	ScheduledTask: {
		ScheduleType: {
			Daily: "daily_repeat",
			Weekly: "weekly_repeat",
			Monthly: "monthly_repeat",
		},
	},
}))

vi.mock("@/routes/routes", () => ({
	registerRoutes: [],
}))

vi.mock("@/routes/history/helpers", () => ({
	getRoutePath: () => "",
	fillRoute: (path: string) => path,
	convertSearchParams: () => "",
	routesMatch: () => false,
	routesPathMatch: () => false,
}))

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: function MockMagicSpin() {
		return <div>loading</div>
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: mockToastError,
		success: mockToastSuccess,
	},
}))

vi.mock("antd", () => ({
	Flex: function MockFlex({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
		return <div {...props}>{children}</div>
	},
	message: {
		config: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("../components/PlatformSwitcher", () => ({
	default: function MockPlatformSwitcher() {
		return <div data-testid="self-media-platform-switcher">platform-switcher</div>
	},
}))

vi.mock("../components/UnsupportedPlatform", () => ({
	default: function MockUnsupportedPlatform() {
		return <div>unsupported-platform</div>
	},
}))

vi.mock("../components/CardFrame", () => ({
	default: function MockCardFrame({ fileId, version }: { fileId?: string; version?: string }) {
		return <div data-file-id={fileId} data-version={version} data-testid="mock-card-frame" />
	},
}))

vi.mock("../components/SelfMediaInitPanel", () => ({
	default: function MockSelfMediaInitPanel({ onBackHome }: { onBackHome?: () => void }) {
		return (
			<div data-testid="mock-self-media-init-panel">
				init-panel
				<button type="button" onClick={onBackHome}>
					Back to content
				</button>
			</div>
		)
	},
}))

vi.mock("../components/BrandConfigDialog", () => ({
	default: function MockBrandConfigDialog({
		open,
	}: {
		open: boolean
		onOpenChange: (open: boolean) => void
	}) {
		return open ? <div data-testid="self-media-brand-config-dialog">brand-config</div> : null
	},
}))

vi.mock("../components/SelfMediaOpsMetricsDialog", () => ({
	default: function MockSelfMediaOpsMetricsDialog({
		open,
		target,
		onUpdateAutoSyncPublishedUrl,
		onFetchPublishedData,
	}: {
		open: boolean
		target?: { post?: { meta?: { title?: string; feedTitle?: string } } } | null
		onUpdateAutoSyncPublishedUrl?: (
			target: unknown,
			publishedUrl: string,
			autoSync: {
				enabled: boolean
				taskId?: string
				timeConfig?: { type: string; time: string; day?: string }
			},
		) => void
		onFetchPublishedData?: (target: unknown, publishedUrl: string) => void
	}) {
		return open ? (
			<div data-testid="self-media-ops-metrics-dialog">
				{target?.post?.meta?.feedTitle || target?.post?.meta?.title}
				<button
					type="button"
					onClick={() =>
						target &&
						onFetchPublishedData?.(
							target,
							"https://www.xiaohongshu.com/explore/dialog-post-1",
						)
					}
					data-testid="self-media-ops-dialog-fetch"
				>
					fetch-dialog-data
				</button>
				<button
					type="button"
					onClick={() =>
						target &&
						onUpdateAutoSyncPublishedUrl?.(
							target,
							"https://www.xiaohongshu.com/explore/new-post-1",
							{
								enabled: true,
								taskId: "task-1",
								timeConfig: {
									type: "weekly_repeat",
									time: "10:30",
									day: "2",
								},
							},
						)
					}
					data-testid="self-media-ops-dialog-update-auto-sync-link"
				>
					update-auto-sync-link
				</button>
			</div>
		) : null
	},
}))

vi.mock("../components/AICardCreateDialog", () => ({
	default: function MockAICardCreateDialog({
		open,
		initialValues,
	}: {
		open: boolean
		initialValues?: {
			taskName?: string
			prompt?: string
			template?: string
			enabled?: boolean
		}
	}) {
		mockAICardCreateDialogRender({ open, initialValues })
		return open ? (
			<div data-testid="self-media-ai-card-create-dialog">
				<div data-testid="self-media-ai-card-create-task-name">
					{initialValues?.taskName}
				</div>
				<div data-testid="self-media-ai-card-create-prompt">{initialValues?.prompt}</div>
				<div data-testid="self-media-ai-card-create-template">
					{initialValues?.template}
				</div>
				<div data-testid="self-media-ai-card-create-enabled">
					{String(initialValues?.enabled)}
				</div>
			</div>
		) : null
	},
}))

vi.mock("../components/PrePublishAnalysisDialog", () => ({
	default: function MockPrePublishAnalysisDialog({
		open,
		onOpenChange,
		onConfirm,
		selectedModel,
	}: {
		open: boolean
		onOpenChange: (open: boolean) => void
		onConfirm: (
			goal: "ip-growth" | "conversion" | "viral-traffic",
			model: typeof mockLanguageModel | null,
		) => void
		selectedModel?: typeof mockLanguageModel | null
		loading?: boolean
	}) {
		return open ? (
			<div data-testid="pre-publish-analysis-dialog">
				<div data-testid="pre-publish-analysis-selected-model">
					{selectedModel?.model_name}
				</div>
				<button
					type="button"
					onClick={() => onConfirm("conversion", selectedModel ?? null)}
				>
					confirm-analysis
				</button>
				<button type="button" onClick={() => onOpenChange(false)}>
					cancel-analysis
				</button>
			</div>
		) : null
	},
}))

vi.mock("../platforms", () => ({
	getPlatformComponent: () =>
		function MockPlatformComponent({
			onBackHome,
			onRequestPrePublishAnalysis,
		}: {
			onBackHome?: () => void
			onRequestPrePublishAnalysis?: () => void
		}) {
			return (
				<div data-testid="mock-platform-component">
					platform-content
					{onBackHome ? (
						<button type="button" onClick={onBackHome}>
							Back to content
						</button>
					) : null}
					{onRequestPrePublishAnalysis ? (
						<button
							type="button"
							data-testid="self-media-footer-pre-publish-analysis"
							onClick={onRequestPrePublishAnalysis}
						>
							AI 诊断
						</button>
					) : null}
				</div>
			)
		},
}))

vi.mock("../platforms/wechat-official-accounts/useCoverImageUrl", () => ({
	useCoverImageUrl: (fileId?: string) => ({
		url: fileId ? `https://example.test/${fileId}.png` : null,
		loading: false,
		error: null,
	}),
}))

vi.mock("../stores", () => ({
	SelfMediaStoreProvider: function MockSelfMediaStoreProvider({
		children,
	}: {
		children: React.ReactNode
	}) {
		return <>{children}</>
	},
	useSelfMediaStore: () => mockStore,
}))

vi.mock("../services/selfMediaPrePublishAnalysis", () => ({
	SELF_MEDIA_PRE_PUBLISH_TOPIC_PATTERN: "ip-manager",
	sendSelfMediaPrePublishAnalysis: mockSendSelfMediaPrePublishAnalysis,
}))

vi.mock("../services/selfMediaPostPublishDataRefresh", () => ({
	SELF_MEDIA_POST_PUBLISH_DATA_TOPIC_PATTERN: "ip-manager",
	buildFolderMention: (item: {
		file_id?: string
		file_name?: string
		filename?: string
		display_filename?: string
		relative_file_path?: string
		display_config?: unknown
	}) => ({
		type: "project_directory",
		data: {
			directory_id: item.file_id || "",
			directory_name: item.file_name || item.filename || item.display_filename || "",
			directory_path: item.relative_file_path || "",
			directory_metadata: {},
		},
	}),
	sendSelfMediaPostPublishDataRefresh: mockSendSelfMediaPostPublishDataRefresh,
}))

vi.mock("../services/selfMediaPostAutoSync", () => ({
	buildSelfMediaPostAutoSyncTaskData: mockBuildSelfMediaPostAutoSyncTaskData,
	saveSelfMediaPostAutoSyncTask: mockSaveSelfMediaPostAutoSyncTask,
	disableSelfMediaPostAutoSyncTask: mockDisableSelfMediaPostAutoSyncTask,
}))

vi.mock("../services/SelfMediaFileStorageService", () => ({
	SelfMediaFileStorageService: class MockSelfMediaFileStorageService {
		loadPostOpsSource = mockLoadPostOpsSource
		loadPostOpsMetrics = mockLoadPostOpsMetrics
		loadPostOpsComments = mockLoadPostOpsComments
		loadPostOpsReview = mockLoadPostOpsReview
		loadPostOpsReviewHtml = mockLoadPostOpsReviewHtml
		savePostOpsSource = mockSavePostOpsSource
	},
}))

vi.mock("@/stores/superMagic", () => ({
	topicModelStore: {
		selectedLanguageModel: mockLanguageModel,
	},
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModelGroupsByMode: () => [
			{
				group: { id: "group-1", name: "Models" },
				models: [mockLanguageModel],
			},
		],
		getModelListByMode: () => [mockLanguageModel],
	},
}))

vi.mock("../context/PlatformChromeContext", () => ({
	SelfMediaPlatformChromeProvider: function MockPlatformChromeProvider({
		children,
	}: {
		children: React.ReactNode
	}) {
		return <>{children}</>
	},
	useSelfMediaPlatformChrome: () => ({
		hostElement: document.createElement("div"),
	}),
}))

import SelfMediaRootRender from "../index"
import type { SelfMediaRootRenderProps } from "../types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

const ROOT_DATA = {
	file_id: "folder-1",
	file_name: "self-media",
} as SelfMediaRootRenderProps["data"]

const GENERATED_ATTACHMENT_LIST = [
	{
		file_id: "file-1",
	},
] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>

const POST_DIRECTORY_ATTACHMENT_LIST = [
	{
		file_id: "root",
		file_name: "self-media",
		relative_file_path: "",
		is_directory: true,
		children: [
			{
				file_id: "post-dir",
				file_name: "post-1",
				relative_file_path: "posts/post-1/",
				is_directory: true,
				children: [
					{
						file_id: "post-json",
						file_name: "post.json",
						relative_file_path: "posts/post-1/post.json",
					},
					{
						file_id: "card-file",
						file_name: "01.html",
						relative_file_path: "posts/post-1/cards/01.html",
					},
				],
			},
		],
	},
] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>

const POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST = [
	{
		file_id: "root",
		file_name: "self-media",
		relative_file_path: "",
		is_directory: true,
		children: [
			{
				file_id: "post-dir",
				file_name: "post-1",
				relative_file_path: "posts/post-1/",
				is_directory: true,
				children: [
					{
						file_id: "post-json",
						file_name: "post.json",
						relative_file_path: "posts/post-1/post.json",
					},
					{
						file_id: "card-file",
						file_name: "01.html",
						relative_file_path: "posts/post-1/cards/01.html",
					},
					{
						file_id: "source-json",
						file_name: "source.json",
						relative_file_path: "posts/post-1/ops/source.json",
					},
				],
			},
		],
	},
] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>

function withMockedCardWidth(width: number, run: () => void | Promise<void>) {
	const originalResizeObserver = globalThis.ResizeObserver
	const originalElementGetBoundingClientRect = Element.prototype.getBoundingClientRect
	const originalHTMLElementGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
	class MockResizeObserver {
		private readonly callback: ResizeObserverCallback

		constructor(callback: ResizeObserverCallback) {
			this.callback = callback
		}

		observe(target: Element) {
			this.callback(
				[
					{
						target,
						contentRect: { width },
					} as ResizeObserverEntry,
				],
				this as unknown as ResizeObserver,
			)
		}

		unobserve = vi.fn()
		disconnect = vi.fn()
	}
	vi.stubGlobal("ResizeObserver", MockResizeObserver)
	const getMockedBoundingClientRect = function getBoundingClientRect(this: Element) {
		if (
			this instanceof HTMLElement &&
			this.dataset.testid?.startsWith("self-media-home-post-card-")
		) {
			return {
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: width,
				bottom: 180,
				width,
				height: 180,
				toJSON: () => ({}),
			} as DOMRect
		}
		if (this instanceof HTMLElement) {
			return originalHTMLElementGetBoundingClientRect.call(this)
		}
		return originalElementGetBoundingClientRect.call(this)
	}
	Element.prototype.getBoundingClientRect = getMockedBoundingClientRect
	HTMLElement.prototype.getBoundingClientRect = getMockedBoundingClientRect

	return Promise.resolve(run()).finally(() => {
		Element.prototype.getBoundingClientRect = originalElementGetBoundingClientRect
		HTMLElement.prototype.getBoundingClientRect = originalHTMLElementGetBoundingClientRect
		if (originalResizeObserver) {
			vi.stubGlobal("ResizeObserver", originalResizeObserver)
		} else {
			vi.unstubAllGlobals()
		}
	})
}

describe("SelfMediaRootRender", () => {
	beforeEach(() => {
		localStorage.setItem("selfMediaSplashSeen", "true")
		mockStore.platforms = ["rednote"]
		mockStore.resolvedPlatform = "rednote"
		mockStore.rootLoading = false
		mockStore.sharedPostFallback = false
		mockStore.activePostIndex = 0
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post: {
					meta: {
						id: "post-1",
						title: "Post One",
						feedTitle: "Post One Feed",
						author: "Magic Lab",
						feedLikes: "1.2w",
						commentCount: "128",
						readCount: "3.6w",
						time: "2 hours ago",
						comments: [{ name: "Alice", text: "This makes the workflow concrete." }],
					},
					cards: [],
				},
			},
		]
		mockStore.posts = [
			{
				meta: {
					id: "post-1",
					title: "Post One",
					feedTitle: "Post One Feed",
					author: "Magic Lab",
					feedLikes: "1.2w",
					commentCount: "128",
					readCount: "3.6w",
					time: "2 hours ago",
					comments: [{ name: "Alice", text: "This makes the workflow concrete." }],
				},
				cards: [],
			},
		]
		mockStore.handleChangePlatform.mockReset()
		mockStore.openPostDetail.mockReset()
		mockStore.ensurePlatformPostLoaded.mockReset()
		mockStore.goHomeList.mockReset()
		mockStore.init.mockReset().mockResolvedValue(undefined)
		mockToastSuccess.mockReset()
		mockSendSelfMediaPrePublishAnalysis.mockReset()
		mockSendSelfMediaPostPublishDataRefresh.mockReset()
		mockBuildSelfMediaPostAutoSyncTaskData.mockReset().mockReturnValue({
			task_name: "[文章数据同步] Post One Feed",
			workspace_id: "workspace-1",
			project_id: "project-1",
			topic_id: "",
		})
		mockSaveSelfMediaPostAutoSyncTask.mockReset().mockResolvedValue("task-1")
		mockDisableSelfMediaPostAutoSyncTask.mockReset().mockResolvedValue(undefined)
		mockLoadPostOpsSource.mockReset().mockResolvedValue(null)
		mockLoadPostOpsMetrics.mockReset().mockResolvedValue(null)
		mockLoadPostOpsComments.mockReset().mockResolvedValue(null)
		mockLoadPostOpsReview.mockReset().mockResolvedValue(null)
		mockLoadPostOpsReviewHtml.mockReset().mockResolvedValue(null)
		mockSavePostOpsSource.mockReset().mockResolvedValue(undefined)
		mockToastError.mockReset()
		mockAICardCreateDialogRender.mockReset()
	})

	afterEach(() => {
		vi.unstubAllEnvs()
		localStorage.clear()
	})

	it("returns the splash screen before mounting the workspace on first visit", () => {
		vi.stubEnv("NODE_ENV", "production")
		localStorage.removeItem("selfMediaSplashSeen")

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("self-media-splash")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-page")).not.toBeInTheDocument()
		expect(screen.queryByTestId("self-media-root")).not.toBeInTheDocument()
	})

	it("shows the article home before opening platform detail", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("self-media-home-page")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-platform-component")).not.toBeInTheDocument()
		expect(screen.queryByTestId("self-media-platform-switcher")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("self-media-home-post-open-post-1"))

		expect(mockStore.handleChangePlatform).toHaveBeenCalledWith("rednote")
		expect(mockStore.openPostDetail).toHaveBeenCalledWith(0)
		expect(screen.getByTestId("mock-platform-component")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-platform-detail-stage")).toHaveClass(
			"self-media-platform-detail-stage",
		)
		expect(screen.queryByTestId("self-media-home-page")).not.toBeInTheDocument()
	})

	it("opens the platform detail directly for a standalone shared post", () => {
		mockStore.sharedPostFallback = true

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit={false}
			/>,
		)

		expect(screen.getByTestId("mock-platform-component")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-page")).not.toBeInTheDocument()
	})

	it("shows only the shared article list when multiple posts are shared without an index", () => {
		mockStore.sharedPostFallback = true
		mockStore.allPosts = [
			...mockStore.allPosts,
			{
				platform: "instagram",
				index: 0,
				entry: {
					id: "instagram-post",
					name: "Instagram Post",
					entry: "posts/instagram-post/post.json",
				},
				post: {
					meta: { id: "instagram-post", title: "Instagram Post" },
					cards: [],
				},
			},
		]

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit={false}
			/>,
		)

		expect(screen.getByTestId("self-media-home-page")).toBeInTheDocument()
		expect(screen.getByText("Instagram Post")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-platform-component")).not.toBeInTheDocument()
	})

	it("restores the article home scroll position after returning from a post editor", async () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		const getHomeViewport = () =>
			screen
				.getByTestId("self-media-home-page")
				.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement

		const viewport = getHomeViewport()
		viewport.scrollTop = 420
		fireEvent.scroll(viewport)

		fireEvent.click(screen.getByTestId("self-media-home-post-open-post-1"))
		expect(screen.queryByTestId("self-media-home-page")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Back to content" }))

		await waitFor(() => {
			expect(getHomeViewport().scrollTop).toBe(420)
		})
	})

	it("adds the article folder mention to the editor from the home context menu", async () => {
		const publishSpy = vi.spyOn(pubsub, "publish")

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Mention this article" }))

		await waitFor(() =>
			expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Add_File_To_Chat, {
				items: [
					{
						type: "project_directory",
						data: {
							directory_id: "post-dir",
							directory_name: "post-1",
							directory_path: "posts/post-1/",
							directory_metadata: {},
						},
					},
				],
				is_new_topic: false,
				autoFocus: true,
			}),
		)
		expect(mockToastSuccess).toHaveBeenCalledWith("Mention added to the input box")
	})

	it("shows articles from every platform on the article home", () => {
		mockStore.platforms = ["rednote", "instagram"]
		mockStore.resolvedPlatform = "rednote"
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "rednote-1", name: "Rednote One", entry: "posts/rednote-1/post.json" },
				post: {
					meta: { id: "rednote-1", title: "Rednote One", feedTitle: "Rednote One" },
					cards: [],
				},
			},
			{
				platform: "instagram",
				index: 0,
				entry: {
					id: "instagram-1",
					name: "Instagram One",
					entry: "posts/instagram-1/post.json",
				},
				post: {
					meta: {
						id: "instagram-1",
						title: "Instagram One",
						feedTitle: "Instagram One",
					},
					cards: [],
				},
			},
		]

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("self-media-home-platform-group-rednote")).toHaveTextContent(
			"RedNote",
		)
		expect(screen.getByTestId("self-media-home-platform-group-instagram")).toHaveTextContent(
			"Instagram",
		)
		expect(screen.getByTestId("self-media-home-post-open-rednote-1")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-open-instagram-1")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("self-media-home-post-open-instagram-1"))

		expect(mockStore.handleChangePlatform).toHaveBeenCalledWith("instagram")
		expect(mockStore.openPostDetail).toHaveBeenCalledWith(0)
	})

	it("uses platform-specific article previews on the article home", () => {
		mockStore.platforms = ["wechat-official-accounts", "rednote"]
		mockStore.resolvedPlatform = "wechat-official-accounts"
		mockStore.allPosts = [
			{
				platform: "wechat-official-accounts",
				index: 0,
				entry: { id: "wechat-1", name: "Wechat One", entry: "posts/wechat-1/post.json" },
				post: {
					meta: { id: "wechat-1", title: "Wechat One", feedTitle: "Wechat One" },
					cards: [],
					thumbnailCover: {
						path: "covers/wechat-thumb.png",
						fileId: "wechat-thumb-file",
					},
				},
			},
			{
				platform: "rednote",
				index: 0,
				entry: { id: "rednote-1", name: "Rednote One", entry: "posts/rednote-1/post.json" },
				post: {
					meta: { id: "rednote-1", title: "Rednote One", feedTitle: "Rednote One" },
					cards: [
						{
							path: "cards/card-1.html",
							fileId: "rednote-card-file",
							version: "v1",
						},
					],
				},
			},
		]

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("self-media-home-cover-preview-wechat-1")).toHaveAttribute(
			"src",
			"https://example.test/wechat-thumb-file.png",
		)
		expect(screen.getByTestId("self-media-home-card-preview-rednote-1")).toContainElement(
			screen.getByTestId("mock-card-frame"),
		)
		expect(screen.getByTestId("mock-card-frame")).toHaveAttribute(
			"data-file-id",
			"rednote-card-file",
		)
		expect(screen.getByTestId("mock-card-frame")).toHaveAttribute("data-version", "v1")
		expect(
			screen.queryByTestId("self-media-home-icon-fallback-wechat-1"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-icon-fallback-rednote-1"),
		).not.toBeInTheDocument()
	})

	it("loads platform posts on the article home before preview assets are available", () => {
		mockStore.platforms = ["wechat-official-accounts", "rednote"]
		mockStore.resolvedPlatform = "rednote"
		mockStore.allPosts = [
			{
				platform: "wechat-official-accounts",
				index: 0,
				entry: { id: "wechat-1", name: "Wechat One", entry: "posts/wechat-1/post.json" },
				post: {
					meta: { id: "wechat-1", title: "Wechat One", feedTitle: "Wechat One" },
					cards: [],
				},
			},
			{
				platform: "rednote",
				index: 0,
				entry: { id: "rednote-1", name: "Rednote One", entry: "posts/rednote-1/post.json" },
				post: {
					meta: { id: "rednote-1", title: "Rednote One", feedTitle: "Rednote One" },
					cards: [],
				},
			},
		]

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={[]}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(mockStore.ensurePlatformPostLoaded).toHaveBeenCalledWith(
			"wechat-official-accounts",
			0,
		)
		expect(mockStore.ensurePlatformPostLoaded).toHaveBeenCalledWith("rednote", 0)
	})

	it("opens pre-publish analysis from the article home and sends with the selected goal", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-analysis-post-1"))

		expect(screen.getByTestId("pre-publish-analysis-dialog")).toBeInTheDocument()
		expect(screen.getByTestId("pre-publish-analysis-selected-model")).toHaveTextContent("GPT-5")

		fireEvent.click(screen.getByText("confirm-analysis"))

		await waitFor(() => {
			expect(mockSendSelfMediaPrePublishAnalysis).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedProject: { id: "project-1" },
					platform: "rednote",
					analysisGoal: "conversion",
					selectedModel: mockLanguageModel,
					post,
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
						is_directory: true,
					}),
				}),
			)
		})
		expect(mockToastError).not.toHaveBeenCalled()
	})

	it("opens pre-publish analysis from the platform footer action", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-open-post-1"))
		fireEvent.click(screen.getByTestId("self-media-footer-pre-publish-analysis"))
		fireEvent.click(screen.getByText("confirm-analysis"))

		await waitFor(() => {
			expect(mockSendSelfMediaPrePublishAnalysis).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedProject: { id: "project-1" },
					platform: "rednote",
					analysisGoal: "conversion",
					selectedModel: mockLanguageModel,
					post,
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
						is_directory: true,
					}),
				}),
			)
		})
	})

	it("does not show the home pre-publish analysis entry in read-only mode", () => {
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post: {
					meta: { id: "post-1", title: "Post One" },
					cards: [{ path: "cards/01.html", fileId: "card-file" }],
				},
			},
		]

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit={false}
			/>,
		)

		expect(screen.queryByTestId("self-media-home-post-analysis-post-1")).not.toBeInTheDocument()
	})

	it("does not show the platform footer pre-publish analysis entry in read-only mode", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit={false}
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-open-post-1"))

		expect(
			screen.queryByTestId("self-media-footer-pre-publish-analysis"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("self-media-shell-inspector-button")).not.toBeInTheDocument()
	})

	it("starts analysis from the post manifest entry when the content file id is missing", async () => {
		const post = {
			meta: { id: "post-1", title: "Post One" },
			cards: [{ path: "cards/01.html", fileId: "missing-card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-analysis-post-1"))
		fireEvent.click(screen.getByText("confirm-analysis"))

		await waitFor(() => {
			expect(mockSendSelfMediaPrePublishAnalysis).toHaveBeenCalledWith(
				expect.objectContaining({
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
				}),
			)
		})
		expect(mockToastError).not.toHaveBeenCalled()
	})

	it("shows the concrete service failure reason when pre-publish analysis fails", async () => {
		const post = {
			meta: { id: "post-1", title: "Post One" },
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockSendSelfMediaPrePublishAnalysis.mockRejectedValueOnce(new Error("No project selected"))

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-analysis-post-1"))
		fireEvent.click(screen.getByText("confirm-analysis"))

		await waitFor(() => {
			expect(mockToastError).toHaveBeenCalledWith(
				"Failed to start pre-publish diagnosis: Current project information is missing. Refresh the page and try again.",
			)
		})
	})

	it("opens brand config from the article home", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-brand-config-button"))

		expect(screen.getByTestId("self-media-brand-config-dialog")).toBeInTheDocument()
	})

	it("refreshes all self-media data from the home header", async () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-refresh-all-data-button"))

		await waitFor(() => {
			expect(mockStore.init).toHaveBeenCalledWith({ preserveNavigation: true })
		})
	})

	it("does not expose the data overview dialog from an article card", async () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		expect(
			await screen.findByTestId("self-media-home-post-data-popover-post-1"),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-data-overview-post-1"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("self-media-ops-metrics-dialog")).not.toBeInTheDocument()
	})

	it("animates only the matching ops artifact icon when its target file appears or updates", async () => {
		const withCardVersion = (version: string) => {
			const next = JSON.parse(
				JSON.stringify(POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST),
			) as typeof POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST
			const postDir = next[0].children?.[0]
			const card = postDir?.children?.find((node) => node.file_id === "card-file")
			if (card) card.updated_at = version
			return next
		}
		const withMetricsVersion = (version: string) => {
			const next = withCardVersion(`card-${version}`)
			const postDir = next[0].children?.[0]
			postDir?.children?.push({
				file_id: "metrics-json",
				file_name: "metrics.json",
				relative_file_path: "posts/post-1/ops/metrics.json",
				updated_at: version,
			})
			return next
		}

		const { rerender } = render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		rerender(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={withCardVersion("card-v2")}
				attachmentList={withCardVersion("card-v2")}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		await waitFor(() => {
			expect(
				screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics"),
			).toHaveAttribute("data-ready", "false")
		})
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics"),
		).not.toHaveAttribute("data-animation")

		rerender(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={withMetricsVersion("metrics-v1")}
				attachmentList={withMetricsVersion("metrics-v1")}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		await waitFor(() => {
			expect(
				screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics"),
			).toHaveAttribute("data-animation", "created")
		})
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-confetti-post-1-metrics"),
		).toBeInTheDocument()

		rerender(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={withMetricsVersion("metrics-v2")}
				attachmentList={withMetricsVersion("metrics-v2")}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		await waitFor(() => {
			const metrics = screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics")
			expect(metrics).toHaveAttribute("data-animation", "updated")
			expect(metrics).toHaveClass("animate-bounce")
		})
	})

	it("shows action button labels when the article card is wide enough", async () => {
		await withMockedCardWidth(720, async () => {
			render(
				<SelfMediaRootRender
					data={ROOT_DATA}
					attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
					attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
					selectedProject={{ id: "project-1" }}
					allowEdit
				/>,
			)

			await waitFor(() => {
				expect(screen.getByTestId("self-media-home-post-actions-post-1")).toHaveAttribute(
					"data-label-mode",
					"expanded",
				)
			})
			expect(screen.getByTestId("self-media-home-post-analysis-post-1")).toHaveTextContent(
				"Diagnose",
			)
			expect(
				screen.queryByTestId("self-media-home-post-bind-link-post-1"),
			).not.toBeInTheDocument()
			expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toHaveTextContent(
				"Sync",
			)
			expect(
				screen.queryByTestId("self-media-home-post-publish-ingest-post-1"),
			).not.toBeInTheDocument()
			expect(screen.getByTestId("self-media-home-post-review-card-post-1")).toHaveTextContent(
				"Review",
			)
		})
	})

	it("opens the published link panel from the bound link status icon", async () => {
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(
			screen.queryByTestId("self-media-home-post-bind-link-post-1"),
		).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"))

		expect(
			await screen.findByTestId("self-media-home-post-bind-link-popover-post-1"),
		).toBeInTheDocument()
		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-post-bind-link-input-post-1")).toHaveValue(
				"https://www.xiaohongshu.com/explore/post-1",
			)
		})
	})

	it("shows a loading state while the published link panel reads the saved link", async () => {
		mockLoadPostOpsSource.mockImplementation(() => new Promise(() => undefined))

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"))

		expect(
			await screen.findByTestId("self-media-home-post-bind-link-loading-post-1"),
		).toHaveTextContent("Loading link...")
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-input-post-1"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-save-post-1"),
		).not.toBeInTheDocument()
	})

	it("collapses action button labels when the article card is narrow", async () => {
		await withMockedCardWidth(320, async () => {
			render(
				<SelfMediaRootRender
					data={ROOT_DATA}
					attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
					attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
					selectedProject={{ id: "project-1" }}
					allowEdit
				/>,
			)

			await waitFor(() => {
				expect(screen.getByTestId("self-media-home-post-actions-post-1")).toHaveAttribute(
					"data-label-mode",
					"compact",
				)
			})
			expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toHaveTextContent("")
			expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toHaveAttribute(
				"aria-label",
				"Sync",
			)
			expect(
				screen.queryByTestId("self-media-home-post-publish-ingest-post-1"),
			).not.toBeInTheDocument()
		})
	})

	it("shows the published link binding action before post-publish operations are available", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("self-media-home-post-bind-link-post-1")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-analysis-post-1")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-post-ops-data-post-1")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-publish-ingest-post-1"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-review-card-post-1"),
		).not.toBeInTheDocument()
	})

	it("uses a saved published link as source-ready when the attachment tree has not refreshed", async () => {
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-22T10:00:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/already-bound",
			fetchStatus: "pending",
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		await waitFor(() =>
			expect(mockLoadPostOpsSource).toHaveBeenCalledWith("posts/post-1/post.json"),
		)
		await waitFor(() => {
			expect(screen.queryByText("绑定已发布链接")).not.toBeInTheDocument()
		})
		expect(screen.getByText("同步最新数据")).toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-post-1"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toBeInTheDocument()
	})

	it("keeps action labels visible when only the diagnosis and link binding actions fit", async () => {
		await withMockedCardWidth(360, async () => {
			render(
				<SelfMediaRootRender
					data={ROOT_DATA}
					attachments={POST_DIRECTORY_ATTACHMENT_LIST}
					attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
					selectedProject={{ id: "project-1" }}
					allowEdit
				/>,
			)

			await waitFor(() => {
				expect(screen.getByTestId("self-media-home-post-actions-post-1")).toHaveAttribute(
					"data-label-mode",
					"expanded",
				)
			})
			expect(screen.getByTestId("self-media-home-post-analysis-post-1")).toHaveTextContent(
				"Diagnose",
			)
			expect(screen.getByTestId("self-media-home-post-bind-link-post-1")).toHaveTextContent(
				"Add link",
			)
		})
	})

	it("binds the published link from the article card without starting a fetch topic", async () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-post-1"))
		fireEvent.change(await screen.findByTestId("self-media-home-post-bind-link-input-post-1"), {
			target: { value: "https://www.xiaohongshu.com/explore/bound-post-1" },
		})
		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-save-post-1"))

		await waitFor(() => {
			expect(mockSavePostOpsSource).toHaveBeenCalledWith("posts/post-1/post.json", {
				version: 1,
				updatedAt: expect.any(String),
				platform: "rednote",
				publishedUrl: "https://www.xiaohongshu.com/explore/bound-post-1",
				fetchStatus: "pending",
			})
		})
		expect(mockSendSelfMediaPostPublishDataRefresh).not.toHaveBeenCalled()
		expect(
			await screen.findByTestId("self-media-home-post-ops-data-post-1"),
		).toBeInTheDocument()
	})

	it("uses the freshly bound published link when syncing from the article card", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-post-1"))
		fireEvent.change(await screen.findByTestId("self-media-home-post-bind-link-input-post-1"), {
			target: { value: "https://www.xiaohongshu.com/explore/fresh-bound-post-1" },
		})
		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-save-post-1"))

		await waitFor(() => {
			expect(mockSavePostOpsSource).toHaveBeenCalledWith(
				"posts/post-1/post.json",
				expect.objectContaining({
					publishedUrl: "https://www.xiaohongshu.com/explore/fresh-bound-post-1",
				}),
			)
		})
		mockLoadPostOpsSource.mockClear()
		mockLoadPostOpsSource.mockResolvedValue(null)

		fireEvent.click(await screen.findByTestId("self-media-home-post-ops-data-post-1"))

		await waitFor(() => {
			expect(mockSendSelfMediaPostPublishDataRefresh).toHaveBeenCalledWith(
				expect.objectContaining({
					publishedUrl: "https://www.xiaohongshu.com/explore/fresh-bound-post-1",
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
				}),
			)
		})
		expect(mockLoadPostOpsSource).not.toHaveBeenCalled()
		expect(mockToastError).not.toHaveBeenCalledWith(
			"Please bind the published article URL first.",
		)
	})

	it("updates the existing auto sync task when changing the published link", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/old-post-1",
			fetchStatus: "pending",
			autoSync: {
				enabled: true,
				taskId: "task-1",
				timeConfig: {
					type: "weekly_repeat",
					time: "10:30",
					day: "2",
				},
			},
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"))
		fireEvent.change(await screen.findByTestId("self-media-home-post-bind-link-input-post-1"), {
			target: { value: "https://www.xiaohongshu.com/explore/new-post-1" },
		})
		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-save-post-1"))

		await waitFor(() => {
			expect(mockBuildSelfMediaPostAutoSyncTaskData).toHaveBeenCalledWith(
				expect.objectContaining({
					workspaceId: "workspace-1",
					projectId: "project-1",
					platform: "rednote",
					publishedUrl: "https://www.xiaohongshu.com/explore/new-post-1",
					post,
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
					model: mockLanguageModel,
					timeConfig: {
						type: "weekly_repeat",
						time: "10:30",
						day: "2",
					},
					taskId: "task-1",
				}),
			)
		})
		expect(mockSaveSelfMediaPostAutoSyncTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_name: "[文章数据同步] Post One Feed",
			}),
			"task-1",
		)
	})

	it("does not save the changed published link when updating the existing auto sync task fails", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/old-post-1",
			fetchStatus: "pending",
			autoSync: {
				enabled: true,
				taskId: "task-1",
				timeConfig: {
					type: "weekly_repeat",
					time: "10:30",
					day: "2",
				},
			},
		})
		mockSaveSelfMediaPostAutoSyncTask.mockRejectedValueOnce(new Error("update failed"))

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"))
		fireEvent.change(await screen.findByTestId("self-media-home-post-bind-link-input-post-1"), {
			target: { value: "https://www.xiaohongshu.com/explore/new-post-1" },
		})
		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-save-post-1"))

		await waitFor(() => {
			expect(mockToastError).toHaveBeenCalledWith("Failed to start data sync: update failed")
		})
		expect(consoleError).toHaveBeenCalledWith(
			"Self-media auto sync published URL update failed:",
			expect.any(Error),
		)
		expect(mockSavePostOpsSource).not.toHaveBeenCalled()
		expect(
			screen.getByTestId("self-media-home-post-bind-link-popover-post-1"),
		).toBeInTheDocument()
		expect(mockSendSelfMediaPostPublishDataRefresh).not.toHaveBeenCalled()
		consoleError.mockRestore()
	})

	it("requires a non-empty published link before starting publish ingest", async () => {
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "   ",
			fetchStatus: "pending",
		})
		const attachmentList = [
			{
				file_id: "root",
				file_name: "self-media",
				relative_file_path: "",
				is_directory: true,
				children: [
					{
						file_id: "post-dir",
						file_name: "post-1",
						relative_file_path: "posts/post-1/",
						is_directory: true,
						children: [
							{
								file_id: "source-json",
								file_name: "source.json",
								relative_file_path: "posts/post-1/ops/source.json",
							},
						],
					},
				],
			},
		] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={attachmentList}
				attachmentList={attachmentList}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		await waitFor(() => {
			expect(mockLoadPostOpsSource).toHaveBeenCalledWith("posts/post-1/post.json")
		})
		expect(mockSendSelfMediaPostPublishDataRefresh).not.toHaveBeenCalled()
		expect(mockToastError).toHaveBeenCalledWith("Please bind the published article URL first.")
	})

	it("binds the published link and starts publish ingest from the article card", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-post-1"))
		fireEvent.change(await screen.findByTestId("self-media-home-post-bind-link-input-post-1"), {
			target: { value: "https://www.xiaohongshu.com/explore/bound-and-fetch-post-1" },
		})
		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-fetch-post-1"))

		await waitFor(() => {
			expect(mockSavePostOpsSource).toHaveBeenCalledWith("posts/post-1/post.json", {
				version: 1,
				updatedAt: expect.any(String),
				platform: "rednote",
				publishedUrl: "https://www.xiaohongshu.com/explore/bound-and-fetch-post-1",
				fetchStatus: "pending",
			})
		})
		await waitFor(() => {
			expect(mockSendSelfMediaPostPublishDataRefresh).toHaveBeenCalledWith(
				expect.objectContaining({
					publishedUrl: "https://www.xiaohongshu.com/explore/bound-and-fetch-post-1",
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
				}),
			)
		})
	})

	it("starts publish ingest when the published link has been bound", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
		})
		const attachmentList = [
			{
				file_id: "root",
				file_name: "self-media",
				relative_file_path: "",
				is_directory: true,
				children: [
					{
						file_id: "post-dir",
						file_name: "post-1",
						relative_file_path: "posts/post-1/",
						is_directory: true,
						children: [
							{
								file_id: "post-json",
								file_name: "post.json",
								relative_file_path: "posts/post-1/post.json",
							},
							{
								file_id: "card-file",
								file_name: "01.html",
								relative_file_path: "posts/post-1/cards/01.html",
							},
							{
								file_id: "source-json",
								file_name: "source.json",
								relative_file_path: "posts/post-1/ops/source.json",
							},
						],
					},
				],
			},
		] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={attachmentList}
				attachmentList={attachmentList}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		await waitFor(() => {
			expect(mockSendSelfMediaPostPublishDataRefresh).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedProject: { id: "project-1" },
					platform: "rednote",
					selectedModel: mockLanguageModel,
					publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
				}),
			)
		})
		expect(screen.queryByTestId("self-media-ops-metrics-dialog")).not.toBeInTheDocument()
	})

	it("starts publish ingest from the post manifest entry when the content file id is missing", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "missing-card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		await waitFor(() => {
			expect(mockSendSelfMediaPostPublishDataRefresh).toHaveBeenCalledWith(
				expect.objectContaining({
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
				}),
			)
		})
		expect(mockToastError).not.toHaveBeenCalled()
	})

	it("shows the concrete service failure reason when publish data sync fails", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
		})
		mockSendSelfMediaPostPublishDataRefresh.mockRejectedValueOnce(
			new Error("No project selected"),
		)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		await waitFor(() => {
			expect(mockToastError).toHaveBeenCalledWith(
				"Failed to start data sync: Current project information is missing. Refresh the page and try again.",
			)
		})
	})

	it("configures post auto sync from the data popover", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))
		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).toHaveValue("0")
		fireEvent.change(screen.getByTestId("self-media-home-post-auto-sync-enabled-post-1"), {
			target: { value: "1" },
		})
		fireEvent.change(
			await screen.findByTestId("self-media-home-post-auto-sync-frequency-post-1"),
			{ target: { value: "weekly_repeat" } },
		)
		fireEvent.change(screen.getByTestId("self-media-home-post-auto-sync-time-post-1"), {
			target: { value: "10:30" },
		})
		fireEvent.change(await screen.findByTestId("self-media-home-post-auto-sync-day-post-1"), {
			target: { value: "2" },
		})
		fireEvent.click(screen.getByTestId("self-media-home-post-auto-sync-save-post-1"))

		await waitFor(() => {
			expect(mockBuildSelfMediaPostAutoSyncTaskData).toHaveBeenCalledWith(
				expect.objectContaining({
					workspaceId: "workspace-1",
					projectId: "project-1",
					platform: "rednote",
					publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
					post,
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
					model: mockLanguageModel,
					timeConfig: {
						type: "weekly_repeat",
						time: "10:30",
						day: "2",
					},
				}),
			)
		})
		expect(mockSaveSelfMediaPostAutoSyncTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_name: "[文章数据同步] Post One Feed",
			}),
			undefined,
		)
		expect(mockSavePostOpsSource).toHaveBeenCalledWith(
			"posts/post-1/post.json",
			expect.objectContaining({
				publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
				autoSync: expect.objectContaining({
					enabled: true,
					taskId: "task-1",
					timeConfig: {
						type: "weekly_repeat",
						time: "10:30",
						day: "2",
					},
				}),
			}),
		)
	})

	it("shows the existing auto sync configuration in the data popover", async () => {
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
			autoSync: {
				enabled: false,
				taskId: "task-1",
				timeConfig: {
					type: "monthly_repeat",
					time: "10:30",
					day: "15",
				},
			},
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).toHaveValue("0")
		expect(screen.getByTestId("self-media-home-post-auto-sync-frequency-post-1")).toHaveValue(
			"monthly_repeat",
		)
		expect(screen.getByTestId("self-media-home-post-auto-sync-time-post-1")).toHaveValue(
			"10:30",
		)
		expect(await screen.findByTestId("self-media-home-post-auto-sync-day-post-1")).toHaveValue(
			"15",
		)
	})

	it("keeps auto sync save disabled while the existing configuration is loading", async () => {
		mockLoadPostOpsSource.mockImplementation(() => new Promise(() => undefined))

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-loading-post-1"),
		).toHaveTextContent("Loading auto sync")
		expect(
			screen.queryByTestId("self-media-home-post-auto-sync-save-post-1"),
		).not.toBeInTheDocument()
	})

	it("does not mark auto sync disabled locally when the scheduled task cannot be disabled", async () => {
		const sourceOnlyAttachmentList = [
			{
				file_id: "source-json",
				file_name: "source.json",
				relative_file_path: "posts/post-1/ops/source.json",
			},
		] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "pending",
			autoSync: {
				enabled: true,
				taskId: "task-1",
				timeConfig: {
					type: "daily_repeat",
					time: "09:00",
				},
			},
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={sourceOnlyAttachmentList}
				attachmentList={sourceOnlyAttachmentList}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))
		fireEvent.change(
			await screen.findByTestId("self-media-home-post-auto-sync-enabled-post-1"),
			{ target: { value: "0" } },
		)
		fireEvent.click(screen.getByTestId("self-media-home-post-auto-sync-save-post-1"))

		await waitFor(() => {
			expect(mockToastError).toHaveBeenCalledWith(
				"Failed to start data sync: Project or workspace information is missing. Refresh the page and try again.",
			)
		})
		expect(mockDisableSelfMediaPostAutoSyncTask).not.toHaveBeenCalled()
		expect(mockSavePostOpsSource).not.toHaveBeenCalledWith(
			"posts/post-1/post.json",
			expect.objectContaining({
				autoSync: expect.objectContaining({
					enabled: false,
				}),
			}),
		)
		expect(screen.getByTestId("self-media-home-post-data-popover-post-1")).toBeInTheDocument()
	})

	it("starts publish ingest from the operations workspace fetch button", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-review-card-post-1"))
		fireEvent.click(await screen.findByTestId("self-media-ops-review-edit"))
		const fetchButton = await screen.findByTestId("self-media-ops-dialog-fetch")
		mockLoadPostOpsSource.mockClear()
		fireEvent.click(fetchButton)

		await waitFor(() => {
			expect(mockSendSelfMediaPostPublishDataRefresh).toHaveBeenCalledWith(
				expect.objectContaining({
					publishedUrl: "https://www.xiaohongshu.com/explore/dialog-post-1",
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
				}),
			)
		})
		expect(mockLoadPostOpsSource).not.toHaveBeenCalled()
	})

	it("updates the existing auto sync task when changing the published link from the ops review editor", async () => {
		const post = {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
				author: "Magic Lab",
			},
			cards: [{ path: "cards/01.html", fileId: "card-file" }],
		}
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post,
			},
		]
		mockStore.ensurePlatformPostLoaded.mockResolvedValue(post)
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/old-post-1",
			fetchStatus: "pending",
			autoSync: {
				enabled: true,
				taskId: "task-1",
				timeConfig: {
					type: "weekly_repeat",
					time: "10:30",
					day: "2",
				},
			},
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1", workspace_id: "workspace-1" } as never}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-review-card-post-1"))
		fireEvent.click(await screen.findByTestId("self-media-ops-review-edit"))
		fireEvent.click(await screen.findByTestId("self-media-ops-dialog-update-auto-sync-link"))

		await waitFor(() => {
			expect(mockBuildSelfMediaPostAutoSyncTaskData).toHaveBeenCalledWith(
				expect.objectContaining({
					workspaceId: "workspace-1",
					projectId: "project-1",
					platform: "rednote",
					publishedUrl: "https://www.xiaohongshu.com/explore/new-post-1",
					post,
					postDirectoryItem: expect.objectContaining({
						file_id: "post-dir",
						relative_file_path: "posts/post-1/",
					}),
					model: mockLanguageModel,
					timeConfig: {
						type: "weekly_repeat",
						time: "10:30",
						day: "2",
					},
					taskId: "task-1",
				}),
			)
		})
		expect(mockSaveSelfMediaPostAutoSyncTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_name: "[文章数据同步] Post One Feed",
			}),
			"task-1",
		)
	})

	it("shows file-backed operations loop status on the article home", async () => {
		const attachmentList = [
			{
				file_id: "root",
				file_name: "self-media",
				relative_file_path: "",
				is_directory: true,
				children: [
					{
						file_id: "post-dir",
						file_name: "post-1",
						relative_file_path: "posts/post-1/",
						is_directory: true,
						children: [
							{
								file_id: "source-json",
								file_name: "source.json",
								relative_file_path: "posts/post-1/ops/source.json",
							},
							{
								file_id: "metrics-json",
								file_name: "metrics.json",
								relative_file_path: "posts/post-1/ops/metrics.json",
							},
							{
								file_id: "review-md",
								file_name: "review.md",
								relative_file_path: "posts/post-1/ops/review.md",
							},
						],
					},
				],
			},
		] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={attachmentList}
				attachmentList={attachmentList}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveTextContent("今日重点信号")
		expect(screen.getByTestId("self-media-home-ops-health")).toHaveTextContent("75")
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("总阅读")
		expect(screen.getByTestId("self-media-home-ops-total-engagement")).toHaveTextContent(
			"总互动",
		)
		expect(screen.getByTestId("self-media-home-ops-engagement-rate")).toHaveTextContent(
			"平均互动率",
		)
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent("已发布1/1")
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent("已同步1/1")
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent(
			"评论已处理0/1",
		)
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent(
			"复盘已完成1/1",
		)
		expect(
			screen.getByTestId("self-media-home-post-ops-artifacts-post-1"),
		).not.toHaveTextContent(/Link bound|Metrics ready|Feedback not organized|Review ready/)
		expect(screen.queryByText("Link bound")).not.toBeInTheDocument()
		expect(screen.queryByText("Metrics ready")).not.toBeInTheDocument()
		expect(screen.queryByText("Feedback not organized")).not.toBeInTheDocument()
		expect(screen.queryByText("Review ready")).not.toBeInTheDocument()
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"),
		).toHaveAttribute("data-ready", "true")
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics"),
		).toHaveAttribute("data-ready", "true")
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-comments"),
		).toHaveAttribute("data-ready", "false")
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-review"),
		).toHaveAttribute("data-ready", "true")
		await waitFor(() =>
			expect(mockLoadPostOpsMetrics).toHaveBeenCalledWith("posts/post-1/post.json"),
		)
	})

	it("shows file-backed post engagement metrics on the article home", async () => {
		const attachmentList = [
			{
				file_id: "root",
				file_name: "self-media",
				relative_file_path: "",
				is_directory: true,
				children: [
					{
						file_id: "post-dir",
						file_name: "post-1",
						relative_file_path: "posts/post-1/",
						is_directory: true,
						children: [
							{
								file_id: "post-json",
								file_name: "post.json",
								relative_file_path: "posts/post-1/post.json",
							},
							{
								file_id: "metrics-json",
								file_name: "metrics.json",
								relative_file_path: "posts/post-1/ops/metrics.json",
							},
						],
					},
				],
			},
		] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>
		mockStore.allPosts = [
			{
				platform: "rednote",
				index: 0,
				entry: { id: "post-1", name: "Post One", entry: "posts/post-1/post.json" },
				post: {
					meta: {
						id: "post-1",
						title: "Post One",
						feedTitle: "Post One Feed",
						author: "Magic Lab",
					},
					cards: [],
				},
			},
		]
		mockStore.posts = [
			{
				meta: {
					id: "post-1",
					title: "Post One",
					feedTitle: "Post One Feed",
					author: "Magic Lab",
				},
				cards: [],
			},
		]
		mockLoadPostOpsMetrics.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:10:00.000Z",
			source: "real-platform",
			metrics: {
				reads: "838",
				likes: "41",
				comments: "1",
			},
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={attachmentList}
				attachmentList={attachmentList}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		const engagement = await screen.findByTestId("self-media-home-post-engagement-post-1")
		expect(engagement).toHaveTextContent("Reads 838")
		expect(engagement).toHaveTextContent("Likes 41")
		expect(engagement).toHaveTextContent("Comments 1")
		expect(mockLoadPostOpsMetrics).toHaveBeenCalledWith("posts/post-1/post.json")
	})

	it("shows file-backed engagement metrics when the attachment tree is stale", async () => {
		mockLoadPostOpsMetrics.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:10:00.000Z",
			source: "real-platform",
			metrics: {
				reads: "916",
				likes: "52",
				comments: "3",
			},
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={[]}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		const engagement = await screen.findByTestId("self-media-home-post-engagement-post-1")
		await waitFor(() => expect(engagement).toHaveTextContent("Reads 916"))
		expect(engagement).toHaveTextContent("Likes 52")
		expect(engagement).toHaveTextContent("Comments 3")
		expect(mockLoadPostOpsMetrics).toHaveBeenCalledWith("posts/post-1/post.json")
		expect(screen.queryByText("绑定已发布链接")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-post-1"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-lifecycle-post-1")).toHaveAttribute(
			"data-lifecycle",
			"synced",
		)
		expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toBeInTheDocument()
	})

	it("does not fall back to post meta engagement when ops metrics are missing", async () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={[]}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		await waitFor(() =>
			expect(mockLoadPostOpsMetrics).toHaveBeenCalledWith("posts/post-1/post.json"),
		)
		expect(
			screen.queryByTestId("self-media-home-post-engagement-post-1"),
		).not.toBeInTheDocument()
	})

	it("does not render the create article action in the platform header", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={[]}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-open-post-1"))

		expect(screen.queryByTestId("self-media-create-article")).not.toBeInTheDocument()
	})

	it("opens the init panel from the article home and can go back", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={[]}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-create-button"))

		expect(screen.getByTestId("mock-self-media-init-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-page")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Back to content" }))

		expect(screen.getByTestId("self-media-home-page")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-self-media-init-panel")).not.toBeInTheDocument()
	})

	it("keeps the generic AI card creator in the article home toolbar", () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(
			screen.queryByTestId("self-media-home-post-engagement-post-1"),
		).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("self-media-home-ai-card-button"))

		expect(screen.getByTestId("self-media-ai-card-create-dialog")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-ai-card-create-task-name")).toHaveTextContent("")
		expect(screen.getByTestId("self-media-ai-card-create-prompt")).toHaveTextContent("")
	})

	it("expands a post card into an operations review dashboard backed by ops files", async () => {
		mockLoadPostOpsSource.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:05:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "fetched",
			lastFetchedAt: "2026-06-11T08:10:00.000Z",
			history: [
				{
					fetchedAt: "2026-06-10T08:10:00.000Z",
					fetchStatus: "fetched",
					publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
				},
				{
					fetchedAt: "2026-06-11T08:10:00.000Z",
					fetchStatus: "fetched",
					publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
				},
			],
		})
		mockLoadPostOpsMetrics.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:10:00.000Z",
			source: "real-platform",
			metrics: {
				reads: "838",
				likes: "41",
				shares: "33",
				saves: "2",
				comments: "1",
			},
			derivedMetrics: {
				engagementRate: "9.19%",
				shareRate: "3.94%",
			},
			history: [
				{
					fetchedAt: "2026-06-10T08:10:00.000Z",
					metrics: {
						reads: "812",
						shares: "30",
					},
				},
				{
					fetchedAt: "2026-06-11T08:10:00.000Z",
					metrics: {
						reads: "838",
						shares: "33",
					},
				},
			],
		})
		mockLoadPostOpsComments.mockResolvedValue({
			version: 1,
			updatedAt: "2026-06-11T08:10:00.000Z",
			source: "real-platform",
			summary: "读者主要关注编辑效率和可协作性。",
			comments: [
				{
					id: "comment-1",
					author: "Alice",
					text: "这个交互很适合改局部细节。",
					intent: "positive-feedback",
				},
			],
		})
		mockLoadPostOpsReviewHtml.mockResolvedValue({
			content: "<!doctype html><html><body><h1>运营复盘报告</h1></body></html>",
		})

		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-review-card-post-1"))

		expect(await screen.findByTestId("self-media-ops-review-dashboard")).toHaveTextContent(
			"Operations review",
		)
		expect(screen.getByTestId("self-media-ops-review-sync")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-ops-review-edit")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-ops-review-kpis")).toHaveTextContent("838")
		expect(screen.getByTestId("self-media-ops-review-kpis")).toHaveTextContent("9.19%")
		expect(screen.getByTestId("self-media-ops-review-trend")).toHaveTextContent("26")
		expect(screen.getByTestId("self-media-ops-review-comments")).toHaveTextContent(
			"读者主要关注编辑效率和可协作性。",
		)
		expect(screen.getByTestId("self-media-ops-review-html-renderer")).toHaveAttribute(
			"data-relative-file-path",
			"posts/post-1/ops/",
		)

		fireEvent.click(screen.getByTestId("self-media-ops-review-close"))

		await waitFor(() => {
			expect(screen.queryByTestId("self-media-ops-review-dashboard")).not.toBeInTheDocument()
		})
	})

	it("keeps operations data visible but hides editing actions in read-only mode", async () => {
		render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit={false}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-main-column")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-ops-side-column")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("self-media-home-post-review-card-post-1"))

		await screen.findByTestId("self-media-ops-review-dashboard")
		expect(screen.queryByTestId("self-media-ops-review-sync")).not.toBeInTheDocument()
		expect(screen.queryByTestId("self-media-ops-review-edit")).not.toBeInTheDocument()
	})

	it("closes the operations editor when editing permission is removed", async () => {
		const { rerender } = render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-review-card-post-1"))
		fireEvent.click(await screen.findByTestId("self-media-ops-review-edit"))
		expect(await screen.findByTestId("self-media-ops-metrics-dialog")).toBeInTheDocument()

		rerender(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				attachmentList={POST_DIRECTORY_WITH_SOURCE_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit={false}
			/>,
		)

		await waitFor(() => {
			expect(screen.queryByTestId("self-media-ops-metrics-dialog")).not.toBeInTheDocument()
		})
	})

	it("reloads the open operations review when its backing ops files update", async () => {
		const withReviewVersion = (version: string) =>
			[
				{
					file_id: "root",
					file_name: "self-media",
					relative_file_path: "",
					is_directory: true,
					children: [
						{
							file_id: "post-dir",
							file_name: "post-1",
							relative_file_path: "posts/post-1/",
							is_directory: true,
							children: [
								{
									file_id: "post-json",
									file_name: "post.json",
									relative_file_path: "posts/post-1/post.json",
								},
								{
									file_id: "card-file",
									file_name: "01.html",
									relative_file_path: "posts/post-1/cards/01.html",
								},
								{
									file_id: "source-json",
									file_name: "source.json",
									relative_file_path: "posts/post-1/ops/source.json",
									updated_at: "source-v1",
								},
								{
									file_id: "review-html",
									file_name: "review.html",
									relative_file_path: "posts/post-1/ops/review.html",
									updated_at: version,
								},
							],
						},
					],
				},
			] as NonNullable<SelfMediaRootRenderProps["attachmentList"]>
		const v1Attachments = withReviewVersion("review-v1")
		const v2Attachments = withReviewVersion("review-v2")
		mockLoadPostOpsReviewHtml
			.mockResolvedValueOnce({
				content: "<!doctype html><html><body><h1>旧复盘</h1></body></html>",
			})
			.mockResolvedValueOnce({
				content: "<!doctype html><html><body><h1>新复盘</h1></body></html>",
			})

		const { rerender } = render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={v1Attachments}
				attachmentList={v1Attachments}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-review-card-post-1"))

		expect(await screen.findByTestId("self-media-ops-review-html-renderer")).toHaveTextContent(
			"旧复盘",
		)

		rerender(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={v2Attachments}
				attachmentList={v2Attachments}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		await waitFor(() => {
			expect(mockLoadPostOpsReviewHtml).toHaveBeenCalledTimes(2)
		})
		expect(screen.getByTestId("self-media-ops-review-html-renderer")).toHaveTextContent(
			"新复盘",
		)
	})

	it("keeps the init panel mounted when generated posts arrive", () => {
		mockStore.platforms = []
		mockStore.resolvedPlatform = null
		mockStore.posts = []

		const { rerender } = render(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={[]}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("mock-self-media-init-panel")).toBeInTheDocument()

		mockStore.platforms = ["rednote"]
		mockStore.resolvedPlatform = "rednote"
		mockStore.posts = [
			{
				meta: { id: "post-1", title: "Post One", feedTitle: "Post One Feed" },
				cards: [],
			},
		]

		rerender(
			<SelfMediaRootRender
				data={ROOT_DATA}
				attachments={[]}
				attachmentList={GENERATED_ATTACHMENT_LIST}
				selectedProject={{ id: "project-1" }}
				allowEdit
			/>,
		)

		expect(screen.getByTestId("mock-self-media-init-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-page")).not.toBeInTheDocument()
	})
})
