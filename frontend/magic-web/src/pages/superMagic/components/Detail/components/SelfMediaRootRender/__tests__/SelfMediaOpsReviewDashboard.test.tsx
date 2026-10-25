import {
	fireEvent,
	render,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import enUS from "@/assets/locales/en_US/super.json"
import zhCN from "@/assets/locales/zh_CN/super.json"
import SelfMediaOpsReviewDashboard from "../components/SelfMediaOpsReviewDashboard"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"

const mockHtmlRendererProps = vi.hoisted(() => vi.fn())

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", async () => {
	const React = await vi.importActual<typeof import("react")>("react")
	return {
		default: React.forwardRef(function MockIsolatedHTMLRenderer(
			props: Record<string, unknown>,
			ref,
		) {
			void ref
			mockHtmlRendererProps(props)
			return React.createElement("div", {
				"data-testid": "self-media-ops-review-html-renderer",
				"data-relative-file-path": props.htmlRelativeFolderPath,
			})
		}),
	}
})

vi.mock("@/components/tiptap-templates/simple/simple-editor", async () => {
	const React = await vi.importActual<typeof import("react")>("react")
	const renderMarkdown = (content: string) =>
		content
			.split(/\n+/)
			.filter(Boolean)
			.map((line, index) => {
				if (line.startsWith("# ")) {
					return React.createElement("h1", { key: index }, line.slice(2))
				}
				if (line.startsWith("- ")) {
					return React.createElement("li", { key: index }, line.slice(2))
				}
				const boldMatch = line.match(/^\*\*(.+?)\*\*：(.+)$/)
				if (boldMatch) {
					return React.createElement(
						"p",
						{ key: index },
						React.createElement("strong", null, boldMatch[1]),
						`：${boldMatch[2]}`,
					)
				}
				return React.createElement("p", { key: index }, line)
			})

	return {
		SimpleEditor: React.forwardRef(({ content }: { content?: string }, _ref) =>
			React.createElement(
				"div",
				{ "data-testid": "simple-editor-markdown-preview" },
				renderMarkdown(content ?? ""),
			),
		),
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			(
				({
					"detail.selfMedia.common.untitledPost": "Untitled",
					"detail.selfMedia.opsMetrics.fields.reads": "Reads",
					"detail.selfMedia.opsMetrics.fields.likes": "Likes",
					"detail.selfMedia.opsMetrics.fields.saves": "Saves",
					"detail.selfMedia.opsMetrics.fields.comments": "Comments",
					"detail.selfMedia.opsMetrics.fields.shares": "Shares",
					"detail.selfMedia.opsMetrics.loading": "Loading",
					"detail.selfMedia.opsReview.actionsTitle": "Next actions",
					"detail.selfMedia.opsReview.close": "Close review",
					"detail.selfMedia.opsReview.commentsTitle": "Audience signals",
					"detail.selfMedia.opsReview.conversionSignal": "Conversion signal",
					"detail.selfMedia.opsReview.deltaReads": "Reads change",
					"detail.selfMedia.opsReview.edit": "Edit data",
					"detail.selfMedia.opsReview.empty": "No data yet",
					"detail.selfMedia.opsReview.engagementRate": "Engagement rate",
					"detail.selfMedia.opsReview.exitFullscreen": "Exit fullscreen",
					"detail.selfMedia.opsReview.funnelTitle": "Traffic efficiency",
					"detail.selfMedia.opsReview.fullscreen": "Fullscreen",
					"detail.selfMedia.opsReview.impactTitle": "Impact map",
					"detail.selfMedia.opsReview.markdownTitle": "Markdown review report",
					"detail.selfMedia.opsReview.qualityTitle": "Quality mix",
					"detail.selfMedia.opsReview.refreshReport": "Refresh report",
					"detail.selfMedia.opsReview.reviewHtmlTitle": "HTML review report",
					"detail.selfMedia.opsReview.reviewTitle": "Review report",
					"detail.selfMedia.opsReview.sourceStatus.fetched": "Fetched",
					"detail.selfMedia.opsReview.sourceStatus.pending": "Pending",
					"detail.selfMedia.opsReview.sourceStatus.failed": "Failed",
					"detail.selfMedia.opsReview.sourceStatus.unknown": "Not fetched",
					"detail.selfMedia.opsReview.summaryTitle": "Review summary",
					"detail.selfMedia.opsReview.summaryTrendEmpty":
						"Sync data twice or more to build the reading trend.",
					"detail.selfMedia.opsReview.summaryTrendTitle": "Reading trend",
					"detail.selfMedia.opsReview.sync": "Sync data",
					"detail.selfMedia.opsReview.title": "Operations review",
					"detail.selfMedia.opsReview.trendTitle": "Sync trend",
				}) as Record<string, string>
			)[key] ?? key,
	}),
}))

