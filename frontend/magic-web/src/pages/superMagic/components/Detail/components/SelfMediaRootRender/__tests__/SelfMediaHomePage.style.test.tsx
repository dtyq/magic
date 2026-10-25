import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SelfMediaHomePage from "../components/SelfMediaHomePage"
import SelfMediaOpsOverviewCard from "../components/SelfMediaOpsOverviewCard"
import { getSelfMediaHomeInsightDateKey } from "../services/selfMediaHomeInsight"
import type { SelfMediaPostOpsMetricsPayload } from "../services/SelfMediaFileStorageService"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type { SelfMediaAttachmentNode } from "../types"

const mocks = vi.hoisted(() => ({
	userInfo: {
		nickname: "测试用户",
		real_name: "测试用户",
	},
	chat: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en" },
		t: (key: string, options?: Record<string, unknown>) =>
			({
				"detail.selfMedia.home.articleCount": `${options?.count ?? 0} articles`,
				"detail.selfMedia.home.create": "Create",
				"detail.selfMedia.refreshAllData": "Refresh all data",
			})[key] || key,
	}),
}))

vi.mock("@/models/user/hooks/useUserInfo", () => ({
	useUserInfo: () => ({
		userInfo: mocks.userInfo,
	}),
}))

vi.mock("@/services/ai", () => ({
	aiLLMService: {
		chat: mocks.chat,
	},
}))

vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div className={className}>{children}</div>
	),
}))

vi.mock("../components/SelfMediaPostCard", () => ({
	default: ({
		onOpenPost,
		opening,
		openingDimmed,
		openingStyle,
		publishedLinkAutoOpenSignal,
	}: {
		onOpenPost: (
			target: { platform: "rednote"; index: number },
			transition?: {
				rect: { left: number; top: number; width: number; height: number }
				title: string
				subtitle: string
				postId: string
			},
		) => void
		opening?: boolean
		openingDimmed?: boolean
		openingStyle?: React.CSSProperties
		publishedLinkAutoOpenSignal?: number
	}) => (
		<button
			type="button"
			data-testid="mock-self-media-post-card"
			data-opening={opening ? "true" : "false"}
			data-dimmed={openingDimmed ? "true" : "false"}
			data-published-link-auto-open-signal={publishedLinkAutoOpenSignal ?? ""}
			style={openingStyle}
			onClick={() =>
				onOpenPost(
					{ platform: "rednote", index: 0 },
					{
						rect: { left: 24, top: 144, width: 320, height: 160 },
						title: "Post One Feed",
						subtitle: "Post subtitle",
						postId: "post-1",
					},
				)
			}
		>
			Open post
		</button>
	),
}))

vi.mock("../components/SelfMediaOpsReviewDashboard", () => ({
	default: () => <div data-testid="mock-self-media-ops-review-dashboard" />,
}))

vi.mock("../components/PlatformBrandIcon", () => ({
	default: () => <span data-testid="mock-platform-brand-icon" />,
}))

vi.mock("../components/CardFrame", () => ({
	default: () => <div data-testid="mock-card-frame" />,
}))

function createPostItem(): SelfMediaPlatformPostItem {
	return {
		platform: "rednote",
		index: 0,
		entry: {
			id: "post-1",
			name: "Post One",
			entry: "posts/post-1/post.json",
		},
		post: {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
			},
			cards: [],
		},
	}
}

function createOpsAttachments(metricsVersion = "metrics-v1"): SelfMediaAttachmentNode[] {
	return [
		{
			file_id: "source-json",
			file_name: "source.json",
			relative_file_path: "posts/post-1/ops/source.json",
			updated_at: "source-v1",
		},
		{
			file_id: "metrics-json",
			file_name: "metrics.json",
			relative_file_path: "posts/post-1/ops/metrics.json",
			updated_at: metricsVersion,
		},
	]
}

function createOpsMetrics(): SelfMediaPostOpsMetricsPayload {
	return {
		version: 1,
		updatedAt: "2026-06-14T10:00:00.000Z",
		source: "real-platform",
		metrics: {
			reads: 2400,
			likes: 180,
			comments: 32,
			saves: 48,
			shares: 20,
		},
	}
}

