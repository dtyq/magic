import { makeAutoObservable, runInAction } from "mobx"
import { skillsService } from "@/services/skills/SkillsService"
import type {
	GetSkillsParams,
	ImportSkillParams,
	ParseSkillResponse,
	ImportSkillResponse,
} from "@/apis/modules/skills"
import type { UserSkillView, UserSkillsListScope } from "@/services/skills/SkillsService"
import {
	appendUniqueById,
	beginPageRequest,
	isLatestPageRequest,
	resolveKeywordParam,
	toOptionalKeyword,
} from "@/pages/superMagic/utils/paged-list-store"

const DEFAULT_PAGE_SIZE = 20

export class UserSkillsStore {
	list: UserSkillView[] = []
	total = 0
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	scope: UserSkillsListScope = "created"
	loading = false
	loadingMore = false
	private fetchRequestId = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get hasMore() {
		return this.list.length < this.total
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	async fetchSkills(params: GetSkillsParams = {}, scope: UserSkillsListScope = this.scope) {
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = resolveKeywordParam(params, "")
		const requestId = beginPageRequest({
			page,
			loading: this.loading,
			currentRequestId: this.fetchRequestId,
		})
		if (requestId == null) return

		this.fetchRequestId = requestId
		this.loading = true

		if (page === 1) {
			this.list = []
			this.page = 1
			this.scope = scope
			this.loadingMore = false
		}

		try {
			const data = await this.getSkillsByScope(scope, {
				page,
				page_size: pageSize,
				keyword: toOptionalKeyword(keyword),
				source_type: params.source_type,
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.list = data.list
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.keyword = keyword
				this.scope = scope
				this.loading = false
			})
		} catch (error) {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
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
		const requestId = this.fetchRequestId

		try {
			const data = await this.getSkillsByScope(this.scope, {
				page: nextPage,
				page_size: this.pageSize,
				keyword: toOptionalKeyword(this.keyword),
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.list = appendUniqueById(this.list, data.list)
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.loadingMore = false
			})
		} catch (error) {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loadingMore = false
			})
			throw error
		}
	}

	async deleteCreatedSkill(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target) return

		await skillsService.deleteSkill(target.skillCode)
		this.removeSkillFromList(id)
	}

	async removeInstalledSkill(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target) return

		await skillsService.deleteSkill(target.skillCode)
		this.removeSkillFromList(id)
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
		await this.fetchSkills({ page: 1, keyword: toOptionalKeyword(this.keyword) }, this.scope)
		return result
	}

	reset() {
		this.list = []
		this.total = 0
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.keyword = ""
		this.scope = "created"
		this.loading = false
		this.loadingMore = false
		this.fetchRequestId = 0
	}

	private getSkillsByScope(scope: UserSkillsListScope, params: GetSkillsParams) {
		switch (scope) {
			case "created":
				return skillsService.getCreatedSkills(params)
			case "team-shared":
				return skillsService.getTeamSharedSkills(params)
			case "market-installed":
				return skillsService.getMarketInstalledSkills(params)
			default:
				return skillsService.getUserSkills(params)
		}
	}

	private removeSkillFromList(id: string) {
		runInAction(() => {
			this.list = this.list.filter((item) => item.id !== id)
			this.total = Math.max(0, this.total - 1)
		})
	}
}
