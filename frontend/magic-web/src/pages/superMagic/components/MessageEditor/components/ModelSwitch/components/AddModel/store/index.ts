import { makeAutoObservable, runInAction } from "mobx"
import { OrgAiModelProviderApi } from "@/apis"
import type { SaveAiModelParams } from "@/apis/modules/org-ai-model-provider"
import type { LlmModelItem } from "@/apis/modules/superMagic"
import type {
	ModelInfo,
	ProviderFieldConfig,
	ProviderTemplateOption,
	ServiceProvider,
} from "../types"
import { validateProviderFieldValue, normalizeProviderFieldKey } from "../providerFieldConfigs"
import { ModelFormStore } from "./model-form-store"
import { ProviderFormStore } from "./provider-form-store"
import { ProviderResourceStore } from "./provider-resource-store"
import { MyModelsStore } from "./my-models-store"

export type AddModelType = "text" | "image"

interface ConfirmDeleteModelOptions {
	onSuccess?: () => Promise<void> | void
}

const CATEGORY_MAP: Record<AddModelType, "llm" | "vlm"> = {
	text: "llm",
	image: "vlm",
}

export function buildMatchedModelConfig(
	model: LlmModelItem,
): NonNullable<SaveAiModelParams["config"]> {
	return {
		max_tokens: model.max_context_tokens,
		support_function: model.capabilities.tool_call,
		support_multi_modal: model.capabilities.vision,
		support_deep_think: model.capabilities.deep_thinking,
	}
}

export class AddModelStore {
	modelForm: ModelFormStore
	providerForm: ProviderFormStore
	providerResource: ProviderResourceStore
	myModelsStore: MyModelsStore

	isAddModelOpen = false
	isAddProviderOpen = false
	isEditProviderOpen = false
	isEditModelOpen = false
	deletingProviderId: string | null = null

	isSubmitting = false
	isLoadingEditModelDetail = false

	constructor() {
		this.modelForm = new ModelFormStore()
		this.providerForm = new ProviderFormStore()
		this.providerResource = new ProviderResourceStore()
		this.myModelsStore = new MyModelsStore()
		makeAutoObservable(this)
	}

	get addModelType(): AddModelType {
		return this.modelForm.addModelType
	}
	get selectedProviderId(): string {
		return this.modelForm.selectedProviderId
	}
	get providerModelId(): string {
		return this.modelForm.providerModelId
	}
	get modelName(): string {
		return this.modelForm.modelName
	}
	get modelConfig(): NonNullable<SaveAiModelParams["config"]> {
		return this.modelForm.modelConfig
	}
	get editingModel(): ModelInfo | null {
		return this.modelForm.editingModel
	}
	get category(): "llm" | "vlm" {
		return this.modelForm.category
	}
	get modelType(): number {
		return this.modelForm.modelType
	}
	get isAddModelFormValid(): boolean {
		return this.modelForm.isFormValid
	}

	get selectedProviderTypeId(): string {
		return this.providerForm.selectedProviderTypeId
	}
	get providerFields(): Record<string, string> {
		return this.providerForm.providerFields
	}
	get editingProviderId(): string | null {
		return this.providerForm.editingProviderId
	}
	get editingProvider(): ServiceProvider | null {
		return this.providerForm.editingProvider
	}
	get providerTypeForValidation(): {
		id: string
		name: string
		icon: string
		providerCode: string
		fields: ProviderFieldConfig[]
	} | null {
		const pt = this.providerForm.getProviderTypeForValidation(
			this.providerResource.providerTemplates,
		)
		return pt as {
			id: string
			name: string
			icon: string
			providerCode: string
			fields: ProviderFieldConfig[]
		} | null
	}
	get isAddProviderFormValid(): boolean {
		if (!this.providerForm.selectedProviderTypeId) return false
		const providerType = this.providerTypeForValidation
		if (!providerType) return false
		return providerType.fields.every(
			(field) =>
				validateProviderFieldValue(field, this.providerForm.providerFields[field.key]) ===
				null,
		)
	}
	get providerFieldErrors(): Record<string, boolean> {
		const errors: Record<string, boolean> = {}
		const providerType = this.providerTypeForValidation
		if (!providerType) return errors
		for (const field of providerType.fields) {
			errors[field.key] =
				validateProviderFieldValue(field, this.providerForm.providerFields[field.key]) !==
				null
		}
		return errors
	}