describe("SelfMediaHomePage styles", () => {
	afterEach(() => {
		vi.useRealTimers()
		mocks.chat.mockReset()
		Reflect.deleteProperty(document, "startViewTransition")
	})

	it("hides published-data summary before any article is published", () => {
		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={vi.fn()} />)

		expect(screen.getByTestId("self-media-home-header")).toHaveTextContent(
			"今日重点：绑定发布链接",
		)
		expect(screen.getByTestId("self-media-home-header")).toHaveTextContent(
			"按优先级推进发布、数据和复盘，先把今日重点往前推。",
		)
		expect(
			screen.getAllByText("先绑定已发布链接，系统才能同步真实阅读、互动和评论数据。"),
		).toHaveLength(1)
		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveTextContent("继续处理")
		expect(screen.queryByTestId("self-media-home-ops-data-summary")).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent("已发布")
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent(
			"发布 / 数据 / 评论 / 复盘",
		)
		expect(screen.getByTestId("self-media-home-ops-completion")).toHaveTextContent("0/1")
		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveClass(
			"min-w-0",
			"max-w-full",
		)
		expect(screen.getByTestId("self-media-home-ops-health")).toHaveClass("w-full")
	})

	it("renders the article list before the operations overview", () => {
		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={vi.fn()} />)

		const postList = screen.getByTestId("self-media-home-post-list")
		const opsOverview = screen.getByTestId("self-media-home-ops-overview")

		expect(
			postList.compareDocumentPosition(opsOverview) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it("lets the compact home header actions adapt to the available width", () => {
		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				onOpenPost={vi.fn()}
				onCreateArticle={vi.fn()}
			/>,
		)

		const createButton = screen.getByTestId("self-media-home-create-button")
		expect(createButton.className).not.toContain("min-w-[9rem]")
		expect(createButton.className).toContain("min-w-0")
		expect(createButton.querySelector("span")).toHaveClass("truncate")
	})

	it("adds a refresh-all-data action beside brand settings in the home header", () => {
		const refreshAllData = vi.fn()

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				onOpenPost={vi.fn()}
				onOpenBrandConfig={vi.fn()}
				onRefreshAllData={refreshAllData}
			/>,
		)

		expect(screen.getByTestId("self-media-home-brand-config-button")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("self-media-home-refresh-all-data-button"))

		expect(refreshAllData).toHaveBeenCalledTimes(1)
	})

	it("retries loading ops metrics when the storage loader becomes available after the first empty read", async () => {
		const firstLoadOpsMetrics = vi.fn().mockResolvedValue(null)
		const secondLoadOpsMetrics = vi.fn().mockResolvedValue(createOpsMetrics())
		const post = createPostItem()
		const { rerender } = render(
			<SelfMediaHomePage
				posts={[post]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				onLoadOpsMetrics={firstLoadOpsMetrics}
			/>,
		)

		await waitFor(() => {
			expect(firstLoadOpsMetrics).toHaveBeenCalledTimes(1)
		})
		expect(screen.getByTestId("self-media-home-ops-data-summary")).toHaveTextContent(
			"已同步 1/1",
		)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("0")

		rerender(
			<SelfMediaHomePage
				posts={[post]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				onLoadOpsMetrics={secondLoadOpsMetrics}
			/>,
		)

		await waitFor(() => {
			expect(secondLoadOpsMetrics).toHaveBeenCalledTimes(1)
		})

		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("2.4k")
			expect(screen.getByTestId("self-media-home-ops-total-engagement")).toHaveTextContent(
				"280",
			)
			expect(screen.getByTestId("self-media-home-ops-engagement-rate")).toHaveTextContent(
				"11.7%",
			)
		})
	})

	it("uses the wide ops overview layout once the card reaches the near-max width", () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 900,
				bottom: 420,
				width: 900,
				height: 420,
				toJSON: () => ({}),
			})

		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={vi.fn()} />)

		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveAttribute(
			"data-ops-layout",
			"wide",
		)

		getBoundingClientRect.mockRestore()
	})

	it("keeps the spacious single-column layout compact", () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 800,
				bottom: 420,
				width: 800,
				height: 420,
				toJSON: () => ({}),
			})

		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={vi.fn()} />)

		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveAttribute(
			"data-ops-layout",
			"spacious",
		)
		expect(screen.getByTestId("self-media-home-ops-content")).toHaveClass("p-5", "gap-5")
		expect(screen.getByTestId("self-media-home-ops-health")).toHaveClass("w-[108px]")
		expect(screen.getByTestId("self-media-home-ops-completion").lastElementChild).toHaveClass(
			"grid-cols-2",
		)

		getBoundingClientRect.mockRestore()
	})

	it("keeps the wide suggestion panel pinned to the measured left column height", async () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 900,
				bottom: 420,
				width: 900,
				height: 420,
				toJSON: () => ({}),
			})

		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 2,
					totalReads: 0,
					totalEngagement: 0,
					engagementRate: null,
					operationStage: "closed",
					opportunityCount: 1,
					completion: {
						source: { done: 2, total: 2 },
						metrics: { done: 2, total: 2 },
						comments: { done: 2, total: 2 },
						review: { done: 2, total: 2 },
					},
					engagementTotals: {
						likes: 0,
						comments: 0,
						saves: 0,
						shares: 0,
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [
						{
							key: "plan-next-post",
							title: "规划下一篇内容",
							description: "当前运营链路已闭环，可以基于复盘结论继续生成新选题。",
							cta: "新建文章",
							priority: 70,
						},
					],
				}}
				onRegenerateDailyInsight={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveAttribute(
			"data-ops-layout",
			"wide",
		)
		expect(screen.getByTestId("self-media-home-ops-content")).toHaveClass("items-start")
		expect(screen.getByTestId("self-media-home-ops-main-column")).not.toHaveClass("h-full")
		expect(screen.getByTestId("self-media-home-ops-data-summary")).toHaveClass("flex-1")
		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-ops-side-column")).toHaveStyle({
				height: "420px",
			})
		})
		expect(screen.getByTestId("self-media-home-ops-aside")).toHaveClass("flex-1")

		getBoundingClientRect.mockRestore()
	})

	it("lets the wide suggestion list fill the stretched side panel beside the data and progress cards", () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 900,
				bottom: 420,
				width: 900,
				height: 420,
				toJSON: () => ({}),
			})

		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 4,
					totalReads: 0,
					totalEngagement: 0,
					engagementRate: null,
					operationStage: "syncing",
					completion: {
						source: { done: 2, total: 4 },
						metrics: { done: 0, total: 4 },
						comments: { done: 0, total: 4 },
						review: { done: 0, total: 4 },
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [
						{
							key: "bind-source",
							postKey: "rednote:0:posts/post-1/post.json",
							targetTitle: "AI大模型成本对比：用开源模型一年...",
							title: "绑定已发布链接",
							description:
								"这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
							cta: "去绑定",
							priority: 10,
						},
						{
							key: "bind-source",
							postKey: "rednote:0:posts/post-2/post.json",
							targetTitle: "AI大模型成本对比：用开源模型一年...",
							title: "绑定已发布链接",
							description:
								"这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
							cta: "去绑定",
							priority: 10,
						},
					],
				}}
			/>,
		)

		const actionList = screen.getByTestId("self-media-home-ops-next-actions")
		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveAttribute(
			"data-ops-layout",
			"wide",
		)
		expect(screen.getByTestId("self-media-home-ops-data-summary")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-ops-completion")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-ops-aside")).toHaveClass("flex", "min-h-0")
		expect(actionList).toHaveClass("self-media-ops-action-scroll")
		expect(actionList).toHaveClass("flex-1", "min-h-0")
		expect(actionList).not.toHaveStyle({ maxHeight: "163px" })
		expect(actionList).toHaveStyle({ minHeight: "163px" })
		expect(screen.getByTestId("self-media-home-ops-content")).toHaveClass("p-5", "gap-5")
		expect(screen.getByTestId("self-media-home-ops-data-summary")).toHaveClass("p-3")
		expect(screen.getByTestId("self-media-home-ops-completion").lastElementChild).toHaveClass(
			"grid-cols-2",
		)

		getBoundingClientRect.mockRestore()
	})

	it("uses the left column height as the wide suggestion panel height when more actions overflow", async () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockImplementation(function (this: HTMLElement) {
				const testId = this.getAttribute("data-testid")
				const heightByTestId: Record<string, number> = {
					"self-media-home-ops-overview": 420,
					"self-media-home-ops-main-column": 420,
					"self-media-home-ops-side-toolbar": 36,
					"self-media-home-ops-side-panel-intro": 160,
				}
				const height = heightByTestId[testId || ""] ?? 0
				return {
					x: 0,
					y: 0,
					left: 0,
					top: 0,
					right: 900,
					bottom: height,
					width: 900,
					height,
					toJSON: () => ({}),
				}
			})

		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 0,
					totalEngagement: 0,
					engagementRate: null,
					operationStage: "syncing",
					completion: {
						source: { done: 0, total: 3 },
						metrics: { done: 0, total: 3 },
						comments: { done: 0, total: 3 },
						review: { done: 0, total: 3 },
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [
						{
							key: "bind-source",
							postKey: "rednote:0:posts/post-1/post.json",
							targetTitle: "做自媒体，最烧时间的不是写稿...",
							title: "绑定已发布链接",
							description:
								"这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
							cta: "去绑定",
							priority: 10,
						},
						{
							key: "bind-source",
							postKey: "rednote:0:posts/post-2/post.json",
							targetTitle: "生成不是终点，工作台才是创作真正...",
							title: "绑定已发布链接",
							description:
								"这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
							cta: "去绑定",
							priority: 10,
						},
						{
							key: "bind-source",
							postKey: "rednote:0:posts/post-3/post.json",
							targetTitle: "稳定输出的创作者，都先建好了输入...",
							title: "绑定已发布链接",
							description:
								"这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
							cta: "去绑定",
							priority: 10,
						},
					],
				}}
				onRegenerateDailyInsight={vi.fn()}
			/>,
		)

		const sideColumn = screen.getByTestId("self-media-home-ops-side-column")
		const actionList = screen.getByTestId("self-media-home-ops-next-actions")
		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveAttribute(
			"data-ops-layout",
			"wide",
		)
		await waitFor(() => {
			expect(sideColumn).toHaveStyle({ height: "420px" })
		})
		expect(screen.getByTestId("self-media-home-ops-side-toolbar")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-ops-side-panel-intro")).toBeInTheDocument()
		expect(sideColumn).toHaveStyle({ minHeight: "407px" })
		expect(actionList).toHaveClass("self-media-ops-action-scroll", "flex-1", "min-h-0")
		expect(actionList).not.toHaveStyle({ maxHeight: "163px" })
		expect(actionList).toHaveStyle({ minHeight: "163px" })

		getBoundingClientRect.mockRestore()
	})

	it("separates AI ops health from workflow completion in the overview card", () => {
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 2,
					totalReads: 0,
					totalEngagement: 0,
					engagementRate: null,
					operationStage: "closed",
					opportunityCount: 1,
					completion: {
						source: { done: 2, total: 2 },
						metrics: { done: 2, total: 2 },
						comments: { done: 2, total: 2 },
						review: { done: 2, total: 2 },
					},
					engagementTotals: {
						likes: 0,
						comments: 0,
						saves: 0,
						shares: 0,
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [],
				}}
				healthInsight={{
					version: 1,
					generatedAt: "2026-06-13T09:00:00+08:00",
					stateSignature: "closed-zero-data",
					score: 58,
					level: "warning",
					summary: "流程链路已闭环，但真实数据仍为 0。",
					reasons: ["链路完成度 100%", "真实阅读为 0"],
					nextAction: "重新同步阅读数据。",
					confidence: "medium",
				}}
			/>,
		)

		const health = screen.getByTestId("self-media-home-ops-health")
		expect(health).toHaveAttribute("data-health-source", "ai")
		expect(health).toHaveTextContent("运营健康度")
		expect(health).toHaveTextContent("58")
		expect(screen.getByTestId("self-media-home-ops-health-link-completion")).toHaveTextContent(
			"链路 100%",
		)
		expect(health).toHaveAttribute("title", expect.stringContaining("链路完成度 100%"))
	})

	it("responds to pointer movement on the ops overview card", () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 400,
				bottom: 200,
				width: 400,
				height: 200,
				toJSON: () => ({}),
			})
		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={vi.fn()} />)

		const overview = screen.getByTestId("self-media-home-ops-overview")
		fireEvent.mouseMove(overview, { clientX: 100, clientY: 50 })

		expect(overview).toHaveStyle({
			"--ops-card-pointer-x": "25%",
			"--ops-card-pointer-y": "25%",
			"--ops-card-tilt-x": "1deg",
			"--ops-card-tilt-y": "-1.5deg",
		})

		fireEvent.mouseLeave(overview)

		expect(overview).toHaveStyle({
			"--ops-card-pointer-x": "50%",
			"--ops-card-pointer-y": "50%",
			"--ops-card-tilt-x": "0deg",
			"--ops-card-tilt-y": "0deg",
		})

		getBoundingClientRect.mockRestore()
	})

	it("animates overview numbers and progress bars from zero", () => {
		vi.useFakeTimers()
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 1200,
					totalEngagement: 170,
					engagementRate: 0.0472,
					completion: {
						source: { done: 2, total: 3 },
						metrics: { done: 1, total: 3 },
						comments: { done: 1, total: 3 },
						review: { done: 0, total: 3 },
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [],
				}}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("0")
		expect(screen.getByTestId("self-media-home-ops-total-engagement")).toHaveTextContent("0")
		expect(screen.getByTestId("self-media-home-ops-engagement-rate")).toHaveTextContent("0%")
		expect(screen.getByTestId("self-media-home-ops-progress-source")).toHaveStyle({
			width: "0%",
		})

		act(() => {
			vi.advanceTimersByTime(720)
		})

		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("1.2k")
		expect(screen.getByTestId("self-media-home-ops-total-engagement")).toHaveTextContent("170")
		expect(screen.getByTestId("self-media-home-ops-engagement-rate")).toHaveTextContent("4.7%")
		expect(screen.getByTestId("self-media-home-ops-progress-source")).toHaveStyle({
			width: "67%",
		})
	})

	it("shows a compact published-data summary with best-post context", () => {
		vi.useFakeTimers()
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 1200,
					totalEngagement: 170,
					engagementRate: 0.0472,
					completion: {
						source: { done: 2, total: 3 },
						metrics: { done: 1, total: 3 },
						comments: { done: 1, total: 3 },
						review: { done: 0, total: 3 },
					},
					engagementTotals: {
						likes: 120,
						comments: 20,
						saves: 18,
						shares: 12,
					},
					bestPost: {
						postKey: "rednote:0:posts/top/post.json",
						title: "Top Post",
						platform: "rednote",
						index: 0,
						reads: 1200,
						engagement: 170,
						engagementRate: 0.1416,
					},
					weakestPost: {
						postKey: "rednote:1:posts/weak/post.json",
						title: "Weak Post",
						platform: "rednote",
						index: 1,
						reads: 240,
						engagement: 3,
						engagementRate: 0.0125,
					},
					nextActions: [],
					lastUpdatedAt: "2026-06-13T09:30:00+08:00",
				}}
			/>,
		)

		act(() => {
			vi.advanceTimersByTime(720)
		})

		expect(screen.getByTestId("self-media-home-ops-data-summary")).toHaveTextContent(
			"发布后数据汇总",
		)
		expect(screen.getByTestId("self-media-home-ops-data-summary")).toHaveClass(
			"border-[#d4dcdd]/70",
			"bg-[linear-gradient(135deg,rgba(250,251,250,0.94)_0%,rgba(246,248,246,0.84)_52%,rgba(255,249,226,0.48)_100%)]",
		)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("1.2k")
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveClass(
			"border-[#d3dde1]/70",
			"bg-[linear-gradient(180deg,rgba(255,255,255,0.93)_0%,rgba(247,250,251,0.86)_100%)]",
		)
		expect(screen.getByTestId("self-media-home-ops-total-engagement")).toHaveClass(
			"border-[#d2e0da]/70",
			"bg-[linear-gradient(180deg,rgba(255,255,255,0.93)_0%,rgba(247,250,248,0.86)_100%)]",
		)
		expect(screen.getByTestId("self-media-home-ops-engagement-rate")).toHaveClass(
			"border-[#ead899]/80",
			"bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(255,249,229,0.82)_100%)]",
		)
		expect(screen.getByTestId("self-media-home-ops-likes")).toHaveTextContent("120")
		expect(screen.getByTestId("self-media-home-ops-likes")).toHaveClass(
			"border-[#d7e5e4]/75",
			"bg-white/68",
		)
		expect(screen.getByTestId("self-media-home-ops-comments")).toHaveTextContent("20")
		expect(screen.getByTestId("self-media-home-ops-saves")).toHaveTextContent("18")
		expect(screen.getByTestId("self-media-home-ops-shares")).toHaveTextContent("12")
		expect(screen.getByTestId("self-media-home-ops-best-post")).toHaveTextContent(
			"最佳样本：Top Post",
		)
		expect(screen.getByTestId("self-media-home-ops-best-post")).toHaveClass(
			"bg-[linear-gradient(90deg,rgba(247,250,248,0.92)_0%,rgba(250,250,246,0.88)_100%)]",
		)
	})

	it("keeps the aggregate metric labels stable in the decision panel", () => {
		vi.useFakeTimers()
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 1200,
					totalEngagement: 170,
					engagementRate: 0.0472,
					completion: {
						source: { done: 2, total: 3 },
						metrics: { done: 1, total: 3 },
						comments: { done: 1, total: 3 },
						review: { done: 0, total: 3 },
					},
					bestPost: {
						postKey: "rednote:0:posts/top/post.json",
						title: "Top Post",
						platform: "rednote",
						index: 0,
						reads: 1200,
						engagement: 170,
						engagementRate: 0.1416,
					},
					weakestPost: {
						postKey: "rednote:1:posts/weak/post.json",
						title: "Weak Post",
						platform: "rednote",
						index: 1,
						reads: 240,
						engagement: 3,
						engagementRate: 0.0125,
					},
					nextActions: [],
					lastUpdatedAt: "2026-06-13T09:30:00+08:00",
				}}
			/>,
		)

		act(() => {
			vi.advanceTimersByTime(720)
		})

		const rateMetric = screen.getByTestId("self-media-home-ops-engagement-rate")
		expect(rateMetric).toHaveTextContent("平均互动率")
		expect(rateMetric).toHaveTextContent("4.7%")
		expect(screen.getByTestId("self-media-home-ops-data-summary")).toHaveTextContent("篇均阅读")
	})

	it("turns the overview into an operation decision panel", () => {
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 1200,
					totalEngagement: 170,
					engagementRate: 0.0472,
					completion: {
						source: { done: 2, total: 3 },
						metrics: { done: 1, total: 3 },
						comments: { done: 1, total: 3 },
						review: { done: 0, total: 3 },
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [
						{
							key: "sync-metrics",
							postKey: "rednote:0:posts/post-1/post.json",
							targetTitle: "Post One",
							title: "同步最新数据",
							description:
								"已检测到发布源。现在可以同步最新阅读、点赞、评论和转发数据。",
							cta: "去同步",
							priority: 20,
						},
					],
				}}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-headline")).toHaveTextContent(
			"当前瓶颈：2 篇待同步数据",
		)
		expect(screen.getByTestId("self-media-home-ops-summary")).toHaveTextContent(
			"先同步阅读、点赞、评论数据，解锁互动率判断。",
		)
		expect(screen.getByTestId("self-media-home-ops-health")).toHaveTextContent(/健康度\s*33/)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent(
			"已同步 1/3",
		)
		expect(screen.getByTestId("self-media-home-ops-action-sync-metrics")).toHaveTextContent(
			"解锁互动率判断",
		)
		expect(screen.getByTestId("self-media-home-ops-action-sync-metrics")).toHaveTextContent(
			"文章：Post One",
		)
	})

	it("renders cached home daily insight content in the closed ops state", () => {
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 2,
					totalReads: 3200,
					totalEngagement: 516,
					engagementRate: 0.16125,
					operationStage: "closed",
					opportunityCount: 2,
					completion: {
						source: { done: 2, total: 2 },
						metrics: { done: 2, total: 2 },
						comments: { done: 2, total: 2 },
						review: { done: 2, total: 2 },
					},
					bestPost: {
						postKey: "rednote:0:posts/best/post.json",
						title: "Best Post",
						platform: "rednote",
						index: 0,
						reads: 2000,
						engagement: 380,
						engagementRate: 0.19,
					},
					weakestPost: null,
					nextActions: [
						{
							key: "plan-next-post",
							title: "规划下一篇内容",
							description: "当前运营链路已闭环，可以继续生成新选题。",
							cta: "新建文章",
							priority: 70,
						},
					],
					lastUpdatedAt: "2026-06-13T09:30:00+08:00",
				}}
				dailyInsight={{
					version: 1,
					date: "2026-06-13",
					generatedAt: "2026-06-13T09:00:00+08:00",
					stateSignature: "cached-signature",
					greeting: "测试用户，今天可以看复用机会",
					summary: "链路已闭环，优先拆高互动样本。",
					actions: [
						{
							id: "reuse-best",
							title: "复用高互动结构",
							description: "从 Best Post 拆一套下一篇结构。",
							cta: "看样本",
							kind: "repurpose-best-post",
							postKey: "rednote:0:posts/best/post.json",
						},
					],
				}}
				dailyInsightStatus="cached"
				onRegenerateDailyInsight={vi.fn()}
			/>,
		)

		expect(screen.getByText("今日建议")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-daily-insight-refresh")).toHaveTextContent(
			"更新建议",
		)
		expect(screen.getByTestId("self-media-home-ops-aside")).not.toContainElement(
			screen.getByTestId("self-media-home-daily-insight-refresh"),
		)
		expect(screen.getByText("链路已闭环，优先拆高互动样本。")).toBeInTheDocument()
		expect(screen.getByText("链路已闭环，优先拆高互动样本。")).not.toHaveClass("line-clamp-2")
		expect(screen.getByTestId("self-media-home-ops-insight-greeting")).toHaveTextContent(
			"测试用户，今天可以看复用机会",
		)
		expect(
			screen.getByTestId("self-media-home-ops-action-repurpose-best-post"),
		).toHaveTextContent("复用高互动结构")
		expect(
			screen.getByTestId("self-media-home-ops-action-repurpose-best-post"),
		).toHaveTextContent("文章：Best Post")
		expect(screen.getByText("从 Best Post 拆一套下一篇结构。")).not.toHaveClass("line-clamp-2")
		expect(
			screen.queryByTestId("self-media-home-ops-action-plan-next-post"),
		).not.toBeInTheDocument()
	})

	it("lets users scroll and dismiss AI generated daily insight actions", () => {
		render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 2,
					totalReads: 3200,
					totalEngagement: 420,
					engagementRate: 0.1312,
					operationStage: "closed",
					opportunityCount: 4,
					completion: {
						source: { done: 2, total: 2 },
						metrics: { done: 2, total: 2 },
						comments: { done: 2, total: 2 },
						review: { done: 2, total: 2 },
					},
					engagementTotals: {
						likes: 260,
						comments: 64,
						saves: 72,
						shares: 24,
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [
						{
							key: "plan-next-post",
							title: "规划下一篇内容",
							description: "当前运营链路已闭环，可以继续生成新选题。",
							cta: "新建文章",
							priority: 70,
						},
					],
				}}
				dailyInsight={{
					version: 1,
					date: "2026-06-14",
					generatedAt: "2026-06-14T08:00:00+08:00",
					stateSignature: "scrollable-actions",
					greeting: "今天优先处理可复用机会",
					summary: "建议较多时需要保持面板可控。",
					actions: [
						{
							id: "reuse-best",
							title: "复用高互动结构",
							description: "拆一套下一篇结构。",
							cta: "看样本",
							kind: "repurpose-best-post",
						},
						{
							id: "improve-weak",
							title: "优化弱互动文章",
							description: "调整标题和开头。",
							cta: "去优化",
							kind: "improve-weak-post",
						},
						{
							id: "plan-next",
							title: "规划下一篇内容",
							description: "补一篇承接内容。",
							cta: "新建文章",
							kind: "plan-next-post",
						},
						{
							id: "collect-comments",
							title: "整理评论问题",
							description: "把高频问题变成选题池。",
							cta: "看评论",
							kind: "collect-comments",
						},
					],
				}}
				dailyInsightStatus="generated"
			/>,
		)

		const actionList = screen.getByTestId("self-media-home-ops-next-actions")
		expect(actionList).toHaveClass("self-media-ops-action-scroll")
		expect(actionList).toHaveClass("-mx-3.5")
		expect(actionList).toHaveClass("px-3.5")
		expect(actionList).toHaveStyle({
			maxHeight: "260px",
		})
		expect(screen.getByTestId("self-media-home-ops-next-actions-inner")).toHaveClass("py-3.5")
		fireEvent.click(screen.getByLabelText("移除建议：优化弱互动文章"))

		expect(screen.queryByText("优化弱互动文章")).not.toBeInTheDocument()
		expect(screen.getByText("复用高互动结构")).toBeInTheDocument()
		expect(screen.getByText("规划下一篇内容")).toBeInTheDocument()
		expect(screen.getByText("整理评论问题")).toBeInTheDocument()

		fireEvent.click(screen.getByLabelText("移除建议：复用高互动结构"))
		fireEvent.click(screen.getByLabelText("移除建议：规划下一篇内容"))
		fireEvent.click(screen.getByLabelText("移除建议：整理评论问题"))

		expect(
			screen.getByText(
				"今天的发布、数据、评论和复盘都已经齐了，可以继续新建文章或做二次分发。",
			),
		).toBeInTheDocument()
		expect(
			screen.queryByText("当前运营链路已闭环，可以继续生成新选题。"),
		).not.toBeInTheDocument()
	})

	it("places the cached daily insight greeting in the ops suggestion panel", async () => {
		const date = getSelfMediaHomeInsightDateKey()
		const storage = {
			loadHomeDailyInsight: vi.fn().mockResolvedValue({
				version: 1,
				date,
				generatedAt: "2026-06-14T08:00:00+08:00",
				stateSignature: "cached-signature",
				welcomeTitle: "今日重点：复用高互动样本",
				greeting: "早上好，谢佳博！今天是2026年6月14日，周日。",
				summary: "先看高互动样本，再安排下一篇。",
				actions: [
					{
						id: "reuse-best",
						title: "复用高互动结构",
						description: "拆一套下一篇结构。",
						cta: "看样本",
						kind: "repurpose-best-post",
					},
				],
			}),
			saveHomeDailyInsight: vi.fn().mockResolvedValue(undefined),
		}

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				onOpenPost={vi.fn()}
				homeDailyInsightStorage={storage}
				homeDailyInsightModelId="first-available-model"
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-ops-insight-greeting")).toHaveTextContent(
				"谢佳博，运营工作台已准备就绪",
			)
		})
		expect(screen.getByTestId("self-media-home-header")).toHaveTextContent(
			"今日重点：复用高互动样本",
		)
		expect(screen.getByTestId("self-media-home-header")).not.toHaveTextContent("早上好")
		expect(screen.getByTestId("self-media-home-header")).not.toHaveTextContent("谢佳博")
		expect(screen.getByTestId("self-media-home-header")).not.toHaveTextContent("2026年6月14日")
		expect(screen.getByTestId("self-media-home-header")).not.toHaveTextContent("周日")
		expect(screen.getByTestId("self-media-home-ops-insight-greeting")).not.toHaveTextContent(
			"早上好",
		)
		expect(screen.getByTestId("self-media-home-ops-insight-greeting")).not.toHaveTextContent(
			"2026年6月14日",
		)
		expect(screen.getByTestId("self-media-home-ops-insight-greeting")).not.toHaveTextContent(
			"周日",
		)
		expect(
			within(screen.getByTestId("self-media-home-ops-overview")).queryByText(
				"早上好，谢佳博！今天是2026年6月14日，周日。",
			),
		).not.toBeInTheDocument()
	})

	it("auto-generates home daily insight when the project opens and the insight file is missing", async () => {
		mocks.chat.mockResolvedValueOnce({
			content: JSON.stringify({
				welcomeTitle: "今日重点：复用高互动样本",
				greeting: "测试用户，今天直接看复用机会",
				summary: "链路已闭环，优先拆高互动样本。",
				actions: [
					{
						id: "reuse-best",
						title: "复用高互动结构",
						description: "从高互动样本拆一套下一篇结构。",
						cta: "看样本",
						kind: "repurpose-best-post",
					},
				],
			}),
		})
		const storage = {
			loadHomeDailyInsight: vi.fn().mockResolvedValue(null),
			saveHomeDailyInsight: vi.fn().mockResolvedValue(undefined),
		}

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				onOpenPost={vi.fn()}
				homeDailyInsightStorage={storage}
				homeDailyInsightModelId="first-available-model"
			/>,
		)

		await waitFor(() => {
			expect(storage.loadHomeDailyInsight).toHaveBeenCalledTimes(1)
		})
		await waitFor(() => {
			expect(storage.saveHomeDailyInsight).toHaveBeenCalled()
		})
		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-header")).toHaveTextContent(
				"今日重点：复用高互动样本",
			)
		})
		expect(storage.saveHomeDailyInsight.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				welcomeTitle: "今日重点：复用高互动样本",
			}),
		)
		expect(mocks.chat).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				model: "first-available-model",
			}),
		)
	})

	it("auto-generates AI ops health insight when the project opens and the insight file is missing", async () => {
		mocks.chat.mockResolvedValueOnce({
			content: JSON.stringify({
				score: 61,
				level: "warning",
				summary: "链路未完全闭环，真实数据样本还不够稳定。",
				reasons: ["链路完成度 50%", "真实阅读为 0"],
				nextAction: "先同步发布后的阅读数据。",
				confidence: "medium",
			}),
		})
		const storage = {
			loadOpsHealthInsight: vi.fn().mockResolvedValue(null),
			saveOpsHealthInsight: vi.fn().mockResolvedValue(undefined),
		}

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				opsHealthInsightStorage={storage}
				homeDailyInsightModelId="first-available-model"
			/>,
		)

		await waitFor(() => {
			expect(storage.loadOpsHealthInsight).toHaveBeenCalledTimes(1)
		})
		await waitFor(() => {
			expect(storage.saveOpsHealthInsight).toHaveBeenCalledWith(
				expect.objectContaining({
					score: 61,
					level: "warning",
				}),
			)
		})
		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-ops-health")).toHaveTextContent("61")
		})
		expect(screen.getByTestId("self-media-home-ops-health")).toHaveAttribute(
			"data-health-source",
			"ai",
		)
	})

	it("shows a metrics loading state instead of flashing zero values before ops metrics hydrate", async () => {
		let resolveMetrics: (value: SelfMediaPostOpsMetricsPayload) => void = () => undefined
		const onLoadOpsMetrics = vi.fn(
			() =>
				new Promise<SelfMediaPostOpsMetricsPayload>((resolve) => {
					resolveMetrics = resolve
				}),
		)

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				onLoadOpsMetrics={onLoadOpsMetrics}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveAttribute(
			"data-loading",
			"true",
		)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("同步中")
		expect(screen.getByTestId("self-media-home-ops-total-reads")).not.toHaveTextContent("0")

		await waitFor(() => {
			expect(onLoadOpsMetrics).toHaveBeenCalledTimes(1)
		})
		await act(async () => {
			resolveMetrics(createOpsMetrics())
		})

		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveAttribute(
				"data-loading",
				"false",
			)
			expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("2.4k")
		})
	})

	it("keeps an in-flight ops metrics result when a same-signature rerender cleans up the effect", async () => {
		let resolveMetrics: (value: SelfMediaPostOpsMetricsPayload) => void = () => undefined
		const onLoadOpsMetrics = vi.fn(
			() =>
				new Promise<SelfMediaPostOpsMetricsPayload>((resolve) => {
					resolveMetrics = resolve
				}),
		)
		const post = createPostItem()
		const { rerender } = render(
			<SelfMediaHomePage
				posts={[post]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				onLoadOpsMetrics={onLoadOpsMetrics}
			/>,
		)

		await waitFor(() => {
			expect(onLoadOpsMetrics).toHaveBeenCalledTimes(1)
		})
		rerender(
			<SelfMediaHomePage
				posts={[post]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				onLoadOpsMetrics={onLoadOpsMetrics}
				initialScrollTop={12}
			/>,
		)

		await act(async () => {
			resolveMetrics(createOpsMetrics())
		})

		await waitFor(() => {
			expect(onLoadOpsMetrics).toHaveBeenCalledTimes(1)
			expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveAttribute(
				"data-loading",
				"false",
			)
			expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveTextContent("2.4k")
		})
	})

	it("waits for pending ops metrics before generating AI ops health insight", async () => {
		let resolveMetrics: (value: SelfMediaPostOpsMetricsPayload) => void = () => undefined
		const onLoadOpsMetrics = vi.fn(
			() =>
				new Promise<SelfMediaPostOpsMetricsPayload>((resolve) => {
					resolveMetrics = resolve
				}),
		)
		const storage = {
			loadOpsHealthInsight: vi.fn().mockResolvedValue(null),
			saveOpsHealthInsight: vi.fn().mockResolvedValue(undefined),
		}
		mocks.chat.mockResolvedValueOnce({
			content: JSON.stringify({
				score: 82,
				level: "good",
				summary: "真实数据已经完成加载。",
				reasons: ["链路完成度 50%", "总阅读 2400"],
				nextAction: "复用互动样本。",
				confidence: "high",
			}),
		})

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				attachmentList={createOpsAttachments()}
				onOpenPost={vi.fn()}
				onLoadOpsMetrics={onLoadOpsMetrics}
				opsHealthInsightStorage={storage}
				homeDailyInsightModelId="first-available-model"
			/>,
		)

		await waitFor(() => {
			expect(onLoadOpsMetrics).toHaveBeenCalledTimes(1)
		})
		expect(storage.loadOpsHealthInsight).not.toHaveBeenCalled()
		expect(mocks.chat).not.toHaveBeenCalled()

		await act(async () => {
			resolveMetrics(createOpsMetrics())
		})

		await waitFor(() => {
			expect(storage.loadOpsHealthInsight).toHaveBeenCalledTimes(1)
		})
		await waitFor(() => {
			expect(mocks.chat).toHaveBeenCalledTimes(1)
		})
		expect(screen.getByTestId("self-media-home-ops-health")).toHaveTextContent("82")
	})

	it("waits for an available model before auto-generating home daily insight", async () => {
		const storage = {
			loadHomeDailyInsight: vi.fn().mockResolvedValue(null),
			saveHomeDailyInsight: vi.fn().mockResolvedValue(undefined),
		}

		render(
			<SelfMediaHomePage
				posts={[createPostItem()]}
				onOpenPost={vi.fn()}
				homeDailyInsightStorage={storage}
			/>,
		)

		await waitFor(() => {
			expect(storage.loadHomeDailyInsight).not.toHaveBeenCalled()
		})
		expect(mocks.chat).not.toHaveBeenCalled()
	})

	it("adds breathing motion only to active operation states", () => {
		const { rerender } = render(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 1200,
					totalEngagement: 170,
					engagementRate: 0.0472,
					completion: {
						source: { done: 3, total: 3 },
						metrics: { done: 1, total: 3 },
						comments: { done: 0, total: 3 },
						review: { done: 0, total: 3 },
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [],
				}}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-overview")).toHaveClass(
			"self-media-ops-breathing-surface",
		)
		expect(screen.getByTestId("self-media-home-ops-overview-breath")).toHaveClass(
			"self-media-ops-breathing-glow",
		)
		expect(screen.getByTestId("self-media-home-ops-overview-breath")).toHaveClass("inset-0")
		expect(screen.getByTestId("self-media-home-ops-overview-breath")).not.toHaveClass(
			"-inset-16",
		)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveAttribute(
			"data-motion",
			"active",
		)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveClass(
			"self-media-ops-metric-flow",
		)

		rerender(
			<SelfMediaOpsOverviewCard
				overview={{
					totalPosts: 3,
					totalReads: 1200,
					totalEngagement: 170,
					engagementRate: 0.0472,
					completion: {
						source: { done: 3, total: 3 },
						metrics: { done: 3, total: 3 },
						comments: { done: 3, total: 3 },
						review: { done: 3, total: 3 },
					},
					bestPost: null,
					weakestPost: null,
					nextActions: [],
				}}
			/>,
		)

		expect(screen.getByTestId("self-media-home-ops-total-reads")).toHaveAttribute(
			"data-motion",
			"idle",
		)
		expect(screen.getByTestId("self-media-home-ops-total-reads")).not.toHaveClass(
			"self-media-ops-metric-flow",
		)
		expect(screen.queryByTestId("self-media-home-ops-completion")).not.toBeInTheDocument()
	})

	it("opens the relevant binding action from the quick continue list", async () => {
		const onOpenPost = vi.fn()
		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={onOpenPost} />)

		fireEvent.click(screen.getByTestId("self-media-home-ops-action-bind-source"))

		expect(onOpenPost).not.toHaveBeenCalled()
		await waitFor(() => {
			expect(screen.getByTestId("mock-self-media-post-card")).toHaveAttribute(
				"data-published-link-auto-open-signal",
				"1",
			)
		})
	})

	it("keeps the home header in the normal scroll layout", () => {
		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={vi.fn()} />)

		const header = screen.getByTestId("self-media-home-header")
		const main = screen.getByTestId("self-media-home-main")

		expect(main).toContainElement(header)
		expect(header.parentElement).not.toBe(screen.getByTestId("self-media-home-page"))
	})

	it("does not show a dead create action in the empty state when creation is unavailable", () => {
		render(<SelfMediaHomePage posts={[]} onOpenPost={vi.fn()} />)

		expect(screen.getByTestId("self-media-home-empty")).toBeInTheDocument()
		expect(screen.queryByTestId("self-media-home-empty-create-button")).not.toBeInTheDocument()
	})

	it("uses native view transitions to open the detail view in the same interaction", () => {
		const onOpenPost = vi.fn()
		const startViewTransition = vi.fn((callback: () => void) => {
			callback()
			return {
				finished: Promise.resolve(),
				ready: Promise.resolve(),
				updateCallbackDone: Promise.resolve(),
			}
		})
		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			value: startViewTransition,
		})

		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={onOpenPost} />)

		fireEvent.click(screen.getByTestId("mock-self-media-post-card"))

		const card = screen.getByTestId("mock-self-media-post-card")
		expect(startViewTransition).toHaveBeenCalledTimes(1)
		expect(onOpenPost).toHaveBeenCalledWith({ platform: "rednote", index: 0 })
		expect(screen.getByTestId("self-media-home-page")).toHaveClass("self-media-home-opening")
		expect(card).toHaveAttribute("data-opening", "true")
		expect(card).toHaveStyle({
			"--open-card-lift": "-4px",
			"--open-card-scale": "0.996",
		})
	})

	it("uses a short selected-card fallback before opening the detail view", () => {
		vi.useFakeTimers()
		const onOpenPost = vi.fn()
		render(<SelfMediaHomePage posts={[createPostItem()]} onOpenPost={onOpenPost} />)

		fireEvent.click(screen.getByTestId("mock-self-media-post-card"))

		const card = screen.getByTestId("mock-self-media-post-card")
		expect(screen.queryByTestId("self-media-home-open-transition")).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-page")).toHaveClass("self-media-home-opening")
		expect(screen.getByTestId("self-media-home-ops-overview").parentElement).toHaveClass(
			"self-media-home-opening-dim",
		)
		expect(card).toHaveAttribute("data-opening", "true")
		expect(card).toHaveAttribute("data-dimmed", "false")
		expect(card).toHaveStyle({
			"--open-card-lift": "-4px",
			"--open-card-scale": "0.996",
		})
		expect(card.getAttribute("style")).not.toContain("--open-card-scale-x")
		expect(card.getAttribute("style")).not.toContain("--open-card-scale-y")
		expect(onOpenPost).not.toHaveBeenCalled()

		act(() => {
			vi.advanceTimersByTime(109)
		})
		expect(onOpenPost).not.toHaveBeenCalled()

		act(() => {
			vi.advanceTimersByTime(1)
		})

		expect(onOpenPost).toHaveBeenCalledWith({ platform: "rednote", index: 0 })
	})
})
