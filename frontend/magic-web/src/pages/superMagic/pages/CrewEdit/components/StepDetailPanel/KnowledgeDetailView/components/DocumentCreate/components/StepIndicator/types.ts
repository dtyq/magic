/**
 * 步骤状态类型
 */
export type StepStatus = "current" | "pending" | "completed"

/**
 * 步骤配置接口
 */
export interface Step {
	number: number
	i18nKey: string
	status: StepStatus
}

/**
 * StepIndicator组件Props
 */
export interface StepIndicatorProps {
	steps: Step[]
	className?: string
}