	get serviceProviders(): ServiceProvider[] {
		return this.providerResource.serviceProviders
	}
	get providerTemplates(): ProviderTemplateOption[] {
		return this.providerResource.providerTemplates
	}
	get providerTemplatesCache(): Partial<Record<"llm" | "vlm", ProviderTemplateOption[]>> {
		return this.providerResource.providerTemplatesCache
	}
	get isLoadingProviders(): boolean {
		return this.providerResource.isLoadingProviders
	}
	get isLoadingTemplates(): boolean {
		return this.providerResource.isLoadingTemplates
	}
	get serviceProvidersCache(): Partial<Record<"llm" | "vlm", ServiceProvider[]>> {
		return this.providerResource.serviceProvidersCache
	}

	get myModels() {
		return this.myModelsStore.myModels
	}
	get isLoadingMyModels(): boolean {
		return this.myModelsStore.isLoadingMyModels
	}
	get deletingModelId(): string | null {
		return this.myModelsStore.deletingModelId
	}

	openAddModel = (modelType: AddModelType = "text") => {
		this.modelForm.addModelType = modelType
		this.modelForm.resetForm()
		this.isAddModelOpen = true
	}

	closeAddModel = () => {
		this.isAddModelOpen = false
		this.modelForm.resetForm()
	}

	private syncSelectedProvider(preferredProviderId?: string) {
		const providers = this.providerResource.serviceProviders
		if (providers.length === 0) {
			this.modelForm.setSelectedProviderId("")
			return
		}

		if (
			preferredProviderId &&
			providers.some((provider) => provider.id === preferredProviderId)
		) {
			this.modelForm.setSelectedProviderId(preferredProviderId)
			return
		}

		if (providers.some((provider) => provider.id === this.modelForm.selectedProviderId)) return

		this.modelForm.setSelectedProviderId(providers[0].id)
	}

	openAddProvider = () => {
		this.providerForm.openAddForm()
		this.isAddProviderOpen = true
	}

	openEditProvider = (id: string) => {
		const provider = this.providerResource.serviceProviders.find((p) => p.id === id)
		if (!provider) return
		this.providerForm.openEditProvider(id, provider)
		this.isEditProviderOpen = true
	}

	closeEditProvider = () => {
		this.isEditProviderOpen = false
		this.providerForm.closeEditForm()
	}

	closeAddProvider = () => {
		this.isAddProviderOpen = false
		this.providerForm.closeAddForm()
	}

	openDeleteProvider = (id: string) => {
		this.deletingProviderId = id
	}

	closeDeleteProvider = () => {
		this.deletingProviderId = null
	}

	confirmDeleteProvider = async () => {
		const id = this.deletingProviderId
		if (!id) return
		await this.submitDeleteOrgAiModelProvider(id)
		runInAction(() => {
			this.deletingProviderId = null
		})
	}

	openEditModel = (model: ModelInfo) => {
		this.modelForm.openEditModel(model)
		this.isEditModelOpen = true
	}

	closeEditModel = () => {
		this.isEditModelOpen = false
		this.modelForm.closeEditModel()
	}

	setAddModelType = (type: AddModelType) => {
		const prev = this.modelForm.addModelType
		this.modelForm.setAddModelType(type)
		if (prev !== type) {
			void this.loadOrgAiModelProviders(CATEGORY_MAP[type])
		}
	}

	setSelectedProviderId = (id: string) => {
		this.modelForm.setSelectedProviderId(id)
	}

	setProviderModelId = (value: string) => {
		this.modelForm.setProviderModelId(value)
	}

