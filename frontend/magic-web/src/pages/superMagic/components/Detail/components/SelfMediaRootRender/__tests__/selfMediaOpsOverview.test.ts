import { describe, expect, it } from "vitest"
import {
	buildSelfMediaOpsOverview,
	formatSelfMediaCompactNumber,
	formatSelfMediaMetricDisplay,
	getSelfMediaPostKey,
} from "../services/selfMediaOpsOverview"
import { buildSelfMediaOpsMetricDisplay } from "../services/selfMediaOpsOverviewPresentation"
import type { SelfMediaPostOpsMetricsPayload } from "../services/SelfMediaFileStorageService"
import type { SelfMediaPostOpsArtifacts } from "../services/selfMediaOpsArtifactStates"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"

function createPostItem(
	id: string,
	index: number,
	title: string,
	publishStatus?: SelfMediaPlatformPostItem["entry"]["publishStatus"],
): SelfMediaPlatformPostItem {
	return {
		platform: "rednote",
		index,
		entry: {
			id,
			name: title,
			entry: `posts/${id}/post.json`,
			publishStatus,
		},
		post: {
			meta: {
				id,
				title,
				feedTitle: title,
				publishStatus,
			},
			cards: [],
		},
	}
}

function metrics(
	values: SelfMediaPostOpsMetricsPayload["metrics"],
): SelfMediaPostOpsMetricsPayload {
	return {
		version: 1,
		updatedAt: "2026-06-13T10:00:00.000Z",
		source: "real-platform",
		metrics: values,
	}
}

const readyArtifacts: SelfMediaPostOpsArtifacts = {
	source: true,
	metrics: true,
	comments: true,
	review: true,
}