describe("SelfMediaOpsReviewDashboard", () => {
	it("shows sync and edit actions when editing is allowed", async () => {
		const onSyncData = vi.fn()
		const onEditData = vi.fn()
		const target = buildTarget()

		render(
			<SelfMediaOpsReviewDashboard
				open
				target={target}
				allowEdit
				onClose={vi.fn()}
				onSyncData={onSyncData}
				onEditData={onEditData}
				onLoadData={async () => buildOpsReviewData()}
			/>,
		)

		fireEvent.click(await screen.findByTestId("self-media-ops-review-sync"))
		fireEvent.click(screen.getByTestId("self-media-ops-review-edit"))

		await waitFor(() => expect(onSyncData).toHaveBeenCalledWith(target))
		expect(onEditData).toHaveBeenCalledWith(target)
	})

	it("hides sync and edit actions in read-only mode", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				allowEdit={false}
				onClose={vi.fn()}
				onSyncData={vi.fn()}
				onEditData={vi.fn()}
				onLoadData={async () => buildOpsReviewData()}
			/>,
		)

		await screen.findByTestId("self-media-ops-review-dashboard")

		expect(screen.queryByTestId("self-media-ops-review-sync")).not.toBeInTheDocument()
		expect(screen.queryByTestId("self-media-ops-review-edit")).not.toBeInTheDocument()
	})

	it("renders a single-post case review dashboard with warm workspace styling", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => buildOpsReviewData()}
			/>,
		)

		expect(await screen.findByTestId("self-media-ops-review-dashboard")).toHaveAttribute(
			"data-palette",
			"case-review",
		)
		expect(screen.getByTestId("self-media-ops-review-case-summary")).toHaveTextContent(
			"Review summary",
		)
		expect(screen.getByTestId("self-media-ops-review-summary-trend")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-ops-review-summary-trend-chart")).toHaveClass(
			"focus:outline-none",
			"focus-visible:outline-none",
		)
		expect(screen.getByTestId("self-media-ops-review-kpis")).toHaveTextContent("12.8%")
		expect(screen.getByTestId("self-media-ops-review-impact-map")).toHaveTextContent(
			"Impact map",
		)
		expect(screen.getByTestId("self-media-ops-review-efficiency-funnel")).toHaveTextContent(
			"Traffic efficiency",
		)
		expect(screen.getByTestId("self-media-ops-review-quality-mix")).toHaveTextContent(
			"Quality mix",
		)
		expect(screen.getByTestId("self-media-ops-review-next-actions")).toHaveTextContent(
			"把教程场景拆成团队协作案例",
		)
		expect(screen.getByTestId("self-media-ops-review-trend")).toHaveTextContent("Sync trend")
		expect(screen.getByTestId("self-media-ops-review-trend-chart")).toHaveClass("h-52")
	})

	it("frames the review as a single-post case review workspace", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => buildOpsReviewData()}
			/>,
		)

		expect(await screen.findByTestId("self-media-ops-review-dashboard")).toHaveAttribute(
			"data-palette",
			"case-review",
		)
		expect(screen.getByTestId("self-media-ops-review-case-summary")).toHaveTextContent(
			"Review summary",
		)
		expect(
			within(screen.getByTestId("self-media-ops-review-case-summary")).queryByText(
				"Post One Feed",
			),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-ops-review-next-actions")).toHaveTextContent(
			"Next actions",
		)
		expect(screen.getByTestId("self-media-ops-review-comment-signals")).toHaveTextContent(
			"Audience signals",
		)
		expect(screen.getByTestId("self-media-ops-review-report-preview")).toHaveTextContent(
			"Review report",
		)
	})

	it("enters as an immersive bottom sheet over the home workspace", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => buildOpsReviewData()}
			/>,
		)

		expect(await screen.findByTestId("self-media-ops-review-backdrop")).toHaveClass(
			"items-end",
			"backdrop-blur-[2px]",
		)
		expect(screen.getByTestId("self-media-ops-review-dashboard")).toHaveAttribute(
			"data-motion-origin",
			"bottom",
		)
		expect(screen.getByTestId("self-media-ops-review-dashboard")).toHaveClass(
			"rounded-t-[32px]",
			"bg-white",
			"backdrop-blur-xl",
		)
		expect(screen.getByTestId("self-media-ops-review-content")).toHaveClass(
			"bg-[linear-gradient(180deg,#ffffff_0%,#f8f8f9_42%,#f1f0eb_100%)]",
		)
	})

	it("renders review.html through the shared HTML preview runtime", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => ({
					...buildOpsReviewData(),
					reviewHtml: {
						content:
							"<html><body><button data-action='send-next-step'>发送下一步</button></body></html>",
					},
				})}
			/>,
		)

		const reportSection = (
			await screen.findByRole("heading", { name: "Review report" })
		).closest("section")
		expect(reportSection).toHaveClass("rounded-lg")
		expect(reportSection).toHaveClass("border")
		expect(reportSection).toHaveClass("shadow-xs")

		const renderer = await screen.findByTestId("self-media-ops-review-html-renderer")
		expect(renderer).toHaveAttribute("data-relative-file-path", "posts/post-1/ops/")
		expect(screen.queryByTestId("self-media-ops-review-html-frame")).not.toBeInTheDocument()
		expect(mockHtmlRendererProps).toHaveBeenCalledWith(
			expect.objectContaining({
				content:
					"<html><body><button data-action='send-next-step'>发送下一步</button></body></html>",
				htmlRelativeFolderPath: "posts/post-1/ops/",
				disableDynamicResourceInterception: true,
				containIframeOverscroll: true,
			}),
		)
	})

	it("opens and exits fullscreen preview from the report card header", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => ({
					...buildOpsReviewData(),
					reviewHtml: {
						content: "<html><body><main>Fullscreen Review</main></body></html>",
					},
				})}
			/>,
		)

		fireEvent.click(await screen.findByTestId("self-media-ops-review-fullscreen"))

		const fullscreen = screen.getByTestId("self-media-ops-review-fullscreen-overlay")
		expect(fullscreen.parentElement).toBe(document.body)
		expect(fullscreen).toHaveTextContent("Review report")
		expect(
			within(fullscreen).getByTestId("self-media-ops-review-html-preview"),
		).toBeInTheDocument()

		fireEvent.click(within(fullscreen).getByTestId("self-media-ops-review-exit-fullscreen"))

		await waitForElementToBeRemoved(() =>
			screen.queryByTestId("self-media-ops-review-fullscreen-overlay"),
		)
	})

	it("refreshes the review report file content from the report card header", async () => {
		const onLoadData = vi
			.fn()
			.mockResolvedValueOnce({
				...buildOpsReviewData(),
				reviewHtml: {
					content: "<html><body><main>Old Review</main></body></html>",
				},
			})
			.mockResolvedValueOnce({
				...buildOpsReviewData(),
				reviewHtml: {
					content: "<html><body><main>Fresh Review</main></body></html>",
				},
			})

		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={onLoadData}
			/>,
		)

		await screen.findByTestId("self-media-ops-review-html-renderer")
		const reportSection = screen
			.getByRole("heading", { name: "Review report" })
			.closest("section")
		const refreshButton = await screen.findByTestId("self-media-ops-review-refresh")
		const fullscreenButton = screen.getByTestId("self-media-ops-review-fullscreen")
		expect(reportSection).not.toBeNull()
		const reportButtons = within(reportSection as HTMLElement).getAllByRole("button")
		expect(reportButtons.indexOf(refreshButton)).toBeLessThan(
			reportButtons.indexOf(fullscreenButton),
		)

		fireEvent.click(refreshButton)

		await waitFor(() => {
			expect(onLoadData).toHaveBeenCalledTimes(2)
			expect(mockHtmlRendererProps).toHaveBeenLastCalledWith(
				expect.objectContaining({
					content: "<html><body><main>Fresh Review</main></body></html>",
				}),
			)
		})
	})

	it("exits fullscreen preview when Escape is pressed", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => ({
					...buildOpsReviewData(),
					reviewHtml: {
						content: "<html><body><main>Keyboard Review</main></body></html>",
					},
				})}
			/>,
		)

		fireEvent.click(await screen.findByTestId("self-media-ops-review-fullscreen"))

		expect(screen.getByTestId("self-media-ops-review-fullscreen-overlay")).toBeInTheDocument()

		fireEvent.keyDown(document, { key: "Escape" })

		await waitForElementToBeRemoved(() =>
			screen.queryByTestId("self-media-ops-review-fullscreen-overlay"),
		)
	})

	it("uses flexible layout primitives when space is constrained", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => ({
					...buildOpsReviewData(),
					reviewHtml: {
						content: "<html><body><main>Review</main></body></html>",
					},
				})}
			/>,
		)

		expect(await screen.findByTestId("self-media-ops-review-content")).toHaveClass(
			"px-3",
			"sm:px-6",
		)
		expect(screen.getByTestId("self-media-ops-review-brief")).toHaveClass(
			"lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]",
		)
		expect(screen.getByTestId("self-media-ops-review-chart-grid")).toHaveClass(
			"xl:grid-cols-2",
			"2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)_minmax(260px,0.72fr)]",
		)
		expect(screen.getByTestId("self-media-ops-review-quality-mix")).toHaveClass(
			"xl:col-span-2",
			"2xl:col-span-1",
		)
		expect(screen.getByTestId("self-media-ops-review-html-preview")).toHaveClass(
			"h-[min(560px,calc(100vh-220px))]",
			"min-h-[320px]",
		)
	})

	it("renders legacy review.md as a real markdown preview", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => ({
					...buildOpsReviewData(),
					reviewHtml: null,
					reviewMarkdown: {
						content:
							"# 复盘结论\n\n- 第一条：标题钩子有效\n- 第二条：补团队协作案例\n\n**下一步**：做评论区追问。",
					},
				})}
			/>,
		)

		const preview = await screen.findByTestId("self-media-ops-review-markdown-preview")
		expect(preview).toHaveClass("max-h-[560px]")
		expect(preview).toHaveClass("overflow-auto")
		expect(within(preview).getByTestId("simple-editor-markdown-preview")).toBeInTheDocument()
		expect(within(preview).getByRole("heading", { name: "复盘结论" })).toBeInTheDocument()
		expect(within(preview).getByText("第一条：标题钩子有效")).toBeInTheDocument()
		expect(within(preview).getByText("下一步")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-ops-review-markdown")).not.toBeInTheDocument()
	})

	it("keeps source status labels localized and falls back for unsupported status values", async () => {
		render(
			<SelfMediaOpsReviewDashboard
				open
				target={buildTarget()}
				onClose={vi.fn()}
				onLoadData={async () => ({
					...buildOpsReviewData(),
					source: {
						...buildOpsReviewData().source,
						fetchStatus: "queued" as never,
					},
				})}
			/>,
		)

		await screen.findByText("Not fetched")
		expect(
			screen.queryByText("detail.selfMedia.opsReview.sourceStatus.queued"),
		).not.toBeInTheDocument()
	})

	it("defines localized copy for self-media init, title edit, and ops review states", () => {
		const expectedLocales = {
			"detail.selfMedia.initPanel.nav.stepShortBrand": ["定位", "Brand"],
			"detail.selfMedia.initPanel.nav.stepShortConfirm": ["确认", "Confirm"],
			"detail.selfMedia.initPanel.nav.stepShortTopics": ["选题", "Topics"],
			"detail.selfMedia.initPanel.stepBrand.collapse": [
				"收起品牌信息",
				"Collapse brand info",
			],
			"detail.selfMedia.initPanel.stepBrand.expand": ["展开品牌信息", "Expand brand info"],
			"detail.selfMedia.initPanel.stepBrand.profileSection": ["账号档案", "Account profile"],
			"detail.selfMedia.initPanel.stepBrand.profileSectionHint": [
				"配置 AI 生成内容时默认使用的身份、定位与受众。",
				"Configure the identity, positioning, and audience AI uses by default.",
			],
			"detail.selfMedia.initPanel.stepBrand.saveSuccess": ["保存成功", "Saved"],
			"detail.selfMedia.initPanel.stepConfirm.articleUnit": ["篇文章", "articles"],
			"detail.selfMedia.initPanel.stepConfirm.modelSettingsHint": [
				"默认即可，也可以在开始前微调。",
				"Defaults are fine, or tune them before starting.",
			],
			"detail.selfMedia.initPanel.stepConfirm.modelSettingsTitle": [
				"生成设置",
				"Generation settings",
			],
			"detail.selfMedia.initPanel.stepDetail.cardCountReduceConfirm": [
				"减少卡片数量将移除末尾已有内容的卡片，是否确认？",
				"Reducing the card count removes filled cards at the end. Continue?",
			],
			"detail.selfMedia.initPanel.stepDetail.folderLabel": ["归档文件夹", "Archive folder"],
			"detail.selfMedia.initPanel.stepTopic.generating": ["策划中", "Planning"],
			"detail.selfMedia.initPanel.stepTopic.generatingStep1": [
				"深度思考领域特征...",
				"Thinking through the domain...",
			],
			"detail.selfMedia.initPanel.stepTopic.generatingStep2": [
				"挖掘爆款选题角度...",
				"Finding high-potential angles...",
			],
			"detail.selfMedia.initPanel.stepTopic.generatingStep3": [
				"构思核心大纲框架...",
				"Drafting the core outline...",
			],
			"detail.selfMedia.initPanel.stepTopic.generatingStep4": [
				"打磨最终输出细节...",
				"Polishing the final details...",
			],
			"detail.selfMedia.initPanel.stepTopic.ready": ["待策划", "Ready"],
			"detail.selfMedia.titleEdit.cancel": ["取消编辑", "Cancel editing"],
			"detail.selfMedia.titleEdit.edit": ["编辑标题", "Edit title"],
			"detail.selfMedia.titleEdit.empty": ["标题不能为空", "Title cannot be empty"],
			"detail.selfMedia.titleEdit.failed": [
				"标题保存失败，请稍后重试",
				"Failed to save the title. Please try again later.",
			],
			"detail.selfMedia.titleEdit.input": ["文章标题", "Article title"],
			"detail.selfMedia.titleEdit.save": ["保存标题", "Save title"],
			"detail.selfMedia.opsReview.sourceStatus.partial": [
				"部分数据已同步",
				"Partially synced",
			],
		} satisfies Record<string, [string, string]>

		for (const [key, [zhValue, enValue]] of Object.entries(expectedLocales)) {
			expect(getLocaleValue(zhCN, key)).toBe(zhValue)
			expect(getLocaleValue(enUS, key)).toBe(enValue)
		}
		expect(getLocaleValue(zhCN, "detail.selfMedia.opsReview.sourceStatus.completed")).toBe(
			"已完成",
		)
		expect(getLocaleValue(enUS, "detail.selfMedia.opsReview.sourceStatus.completed")).toBe(
			"Completed",
		)
		expect(getLocaleValue(zhCN, "detail.selfMedia.opsReview.sourceStatus.success")).toBe(
			"已完成",
		)
		expect(getLocaleValue(enUS, "detail.selfMedia.opsReview.sourceStatus.success")).toBe(
			"Completed",
		)
		expect(getLocaleValue(zhCN, "detail.selfMedia.opsReview.fullscreen")).toBe("全屏预览")
		expect(getLocaleValue(enUS, "detail.selfMedia.opsReview.fullscreen")).toBe("Fullscreen")
		expect(getLocaleValue(zhCN, "detail.selfMedia.opsReview.refreshReport")).toBe("刷新报告")
		expect(getLocaleValue(enUS, "detail.selfMedia.opsReview.refreshReport")).toBe(
			"Refresh report",
		)
		expect(getLocaleValue(zhCN, "detail.selfMedia.opsReview.exitFullscreen")).toBe("退出全屏")
		expect(getLocaleValue(enUS, "detail.selfMedia.opsReview.exitFullscreen")).toBe(
			"Exit fullscreen",
		)
		expect(getLocaleValue(zhCN, "detail.selfMedia.opsReview.summaryTitle")).toBe("复盘摘要")
		expect(getLocaleValue(enUS, "detail.selfMedia.opsReview.summaryTitle")).toBe(
			"Review summary",
		)
	})
})

