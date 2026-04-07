import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/shadcn-ui/card"
import { Separator } from "@/components/shadcn-ui/separator"
import { Toaster } from "@/components/shadcn-ui/sonner"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { InitializationApi } from "@/apis"
import type { InitializationData } from "@/apis/types"
import { LoginValueKey } from "@/pages/login/constants"
import { usePersistentState } from "./hooks/usePersistentState"
import { clearInitializationState } from "./utils/storage"
import ProgressBar from "./components/ProgressBar"
import StepIndicator from "./components/StepIndicator"
import type { Step1FormData, Step2FormData, Step3FormData } from "./types"
import Step1Account from "./components/Step1Account"
import Step2Provider from "./components/Step2Provider"
import Step3Workers from "./components/Step3Workers"
import LanguageSelect from "@/layouts/SSOLayout/components/LanguageSelect"
import logo from "@/assets/logos/magic-crew.png"

const TOTAL_STEPS = 3
const STEP_PARAM_KEY = "step"

export default function InitializationPage() {
	const { t } = useTranslation("initialization")
	const [searchParams, setSearchParams] = useSearchParams()

	const { currentStep, setCurrentStep, formData, setFormData } = usePersistentState()
	const [submitting, setSubmitting] = useState(false)
	const [showConfigDialog, setShowConfigDialog] = useState(false)
	const [isInitialized, setIsInitialized] = useState(false)

	const redirectUrl = searchParams.get(LoginValueKey.REDIRECT_URL) || "/"

	// 初始化时从 URL 读取步骤，优先级高于 sessionStorage
	useEffect(() => {
		const stepFromUrl = searchParams.get(STEP_PARAM_KEY)
		if (stepFromUrl) {
			const step = parseInt(stepFromUrl, 10)
			if (step >= 1 && step <= TOTAL_STEPS) {
				setCurrentStep(step)
			}
		} else {
			// 如果 URL 没有步骤参数，同步当前步骤到 URL（使用 replace 避免产生历史记录）
			setSearchParams(
				(prev) => {
					prev.set(STEP_PARAM_KEY, currentStep.toString())
					return prev
				},
				{ replace: true },
			)
		}
		setIsInitialized(true)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 更新 URL 中的步骤参数（用于用户操作，创建历史记录）
	const updateUrlStep = (step: number) => {
		setSearchParams((prev) => {
			prev.set(STEP_PARAM_KEY, step.toString())
			return prev
		})
	}

	// 监听 URL 变化，同步到状态（支持浏览器前进后退）
	useEffect(() => {
		if (!isInitialized) return

		const stepFromUrl = searchParams.get(STEP_PARAM_KEY)
		if (stepFromUrl) {
			const step = parseInt(stepFromUrl, 10)
			if (step >= 1 && step <= TOTAL_STEPS && step !== currentStep) {
				setCurrentStep(step)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams, isInitialized])

	const steps = [
		{ number: 1, label: t("steps.step1") },
		{ number: 2, label: t("steps.step2") },
		{ number: 3, label: t("steps.step3") },
	]

	// 步骤1完成处理
	const handleStep1Complete = (data: Step1FormData) => {
		setFormData((prev) => ({ ...prev, step1: data }))
		setCurrentStep(2)
		updateUrlStep(2)
	}

	// 步骤2完成处理
	const handleStep2Complete = (data: Step2FormData) => {
		setFormData((prev) => ({ ...prev, step2: data }))
		setCurrentStep(3)
		updateUrlStep(3)
	}

	// 步骤3完成 - 统一提交所有数据
	const handleFinish = async (step3Data: Step3FormData) => {
		if (!formData.step1 || !formData.step2) {
			console.error("Previous step data is missing")
			toast.error(t("errors.missingPreviousSteps"))
			// 引导用户回到第一步
			setTimeout(() => {
				setCurrentStep(1)
				updateUrlStep(1)
			}, 1500)
			return
		}

		// 转换为后端要求的数据格式
		const finalData: InitializationData = {
			admin_account: {
				phone: formData.step1.phone,
				password: formData.step1.password,
			},
			agent_info: {
				name: formData.step1.name,
				description: formData.step1.description,
			},
			service_provider_model: formData.step2,
			select_official_agents_codes: step3Data.select_official_agents_codes,
		}

		console.log("🚀 初始化配置参数:", finalData)

		try {
			setSubmitting(true)
			await InitializationApi.submitInitialization(finalData)

			// 提交成功后清除 sessionStorage
			clearInitializationState()

			// 显示配置提示对话框
			setShowConfigDialog(true)
		} catch (error) {
			console.error("Initialization failed:", error)
			const errorMessage =
				error && typeof error === "object" && "message" in error
					? (error as { message: string }).message
					: t("errors.submitFailed")
			toast.error(errorMessage)
		} finally {
			setSubmitting(false)
		}
	}

	// 前往配置页面
	const handleGoToConfig = () => {
		window.open("/admin/platform/agent/capability", "_blank")
	}

	// 跳过配置，执行正常流程
	const handleSkipConfig = () => {
		setShowConfigDialog(false)
		setTimeout(() => {
			window.location.href = redirectUrl
		}, 500)
	}

	// 返回上一步
	const handlePrevStep = () => {
		if (currentStep > 1) {
			const prevStep = currentStep - 1
			setCurrentStep(prevStep)
			updateUrlStep(prevStep)
		}
	}

	return (
		<div className="fixed inset-0 overflow-y-auto bg-background">
			<Toaster position="top-center" />

			{/* Language Switch - 右上角 */}
			<div className="absolute right-6 top-6">
				<LanguageSelect />
			</div>

			<div className="mx-auto w-full max-w-4xl px-6 py-12 pb-12">
				{/* Header */}
				<div className="mb-8 flex items-center justify-center gap-2">
					<div className="flex items-center justify-center gap-2">
						<span className="text-5xl font-semibold tracking-tight text-foreground">
							{t("welcomeTo")}
						</span>
					</div>
					<img src={logo} alt="logo" className="h-15 w-15 rounded-2xl" />
					<h1 className="text-5xl font-semibold tracking-tight text-foreground">
						{t("title")}
					</h1>
				</div>

				{/* Progress Bar */}
				<ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} className="mb-8" />

				{/* Step Indicator */}
				<StepIndicator steps={steps} currentStep={currentStep} className="mb-12" />

				{/* Form Card */}
				<Card className="rounded-xl border border-border bg-card p-8 shadow-sm">
					{currentStep === 1 && (
						<Step1Account
							initialData={formData.step1}
							onComplete={handleStep1Complete}
						/>
					)}

					{currentStep === 2 && (
						<Step2Provider
							initialData={formData.step2}
							onComplete={handleStep2Complete}
							onBack={handlePrevStep}
						/>
					)}

					{currentStep === 3 && (
						<Step3Workers
							initialData={formData.step3}
							onComplete={handleFinish}
							onBack={handlePrevStep}
							submitting={submitting}
						/>
					)}
				</Card>

				{/* Footer */}
				<div className="mt-8 flex items-center justify-center gap-5 text-sm text-foreground">
					<a
						href="https://www.magicrew.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline"
					>
						Website
					</a>

					<Separator orientation="vertical" className="h-5" />

					<a
						href="https://docs.magicrew.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline"
					>
						Documentation
					</a>

					<Separator orientation="vertical" className="h-5" />

					<a
						href="https://www.magicrew.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:underline"
					>
						<span>Powered by</span>
						<div className="flex items-center gap-0.5">
							<img src={logo} alt="logo" className="h-[17px] w-[17px] rounded-2xl" />
							<span className="font-semibold">MagiCrew</span>
						</div>
					</a>
				</div>
			</div>

			{/* 配置提示对话框 */}
			<AlertDialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
								<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500" />
							</div>
							<div className="flex-1">
								<AlertDialogTitle className="text-xl">
									{t("configDialog.title")}
								</AlertDialogTitle>
							</div>
						</div>
						<AlertDialogDescription className="pt-2">
							{t("configDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleSkipConfig}>
							{t("configDialog.skip")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleGoToConfig}>
							{t("configDialog.goToConfig")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
