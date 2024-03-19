import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Rocket } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card } from "@/opensource/components/shadcn-ui/card"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { InitializationApi } from "@/opensource/apis"
import type { InitializationData } from "@/opensource/apis/types"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import { usePersistentState } from "./hooks/usePersistentState"
import { clearInitializationState } from "./utils/storage"
import ProgressBar from "./components/ProgressBar"
import StepIndicator from "./components/StepIndicator"
import type { Step1FormData, Step2FormData, Step3FormData } from "./types"
import Step1Account from "./components/Step1Account"
import Step2Provider from "./components/Step2Provider"
import Step3Workers from "./components/Step3Workers"
import LanguageSelect from "@/opensource/layouts/SSOLayout/components/LanguageSelect"

const TOTAL_STEPS = 3

export default function InitializationPage() {
	const { t } = useTranslation("initialization")
	const [searchParams] = useSearchParams()

	const { currentStep, setCurrentStep, formData, setFormData } = usePersistentState()
	const [submitting, setSubmitting] = useState(false)

	const redirectUrl = searchParams.get(LoginValueKey.REDIRECT_URL) || "/"

	const steps = [
		{ number: 1, label: t("steps.step1") },
		{ number: 2, label: t("steps.step2") },
		{ number: 3, label: t("steps.step3") },
	]

	// 步骤1完成处理
	const handleStep1Complete = (data: Step1FormData) => {
		setFormData((prev) => ({ ...prev, step1: data }))
		setCurrentStep(2)
	}

	// 步骤2完成处理
	const handleStep2Complete = (data: Step2FormData) => {
		setFormData((prev) => ({ ...prev, step2: data }))
		setCurrentStep(3)
	}

	// 步骤3完成 - 统一提交所有数据
	const handleFinish = async (step3Data: Step3FormData) => {
		if (!formData.step1 || !formData.step2) {
			console.error("Previous step data is missing")
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

			// 跳转回原页面
			window.location.href = redirectUrl
		} catch (error) {
			console.error("Initialization failed:", error)
			// TODO: 显示错误提示
			alert(t("errors.submitFailed"))
		} finally {
			setSubmitting(false)
		}
	}

	// 返回上一步
	const handlePrevStep = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	return (
		<div className="fixed inset-0 overflow-y-auto bg-background">
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
					<div className="h-15 w-15 flex items-center justify-center rounded-2xl ">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="60"
							height="60"
							viewBox="0 0 60 60"
							fill="none"
						>
							<mask
								id="mask0_13568_110865"
								maskUnits="userSpaceOnUse"
								x="2"
								y="2"
								width="56"
								height="56"
							>
								<path
									d="M56.7424 26.9924C58.8968 48.0806 53.5958 54.588 32.5076 56.7424C11.4193 58.8968 4.91196 53.5958 2.75757 32.5075C0.603176 11.4193 5.90419 4.91192 26.9924 2.75753C48.0807 0.603142 54.588 5.90415 56.7424 26.9924Z"
									fill="#DDEBFF"
								/>
							</mask>
							<g mask="url(#mask0_13568_110865)">
								<path
									d="M56.7424 26.9924C58.8968 48.0806 53.5958 54.588 32.5076 56.7424C11.4193 58.8968 4.91196 53.5958 2.75757 32.5075C0.603176 11.4193 5.90419 4.91192 26.9924 2.75753C48.0807 0.603142 54.588 5.90415 56.7424 26.9924Z"
									fill="#FDE047"
								/>
							</g>
							<path
								d="M14.8751 20.825L14.8829 21.1316C15.0425 24.2752 17.642 26.7752 20.8253 26.7752C24.1112 26.775 26.7745 24.111 26.7745 20.825H32.7247V38.6746H26.7745V31.1287C25.0239 32.1417 22.9933 32.7253 20.8253 32.7254C18.6574 32.7254 16.6256 32.1435 14.8751 31.1307V38.6746H8.92487V20.825H14.8751Z"
								fill="black"
							/>
							<path
								d="M50.575 26.7752H44.6248C42.9819 26.7753 41.6502 28.1069 41.6501 29.7498C41.6501 31.3928 42.9818 32.7253 44.6248 32.7254H50.575V38.6746H44.6248C39.6957 38.6745 35.7 34.6789 35.7 29.7498C35.7001 24.8208 39.6958 20.8251 44.6248 20.825H50.575V26.7752Z"
								fill="black"
							/>
						</svg>
					</div>
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
						href="https://www.letsmagic.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline"
					>
						Website
					</a>

					<Separator orientation="vertical" className="h-5" />

					<a
						href="https://docs.letsmagic.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline"
					>
						Documentation
					</a>

					<Separator orientation="vertical" className="h-5" />

					<a
						href="https://www.letsmagic.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:underline"
					>
						<span>Powered by</span>
						<div className="flex items-center gap-0.5">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="17"
								height="17"
								viewBox="0 0 17 17"
								fill="none"
							>
								<mask
									id="mask0_13568_110948"
									maskUnits="userSpaceOnUse"
									x="0"
									y="0"
									width="17"
									height="17"
								>
									<path
										d="M16.2121 7.71212C16.8277 13.7373 15.3131 15.5966 9.28788 16.2121C3.26266 16.8277 1.40342 15.3131 0.787876 9.28787C0.172336 3.26266 1.68691 1.40341 7.71212 0.787869C13.7373 0.172328 15.5966 1.6869 16.2121 7.71212Z"
										fill="#DDEBFF"
									/>
								</mask>
								<g mask="url(#mask0_13568_110948)">
									<path
										d="M16.2121 7.71212C16.8277 13.7373 15.3131 15.5966 9.28788 16.2121C3.26266 16.8277 1.40342 15.3131 0.787876 9.28787C0.172336 3.26266 1.68691 1.40341 7.71212 0.787869C13.7373 0.172328 15.5966 1.6869 16.2121 7.71212Z"
										fill="#0A0A0A"
									/>
								</g>
								<path
									d="M4.25018 5.95001L4.25897 6.12384C4.34604 6.98106 5.07019 7.65021 5.95038 7.65021C6.88908 7.65 7.6496 6.88877 7.6496 5.95001H9.34979V11.0496H7.6496V8.89337C7.1495 9.18277 6.56972 9.35033 5.95038 9.3504C5.33066 9.3504 4.75051 9.18206 4.25018 8.8924V11.0496H2.54999V5.95001H4.25018Z"
									fill="#FAFAFA"
								/>
								<path
									d="M14.45 7.65021H12.7498C12.2805 7.65031 11.9003 8.03052 11.9002 8.49982C11.9002 8.9692 12.2805 9.3503 12.7498 9.3504H14.45V11.0496H12.7498C11.3416 11.0495 10.2 9.90808 10.2 8.49982C10.2001 7.09165 11.3416 5.95012 12.7498 5.95001H14.45V7.65021Z"
									fill="#FAFAFA"
								/>
							</svg>
							<span className="font-semibold">MagiCrew</span>
						</div>
					</a>
				</div>
			</div>
		</div>
	)
}
