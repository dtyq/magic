import { makeAutoObservable, runInAction } from "mobx"
import { SuperMagicApi } from "@/apis"
import type { ProjectListItem } from "../../pages/Workspace/types"

const PAGE_SIZE = 20

/** 跨工作区查询快照，不写入工作区有序缓存。 */
class RecentProjectsStore {
	items: ProjectListItem[] = []
	page = 0
	hasMore = true
	loading = false
	error = false
	stale = true
	private identity: string | null = null
	private generation = 0
	private request: AbortController | null = null

	constructor() {
		makeAutoObservable(this, { request: false } as Record<string, false>, { autoBind: true })
	}

	/** 查询失效版本供独立管理器订阅，不共享搜索结果或分页游标。 */
	get revision(): number {
		return this.generation
	}

	setIdentity(userId?: string, organizationCode?: string) {
		const identity =
			userId && organizationCode ? JSON.stringify([userId, organizationCode]) : null
		if (identity === this.identity) return
		this.identity = identity
		this.reset()
	}

	async loadMore(): Promise<void> {
		if (!this.identity || this.loading || (!this.stale && !this.hasMore)) return
		const page = this.stale ? 1 : this.page + 1
		const generation = this.generation
		const controller = new AbortController()
		this.request = controller
		this.loading = true
		this.error = false
		try {
			const response = await SuperMagicApi.getProjectsWithCollaboration(
				{
					page,
					page_size: PAGE_SIZE,
					show_collaboration: 1,
					sort_mode: "recent",
					include_special: 1,
				},
				{ signal: controller.signal },
			)
			if (generation !== this.generation || controller.signal.aborted) return
			runInAction(() => {
				const previous = page === 1 ? [] : this.items
				const items = Array.from(
					new Map(
						[...previous, ...response.list].map((item) => [item.id, item]),
					).values(),
				)
				this.hasMore = page * PAGE_SIZE < response.total && items.length > previous.length
				this.items = items
				this.page = page
				this.stale = false
			})
		} catch {
			if (generation === this.generation && !controller.signal.aborted)
				runInAction(() => {
					this.error = true
				})
		} finally {
			if (generation === this.generation)
				runInAction(() => {
					this.loading = false
					this.request = null
				})
		}
	}

	/** 写操作结束或重新打开栏目后刷新；乐观更新时只改快照，避免抢先读到服务端旧值。 */
	invalidate() {
		this.generation++
		this.request?.abort()
		this.request = null
		this.loading = false
		this.error = false
		this.stale = true
	}

	updateProject(project: ProjectListItem) {
		this.items = this.items.map((item) =>
			item.id === project.id ? { ...item, ...project } : item,
		)
	}

	recordVisit(project: ProjectListItem, lastActiveAt: string) {
		// 只采用服务端确认时间；失败请求不提升顺序，刷新后仍由服务端决定跨区排序。
		this.items = [
			{ ...project, last_active_at: lastActiveAt },
			...this.items.filter((item) => item.id !== project.id),
		].sort(
			(a, b) =>
				(b.last_active_at ?? b.created_at).localeCompare(
					a.last_active_at ?? a.created_at,
				) ||
				b.created_at.localeCompare(a.created_at) ||
				b.id.localeCompare(a.id),
		)
		this.invalidate()
	}

	reset() {
		this.invalidate()
		this.items = []
		this.page = 0
		this.hasMore = true
	}
}

export default new RecentProjectsStore()