	setModelName = (value: string) => {
		this.modelForm.setModelName(value)
	}

	setModelConfig = (value: NonNullable<SaveAiModelParams["config"]>) => {
		this.modelForm.setModelConfig(value)
	}

	clearModelConfig = () => {
		this.modelForm.clearModelConfig()
	}

	setSelectedProviderTypeId = (id: string) => {
		this.providerForm.setSelectedProviderTypeId(id)
	}

	setProviderField = (key: string, value: string) => {
		this.providerForm.setProviderField(key, value)
	}

	addServiceProvider = (provider: ServiceProvider) => {
		this.providerResource.addProvider(provider)
	}

	updateServiceProvider = (id: string, data: Omit<ServiceProvider, "id">) => {
		this.providerResource.updateProvider(id, data)
	}

	removeServiceProvider = (id: string) => {
		this.providerResource.removeProvider(id)
		this.syncSelectedProvider()
	}

	loadOrgAiModelProviders = async (category: "llm" | "vlm") => {
		await this.providerResource.loadProviders(category)
		runInAction(() => {
			this.syncSelectedProvider()
		})
	}

	loadEditModelDetail = async (): Promise<boolean> => {
		const modelId = this.modelForm.editingModel?.id
		if (!modelId) return false
		try {
			this.isLoadingEditModelDetail = true
			const detail = await OrgAiModelProviderApi.getOrgAiModelDetail(modelId)
			if (detail) {
				runInAction(() => {
					this.modelForm.applyEditModelDetail(detail)
				})
				return true
			}
		} catch {
			// Fallback to list data if API fails (e.g. endpoint not deployed yet)
			return false
		} finally {
			runInAction(() => {
				this.isLoadingEditModelDetail = false
			})
		}
		return false
	}

	loadServiceProvidersForModelKey = async (
		modelKey: "models" | "image_models",
	): Promise<void> => {
		await this.providerResource.loadProvidersForModelKey(modelKey)
	}

	loadProviderTemplatesForModelKey = async (
		modelKey: "models" | "image_models",
	): Promise<void> => {
		await this.providerResource.loadTemplatesForModelKey(modelKey)
	}

	getServiceProvidersByModelKey(modelKey: "models" | "image_models"): ServiceProvider[] {
		return this.providerResource.getProvidersByModelKey(modelKey)
	}

	getProviderTemplatesByModelKey(modelKey: "models" | "image_models"): ProviderTemplateOption[] {
		return this.providerResource.getTemplatesByModelKey(modelKey)
	}

	loadOrgAiModelProviderTemplates = async (category: "llm" | "vlm") => {
		await this.providerResource.loadTemplates(category)
	}

	buildProviderConfigByTemplate(
		providerType: NonNullable<AddModelStore["providerTypeForValidation"]>,
	): Record<string, string> {
		const config: Record<string, string> = {}
		for (const field of providerType.fields) {
			if (field.key === "alias") continue
			const value = this.providerForm.providerFields[field.key]
			if (value != null) config[normalizeProviderFieldKey(field.key)] = String(value)
		}
		return config
	}

	submitAddOrgAiModelProvider = async (): Promise<boolean> => {
		if (!this.providerForm.selectedProviderTypeId) return false
		const providerType = this.providerTypeForValidation
		if (!providerType || !this.isAddProviderFormValid) return false
		const alias = this.providerForm.providerFields.alias || providerType.name
		const config = this.buildProviderConfigByTemplate(providerType)
		try {
			this.isSubmitting = true
			const result = await OrgAiModelProviderApi.addOrgAiModelProvider({
				service_provider_id: this.providerForm.selectedProviderTypeId,
				alias,
				config,
				category: this.category,
			})
			await this.providerResource.loadProviders(this.category)
			runInAction(() => {
				this.syncSelectedProvider(result?.id)
				this.closeAddProvider()
			})
			return true
		} catch {
			return false
		} finally {
			runInAction(() => {
				this.isSubmitting = false
			})
		}
	}

