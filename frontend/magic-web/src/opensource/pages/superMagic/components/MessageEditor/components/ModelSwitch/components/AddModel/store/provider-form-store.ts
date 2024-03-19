import { makeAutoObservable } from "mobx"
import type { ServiceProvider } from "../types"

export interface ProviderTemplateLike {
	id: string
	name: string
	icon: string
	providerCode: string
	fields: { key: string }[]
}

export class ProviderFormStore {
	selectedProviderTypeId = ""

	providerFields: Record<string, string> = {}

	editingProviderId: string | null = null
	editingProvider: ServiceProvider | null = null

	constructor() {
		makeAutoObservable(this)
	}

	getProviderTypeForValidation(
		providerTemplates: ProviderTemplateLike[],
	): ProviderTemplateLike | null {
		return (
			providerTemplates.find(
				(p) =>
					p.id === this.selectedProviderTypeId ||
					p.providerCode === this.selectedProviderTypeId,
			) ?? null
		)
	}

	openAddForm() {
		this.editingProviderId = null
		this.editingProvider = null
		this.resetForm()
	}

	openEditProvider(id: string, provider: ServiceProvider) {
		this.editingProviderId = id
		this.editingProvider = provider
		this.selectedProviderTypeId = provider.providerTypeId
		this.providerFields = { ...(provider.fields ?? {}) }
	}

	closeEditForm() {
		this.editingProviderId = null
		this.editingProvider = null
		this.resetForm()
	}

	closeAddForm() {
		this.editingProviderId = null
		this.resetForm()
	}

	setSelectedProviderTypeId(id: string) {
		if (this.selectedProviderTypeId === id) {
			this.selectedProviderTypeId = ""
			this.providerFields = {}
			return
		}
		this.selectedProviderTypeId = id
		this.providerFields = {}
	}

	setProviderField(key: string, value: string) {
		this.providerFields = { ...this.providerFields, [key]: value }
	}

	resetForm() {
		this.selectedProviderTypeId = ""
		this.providerFields = {}
	}
}
