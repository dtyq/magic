import { makeAutoObservable, runInAction } from "mobx"
// import { makePersistable } from "mobx-persist-store"
import { DOCUMENT_TYPES, type DocumentType, STEP_CONFIGS } from "../constants"
import { LocalDocumentStore } from "./local-document-store"
import { CustomContentStore } from "./custom-content-store"
import { ProjectDocumentStore } from "./project-document-store"
import { WikiDocumentStore } from "./wiki-document-store"

/**
 * 文档创建主Store
 * 负责整体流程控制和状态持久化
 */
export class DocumentCreateStore {
	// 基础状态
	documentType: DocumentType | null = null
	knowledgeCode: string | null = null
	currentStep = 1
	editMode = false // 是否为编辑模式
	editDocumentCode: string | null = null // 编辑模式下的文档代码

	// 子Store实例
	localDocumentStore: LocalDocumentStore
	customContentStore: CustomContentStore
	projectDocumentStore: ProjectDocumentStore
	wikiDocumentStore: WikiDocumentStore

	constructor(knowledgeCode: string, editMode = false, editDocumentCode: string | null = null) {
		this.knowledgeCode = knowledgeCode
		this.editMode = editMode
		this.editDocumentCode = editDocumentCode

		// 初始化子Store，传递knowledgeCode用于持久化
		this.localDocumentStore = new LocalDocumentStore(knowledgeCode)
		this.customContentStore = new CustomContentStore(knowledgeCode)
		this.projectDocumentStore = new ProjectDocumentStore()
		this.wikiDocumentStore = new WikiDocumentStore()

		makeAutoObservable(
			this,
			{
				localDocumentStore: false,
				customContentStore: false,
				projectDocumentStore: false,
				wikiDocumentStore: false,
			},
			{ autoBind: true },
		)

		// 持久化配置 - 使用sessionStorage（会话级别，关闭标签页清除）
		// makePersistable(this, {
		// 	name: `DocumentCreateStore_${knowledgeCode}`,
		// 	properties: ["documentType", "currentStep"],
		// 	storage: window.sessionStorage,
		// })
	}

	/**
	 * 设置文档类型
	 */
	setDocumentType(type: DocumentType) {
		this.documentType = type
		this.currentStep = 1
	}

	/**
	 * 进入下一步
	 */
	nextStep() {
		if (this.canGoNext()) {
			this.currentStep++
		}
	}

	/**
	 * 返回上一步
	 */
	previousStep() {
		if (this.currentStep > 1) {
			this.currentStep--
		}
	}

	/**
	 * 跳转到指定步骤
	 */
	goToStep(step: number) {
		const totalSteps = this.getTotalSteps()
		if (step >= 1 && step <= totalSteps) {
			this.currentStep = step
		}
	}

	/**
	 * 获取总步骤数
	 */
	getTotalSteps(): number {
		if (!this.documentType) return 0
		const totalSteps = STEP_CONFIGS[this.documentType].length
		// 编辑模式下，步骤数减1（跳过第一步）
		return this.editMode ? totalSteps - 1 : totalSteps
	}

	/**
	 * 判断是否可以返回上一步
	 * 编辑模式下，第一步不能返回
	 */
	canGoPrevious(): boolean {
		if (this.editMode && this.currentStep === 1) {
			return false
		}
		return this.currentStep > 1
	}

	/**
	 * 获取当前步骤配置
	 */
	getCurrentStepConfig() {
		if (!this.documentType) return null
		return STEP_CONFIGS[this.documentType].find((s) => s.number === this.currentStep)
	}

	/**
	 * 获取所有步骤配置
	 * 编辑模式下会跳过第一步（上传文件/输入文本）
	 */
	getAllStepConfigs() {
		if (!this.documentType) return []
		const allSteps = STEP_CONFIGS[this.documentType]

		// 编辑模式下，跳过第一步，重新编号
		if (this.editMode) {
			return allSteps.slice(1).map((step, index) => ({
				...step,
				number: index + 1, // 重新编号从 1 开始
			}))
		}

		return allSteps
	}

	/**
	 * 检查是否可以进入下一步
	 */
	canGoNext(): boolean {
		if (!this.documentType) return false

		// 编辑模式下，实际步骤号需要 +1（因为跳过了第一步）
		const actualStep = this.editMode ? this.currentStep + 1 : this.currentStep

		switch (this.documentType) {
			case DOCUMENT_TYPES.LOCAL:
				return this.localDocumentStore.canGoNext(actualStep)
			case DOCUMENT_TYPES.CUSTOM:
				return this.customContentStore.canGoNext(actualStep)
			case DOCUMENT_TYPES.PROJECT:
				return this.projectDocumentStore.canGoNext(actualStep)
			case DOCUMENT_TYPES.WIKI:
				return this.wikiDocumentStore.canGoNext(actualStep)
			default:
				return false
		}
	}

	/**
	 * 检查是否是第一步
	 */
	get isFirstStep(): boolean {
		return this.currentStep === 1
	}

	/**
	 * 检查是否是最后一步
	 */
	get isLastStep(): boolean {
		return this.currentStep === this.getTotalSteps()
	}

	/**
	 * 获取当前激活的子Store
	 */
	get activeStore():
		| LocalDocumentStore
		| CustomContentStore
		| ProjectDocumentStore
		| WikiDocumentStore
		| null {
		if (!this.documentType) return null

		switch (this.documentType) {
			case DOCUMENT_TYPES.LOCAL:
				return this.localDocumentStore
			case DOCUMENT_TYPES.CUSTOM:
				return this.customContentStore
			case DOCUMENT_TYPES.PROJECT:
				return this.projectDocumentStore
			case DOCUMENT_TYPES.WIKI:
				return this.wikiDocumentStore
			default:
				return null
		}
	}

	/**
	 * 重置所有状态
	 */
	reset() {
		this.documentType = null
		this.currentStep = 1
		this.localDocumentStore.reset()
		this.customContentStore.reset()
		this.projectDocumentStore.reset()
		this.wikiDocumentStore.reset()
	}

	/**
	 * 清除持久化数据
	 */
	clearPersistence() {
		if (this.knowledgeCode) {
			window.sessionStorage.removeItem(`DocumentCreateStore_${this.knowledgeCode}`)
		}
	}
}