	submitUpdateOrgAiModelProvider = async (): Promise<boolean> => {
		if (!this.providerForm.editingProviderId || !this.providerForm.editingProvider) return false
		const providerType = this.providerTypeForValidation
		if (!providerType || !this.isAddProviderFormValid) return false
		const alias = this.providerForm.providerFields.alias
		const config = this.buildProviderConfigByTemplate(providerType)
		try {
			this.isSubmitting = true
			await OrgAiModelProviderApi.updateOrgAiModelProvider({
				id: this.providerForm.editingProviderId,
				alias,
				config,
			})
			await this.providerResource.loadProviders(this.category)
			this.closeEditProvider()
			return true
		} catch {
			return false
		} finally {
			runInAction(() => {
				this.isSubmitting = false
			})
		}
	}

	submitDeleteOrgAiModelProvider = async (id: string): Promise<boolean> => {
		try {
			this.isSubmitting = true
			await OrgAiModelProviderApi.deleteOrgAiModelProvider(id)
			runInAction(() => {
				this.providerResource.removeProvider(id)
				if (this.deletingProviderId === id) this.deletingProviderId = null
				if (this.modelForm.selectedProviderId === id) {
					this.modelForm.setSelectedProviderId("")
				}
			})
			await this.providerResource.loadProviders(this.category)
			return true
		} catch {
			return false
		} finally {
			runInAction(() => {
				this.isSubmitting = false
			})
		}
	}

	submitSaveAiModel = async (): Promise<ModelInfo | null> => {
		if (!this.isAddModelFormValid) return null
		try {
			this.isSubmitting = true
			const result = await OrgAiModelProviderApi.saveAiModel({
				service_provider_config_id: this.modelForm.selectedProviderId,
				model_version: this.modelForm.providerModelId.trim(),
				name: this.modelForm.modelName.trim() || undefined,
				model_type: this.modelForm.modelType,
				config: this.modelForm.modelConfig,
			})
			runInAction(() => {
				this.closeAddModel()
			})
			return result ?? null
		} catch {
			return null
		} finally {
			runInAction(() => {
				this.isSubmitting = false
			})
		}
	}

	submitUpdateAiModel = async (): Promise<ModelInfo | null> => {
		if (!this.modelForm.editingModel || !this.isAddModelFormValid) return null
		try {
			this.isSubmitting = true
			const result = await OrgAiModelProviderApi.saveAiModel({
				id: this.modelForm.editingModel.id,
				service_provider_config_id: this.modelForm.selectedProviderId,
				model_version: this.modelForm.providerModelId.trim(),
				name: this.modelForm.modelName.trim() || undefined,
				model_type: this.modelForm.modelType,
			})
			runInAction(() => {
				this.closeEditModel()
			})
			return result ?? null
		} catch {
			return null
		} finally {
			runInAction(() => {
				this.isSubmitting = false
			})
		}
	}

	openDeleteModel = (modelId: string) => {
		this.myModelsStore.openDeleteModel(modelId)
	}

	closeDeleteModel = () => {
		this.myModelsStore.closeDeleteModel()
	}

	confirmDeleteModel = async ({
		onSuccess,
	}: ConfirmDeleteModelOptions = {}): Promise<boolean> => {
		const id = this.myModelsStore.deletingModelId
		if (!id) return false
		const isDeleted = await this.submitDeleteAiModel(id)
		if (isDeleted) await onSuccess?.()
		runInAction(() => {
			this.myModelsStore.closeDeleteModel()
		})
		return isDeleted
	}

	submitDeleteAiModel = async (modelId: string): Promise<boolean> => {
		try {
			this.isSubmitting = true
			await OrgAiModelProviderApi.deleteAiModel(modelId)
			await this.myModelsStore.loadMyModels()
			return true
		} catch {
			return false
		} finally {
			runInAction(() => {
				this.isSubmitting = false
			})
		}
	}

	loadMyModels = async () => {
		await this.myModelsStore.loadMyModels()
	}
}
