import { useState, useEffect } from "react"
import { saveInitializationState, loadInitializationState } from "../utils/storage"
import type { InitializationState } from "../types"

/**
 * 持久化状态 Hook
 * 自动保存和恢复初始化流程的状态
 */
export function usePersistentState() {
	const [currentStep, setCurrentStep] = useState(1)
	const [formData, setFormData] = useState<InitializationState["formData"]>({})

	// 页面加载时恢复状态
	useEffect(() => {
		const savedState = loadInitializationState()
		if (savedState) {
			setCurrentStep(savedState.currentStep)
			setFormData(savedState.formData)
		}
	}, [])

	// 状态变化时自动保存
	useEffect(() => {
		saveInitializationState({ currentStep, formData })
	}, [currentStep, formData])

	return {
		currentStep,
		setCurrentStep,
		formData,
		setFormData,
	}
}
