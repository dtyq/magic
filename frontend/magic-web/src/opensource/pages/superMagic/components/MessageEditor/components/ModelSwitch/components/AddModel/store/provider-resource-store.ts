import { makeAutoObservable, runInAction } from "mobx"
import { OrgAiModelProviderApi } from "@/opensource/apis"
import type { ProviderTemplate, ProviderTemplateOption, ServiceProvider } from "../types"
import {
	configToServiceProvider,
	syncServiceProviderWithTemplateName,
	templateToProviderType,
} from "./mappers"

export class ProviderResourceStore {
	serviceProviders: ServiceProvider[] = []

	providerTemplates: ProviderTemplateOption[] = []

	isLoadingProviders = false
	isLoadingTemplates = false

	/** Service providers indexed by category for cross-tab caching */
	serviceProvidersCache: Partial<Record<"llm" | "vlm", ServiceProvider[]>> = {}
	providerTemplatesCache: Partial<Record<"llm" | "vlm", ProviderTemplateOption[]>> = {}
	activeProviderCategory: "llm" | "vlm" | null = null
	activeTemplateCategory: "llm" | "vlm" | null = null

	constructor() {
		makeAutoObservable(this)
	}

	private getProviderTemplateNameMap(category: "llm" | "vlm"): Map<string, string> {
		return new Map(
			(this.providerTemplatesCache[category] ?? []).map((providerTemplate) => [
				providerTemplate.providerCode,
				providerTemplate.name,
			]),
		)
	}

	private syncCachedProvidersWithTemplates(category: "llm" | "vlm") {
		const cachedProviders = this.serviceProvidersCache[category]
		if (!cachedProviders) return
		const providerTemplateNameMap = this.getProviderTemplateNameMap(category)
		const nextProviders = cachedProviders.map((provider) =>
			syncServiceProviderWithTemplateName({
				provider,
				providerTemplateNameMap,
			}),
		)
		this.serviceProvidersCache = {
			...this.serviceProvidersCache,
			[category]: nextProviders,
		}
		if (this.activeProviderCategory === category) this.serviceProviders = nextProviders
	}

	async loadProviders(category: "llm" | "vlm") {
		this.isLoadingProviders = true
		try {
			const list = await OrgAiModelProviderApi.getOrgAiModelProviderList(category)
			const providerTemplateNameMap = this.getProviderTemplateNameMap(category)
			runInAction(() => {
				const providers = (list ?? []).map((config) =>
					configToServiceProvider(config, providerTemplateNameMap),
				)
				this.serviceProviders = providers
				this.activeProviderCategory = category
				this.serviceProvidersCache = {
					...this.serviceProvidersCache,
					[category]: providers,
				}
			})
		} catch {
			runInAction(() => {
				this.serviceProviders = []
			})
		} finally {
			runInAction(() => {
				this.isLoadingProviders = false
			})
		}
	}

	async loadTemplates(category: "llm" | "vlm") {
		this.isLoadingTemplates = true
		try {
			const list = await OrgAiModelProviderApi.getNonOfficialProviderTemplates(category)
			runInAction(() => {
				const providerTemplates = (list ?? []).map((t) =>
					templateToProviderType(t as ProviderTemplate),
				)
				this.providerTemplates = providerTemplates
				this.activeTemplateCategory = category
				this.providerTemplatesCache = {
					...this.providerTemplatesCache,
					[category]: providerTemplates,
				}
				this.syncCachedProvidersWithTemplates(category)
			})
		} catch {
			runInAction(() => {
				this.providerTemplates = []
			})
		} finally {
			runInAction(() => {
				this.isLoadingTemplates = false
			})
		}
	}

	async loadProvidersForModelKey(modelKey: "models" | "image_models"): Promise<void> {
		const category = modelKey === "image_models" ? "vlm" : "llm"
		if (this.serviceProvidersCache[category] !== undefined) return
		await this.loadProviders(category)
	}

	async loadTemplatesForModelKey(modelKey: "models" | "image_models"): Promise<void> {
		const category = modelKey === "image_models" ? "vlm" : "llm"
		if (this.providerTemplatesCache[category] !== undefined) {
			runInAction(() => {
				this.providerTemplates = this.providerTemplatesCache[category] ?? []
				this.activeTemplateCategory = category
			})
			return
		}
		await this.loadTemplates(category)
	}

	getProvidersByModelKey(modelKey: "models" | "image_models"): ServiceProvider[] {
		const category = modelKey === "image_models" ? "vlm" : "llm"
		return this.serviceProvidersCache[category] ?? []
	}

	getTemplatesByModelKey(modelKey: "models" | "image_models"): ProviderTemplateOption[] {
		const category = modelKey === "image_models" ? "vlm" : "llm"
		return this.providerTemplatesCache[category] ?? []
	}

	addProvider(provider: ServiceProvider) {
		this.serviceProviders.push(provider)
	}

	updateProvider(id: string, data: Omit<ServiceProvider, "id">) {
		const index = this.serviceProviders.findIndex((p) => p.id === id)
		if (index !== -1) {
			this.serviceProviders.splice(index, 1, { id, ...data })
		}
	}

	removeProvider(id: string) {
		this.serviceProviders = this.serviceProviders.filter((p) => p.id !== id)
		return id
	}
}
