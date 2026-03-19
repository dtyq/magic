import type {
	InitializationAdminAccount,
	InitializationAgentInfo,
	InitializationServiceProviderModel,
} from "@/apis/types"

/** 初始化流程 - 步骤1表单数据 */
export interface Step1FormData extends InitializationAdminAccount, InitializationAgentInfo { }

/** 初始化流程 - 步骤2表单数据 */
export type Step2FormData = InitializationServiceProviderModel

/** 初始化流程 - 步骤3表单数据 */
export interface Step3FormData {
	select_official_agents_codes: string[]
}

/** 初始化流程状态 */
export interface InitializationState {
	currentStep: number
	formData: {
		step1?: Step1FormData
		step2?: Step2FormData
		step3?: Step3FormData
	}
}

/** 步骤组件通用Props */
export interface StepComponentProps<T> {
	initialData?: T
	onComplete: (data: T) => void
	onBack?: () => void
}
