/**
 * StepNavigation组件Props
 */
export interface StepNavigationProps {
	/** 是否显示上一步按钮 */
	showPrevious?: boolean
	/** 是否显示下一步按钮 */
	showNext?: boolean
	/** 下一步按钮文本 */
	nextText?: string
	/** 是否隐藏下一步按钮的箭头图标 */
	hideNextIcon?: boolean
	/** 是否禁用下一步 */
	nextDisabled?: boolean
	/** 是否显示加载状态 */
	nextLoading?: boolean
	/** 点击上一步回调 */
	onPrevious?: () => void
	/** 点击下一步回调 */
	onNext?: () => void
	className?: string
}
