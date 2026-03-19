import { makeAutoObservable, runInAction } from "mobx"
import { skillsService } from "@/services/skills/SkillsService"
import type {
	GetSkillsParams,
	ImportSkillParams,
	ParseSkillResponse,
	ImportSkillResponse,
} from "@/apis/modules/skills"
import type { UserSkillView } from "@/services/skills/SkillsService"

const DEFAULT_PAGE_SIZE = 20

export class UserSkillsStore {
	list: UserSkillView[] = []
	total = 0
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	loading = false
	loadingMore = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get hasMore() {
		return this.list.length < this.total
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	async fetchSkills(params: GetSkillsParams = {}) {
		if (this.loading) return
		this.loading = true
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = params.keyword?.trim() ?? ""

		if (page === 1) {
			this.list = []
			this.page = 1
		}

		try {
			const data = await skillsService.getUserSkills({
				page,
				page_size: pageSize,
				keyword: keyword || undefined,
			})
			runInAction(() => {
				this.list = data.list
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.keyword = keyword
				this.loading = false
			})
		} catch (error) {
			runInAction(() => {
				this.loading = false
			})
			throw error
		}
	}

	async loadMore() {
		if (this.loading || this.loadingMore || !this.hasMore) return
		this.loadingMore = true
		const nextPage = this.page + 1

		try {
			const data = await skillsService.getUserSkills({
				page: nextPage,
				page_size: this.pageSize,
				keyword: this.keyword || undefined,
			})
			runInAction(() => {
				const existingIds = new Set(this.list.map((item) => item.id))
				const appendList = data.list.filter((item) => !existingIds.has(item.id))
				this.list = [...this.list, ...appendList]
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.loadingMore = false
			})
		} catch (error) {
			runInAction(() => {
				this.loadingMore = false
			})
			throw error
		}
	}

	async deleteSkill(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target) return

		await skillsService.deleteSkill(target.skillCode)
		runInAction(() => {
			this.list = this.list.filter((item) => item.id !== id)
			this.total = Math.max(0, this.total - 1)
		})
	}

	async upgradeSkill(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target) return

		await skillsService.upgradeSkill(target.skillCode)
		runInAction(() => {
			this.list = this.list.map((item) =>
				item.id === id ? { ...item, needUpgrade: false } : item,
			)
		})
	}

	parseSkillFile(file_key: string): Promise<ParseSkillResponse> {
		return skillsService.parseSkillFile(file_key)
	}

	async importSkill(params: ImportSkillParams): Promise<ImportSkillResponse> {
		const result = await skillsService.importSkill(params)
		await this.fetchSkills({ page: 1, keyword: this.keyword || undefined })
		return result
	}

	reset() {
		this.list = []
		this.total = 0
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.keyword = ""
		this.loading = false
		this.loadingMore = false
	}
}