function getLocaleValue(messages: unknown, key: string) {
	return key.split(".").reduce<unknown>((current, segment) => {
		if (!current || typeof current !== "object") return undefined
		return (current as Record<string, unknown>)[segment]
	}, messages)
}

function buildTarget(): SelfMediaPlatformPostItem {
	return {
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
	} as SelfMediaPlatformPostItem
}

function buildOpsReviewData() {
	return {
		source: {
			version: 1,
			updatedAt: "2026-06-12T08:00:00.000Z",
			platform: "rednote",
			publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
			fetchStatus: "fetched" as const,
			lastFetchedAt: "2026-06-12T08:00:00.000Z",
		},
		metrics: {
			version: 1,
			updatedAt: "2026-06-12T08:00:00.000Z",
			source: "real-platform" as const,
			metrics: {
				reads: "1280",
				likes: "96",
				saves: "42",
				comments: "18",
				shares: "22",
			},
			derivedMetrics: {
				engagementRate: "12.8%",
				saveRate: "3.3%",
				shareRate: "1.7%",
			},
			history: [
				{
					fetchedAt: "2026-06-10T08:00:00.000Z",
					metrics: { reads: "820", likes: "41", saves: "12", shares: "8" },
				},
				{
					fetchedAt: "2026-06-11T08:00:00.000Z",
					metrics: { reads: "1040", likes: "70", saves: "27", shares: "16" },
				},
				{
					fetchedAt: "2026-06-12T08:00:00.000Z",
					metrics: { reads: "1280", likes: "96", saves: "42", shares: "22" },
				},
			],
		},
		comments: {
			version: 1,
			updatedAt: "2026-06-12T08:00:00.000Z",
			source: "real-platform" as const,
			summary: "评论集中在团队协作、模板复用和是否支持多人编辑。",
			comments: [
				{
					id: "c1",
					author: "Alice",
					text: "这个能不能多人一起维护？",
					intent: "购买咨询",
					sentiment: "question" as const,
				},
				{
					id: "c2",
					author: "Bob",
					text: "想看真实团队案例。",
					intent: "选题建议",
					sentiment: "positive" as const,
				},
			],
			insights: ["把教程场景拆成团队协作案例", "评论区追问是否需要模板包"],
		},
		reviewHtml: null,
		reviewMarkdown: null,
	}
}