describe("self-media ops overview", () => {
	it("summarizes engagement health and ranks next actions from existing ops artifacts", () => {
		const missingSource = createPostItem("missing-source", 0, "Missing Source")
		const needsReview = createPostItem("needs-review", 1, "Needs Review")
		const weakEngagement = createPostItem("weak-engagement", 2, "Weak Engagement")
		const posts = [missingSource, needsReview, weakEngagement]
		const artifactsByPostKey = new Map<string, SelfMediaPostOpsArtifacts>([
			[
				getSelfMediaPostKey(missingSource),
				{ source: false, metrics: false, comments: false, review: false },
			],
			[
				getSelfMediaPostKey(needsReview),
				{ source: true, metrics: true, comments: true, review: false },
			],
			[getSelfMediaPostKey(weakEngagement), readyArtifacts],
		])
		const metricsByPostKey = new Map<string, SelfMediaPostOpsMetricsPayload | null>([
			[
				getSelfMediaPostKey(needsReview),
				metrics({ reads: "1.2k", likes: "96", comments: "12", saves: "24", shares: "8" }),
			],
			[
				getSelfMediaPostKey(weakEngagement),
				metrics({ reads: 2400, likes: 24, commentCount: 3, saves: 2, shares: 1 }),
			],
		])

		const overview = buildSelfMediaOpsOverview({
			posts,
			artifactsByPostKey,
			metricsByPostKey,
		})

		expect(overview.totalPosts).toBe(3)
		expect(overview.totalReads).toBe(3600)
		expect(overview.totalEngagement).toBe(170)
		expect(overview.engagementTotals).toEqual({
			likes: 120,
			comments: 15,
			saves: 26,
			shares: 9,
		})
		expect(overview.engagementRate).toBeCloseTo(0.0472, 4)
		expect(overview.bestPost?.title).toBe("Needs Review")
		expect(overview.weakestPost?.title).toBe("Weak Engagement")
		expect(overview.completion).toEqual({
			source: { done: 2, total: 3 },
			metrics: { done: 2, total: 3 },
			comments: { done: 2, total: 3 },
			review: { done: 1, total: 3 },
		})
		expect(overview.nextActions.map((item) => item.key)).toEqual([
			"bind-source",
			"generate-review",
			"improve-weak-post",
		])
		expect(overview.nextActions[0]).toMatchObject({
			postKey: getSelfMediaPostKey(missingSource),
			targetTitle: "Missing Source",
			title: "绑定已发布链接",
			cta: "去绑定",
		})
		expect(overview.nextActions[0].description).toBe(
			"这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
		)
	})

	it("keeps real aggregate metrics visible while the ops chain still needs setup", () => {
		const missingSource = createPostItem("missing-source", 0, "Missing Source")
		const ready = createPostItem("ready-post", 1, "Ready Post")
		const overview = buildSelfMediaOpsOverview({
			posts: [missingSource, ready],
			artifactsByPostKey: new Map<string, SelfMediaPostOpsArtifacts>([
				[
					getSelfMediaPostKey(missingSource),
					{ source: false, metrics: false, comments: false, review: false },
				],
				[getSelfMediaPostKey(ready), readyArtifacts],
			]),
			metricsByPostKey: new Map<string, SelfMediaPostOpsMetricsPayload | null>([
				[
					getSelfMediaPostKey(ready),
					metrics({ reads: 1800, likes: 144, comments: 36, saves: 54, shares: 18 }),
				],
			]),
		})

		const display = buildSelfMediaOpsMetricDisplay(overview, {
			reads: "1.8k",
			engagement: "252",
			rate: "14%",
		})

		expect(overview.operationStage).toBe("setup")
		expect(display.reads).toEqual({ label: "总阅读", value: "1.8k" })
		expect(display.engagement).toEqual({ label: "总互动", value: "252" })
		expect(display.rate).toEqual({ label: "平均互动率", value: "14%" })
	})

	it("excludes archived posts from home overview calculations", () => {
		const active = createPostItem("active-post", 0, "Active Post")
		const archived = createPostItem("archived-post", 1, "Archived Post", "archived")
		const artifactsByPostKey = new Map<string, SelfMediaPostOpsArtifacts>([
			[getSelfMediaPostKey(active), readyArtifacts],
			[getSelfMediaPostKey(archived), readyArtifacts],
		])
		const metricsByPostKey = new Map<string, SelfMediaPostOpsMetricsPayload | null>([
			[
				getSelfMediaPostKey(active),
				metrics({ reads: 1000, likes: 80, comments: 10, saves: 20, shares: 10 }),
			],
			[
				getSelfMediaPostKey(archived),
				metrics({ reads: 9000, likes: 900, comments: 90, saves: 900, shares: 90 }),
			],
		])

		const overview = buildSelfMediaOpsOverview({
			posts: [active, archived],
			artifactsByPostKey,
			metricsByPostKey,
		})

		expect(overview.totalPosts).toBe(1)
		expect(overview.totalReads).toBe(1000)
		expect(overview.totalEngagement).toBe(120)
		expect(overview.engagementTotals).toEqual({
			likes: 80,
			comments: 10,
			saves: 20,
			shares: 10,
		})
		expect(overview.completion).toEqual({
			source: { done: 1, total: 1 },
			metrics: { done: 1, total: 1 },
			comments: { done: 1, total: 1 },
			review: { done: 1, total: 1 },
		})
		expect(overview.bestPost?.title).toBe("Active Post")
		expect(overview.nextActions.map((item) => item.postKey)).not.toContain(
			getSelfMediaPostKey(archived),
		)
	})

	it("switches to continuation actions when every post ops artifact is complete", () => {
		const best = createPostItem("best-post", 0, "Best Post")
		const steady = createPostItem("steady-post", 1, "Steady Post")
		const posts = [best, steady]
		const artifactsByPostKey = new Map<string, SelfMediaPostOpsArtifacts>([
			[getSelfMediaPostKey(best), readyArtifacts],
			[getSelfMediaPostKey(steady), readyArtifacts],
		])
		const metricsByPostKey = new Map<string, SelfMediaPostOpsMetricsPayload | null>([
			[
				getSelfMediaPostKey(best),
				metrics({ reads: 2000, likes: 240, comments: 36, saves: 80, shares: 24 }),
			],
			[
				getSelfMediaPostKey(steady),
				metrics({ reads: 1200, likes: 72, comments: 18, saves: 32, shares: 14 }),
			],
		])

		const overview = buildSelfMediaOpsOverview({
			posts,
			artifactsByPostKey,
			metricsByPostKey,
		})

		expect(overview.operationStage).toBe("closed")
		expect(overview.opportunityCount).toBe(2)
		expect(overview.nextActions.map((item) => item.key)).toEqual([
			"repurpose-best-post",
			"plan-next-post",
		])
		expect(overview.nextActions[0]).toMatchObject({
			postKey: getSelfMediaPostKey(best),
			targetTitle: "Best Post",
			title: "复用高互动结构",
			cta: "看样本",
		})
		expect(overview.nextActions[1]).toMatchObject({
			title: "规划下一篇内容",
			cta: "新建文章",
		})
	})
})

describe("formatSelfMediaCompactNumber", () => {
	it("uses wan for Chinese locales and k for English locales", () => {
		expect(formatSelfMediaCompactNumber(26000)).toBe("2.6万")
		expect(formatSelfMediaCompactNumber(26000, "zh-CN")).toBe("2.6万")
		expect(formatSelfMediaCompactNumber(26000, "en-US")).toBe("26k")
		expect(formatSelfMediaCompactNumber(1200, "en")).toBe("1.2k")
		expect(formatSelfMediaCompactNumber(130, "en")).toBe("130")
	})

	it("parses Chinese compact units before displaying English values", () => {
		expect(formatSelfMediaMetricDisplay("2.6w", "en")).toBe("26k")
		expect(formatSelfMediaMetricDisplay("2.6万", "en-US")).toBe("26k")
		expect(formatSelfMediaMetricDisplay("1.2k", "zh-CN")).toBe("1.2k")
	})
})
