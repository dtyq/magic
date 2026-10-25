import { Fragment } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/utils/cn"
import { STEPS } from "../constants"
import StepHero from "./StepHero"

interface StepIndicatorProps {
	currentStep: number
	onNavigate: (step: number) => void
	compact?: boolean
}

export default function StepIndicator({
	currentStep,
	onNavigate,
	compact = false,
}: StepIndicatorProps) {
	const { t } = useTranslation("super")
	const reduceMotion = useReducedMotion()
	const getShortStepLabel = (index: number) => {
		const step = STEPS[index]
		if (step.key === "brand") {
			return t("detail.selfMedia.initPanel.nav.stepShortBrand", "定位")
		}
		if (step.key === "topics") {
			return t("detail.selfMedia.initPanel.nav.stepShortTopics", "选题")
		}
		return t("detail.selfMedia.initPanel.nav.stepShortConfirm", "确认")
	}
	const getStepLabel = (index: number) => {
		const title = t(STEPS[index].titleKey)
		if (index === currentStep) {
			return t("detail.selfMedia.initPanel.nav.stepCurrent", {
				title,
				defaultValue: "当前步骤：{{title}}",
			})
		}
		if (index < currentStep) {
			return t("detail.selfMedia.initPanel.nav.stepCompleted", {
				title,
				defaultValue: "已完成：{{title}}",
			})
		}
		return t("detail.selfMedia.initPanel.nav.stepUpcoming", {
			title,
			defaultValue: "待完成：{{title}}",
		})
	}
	const getGuideTitle = () => {
		const stepKey = STEPS[currentStep]?.key ?? "brand"
		const fallback = {
			brand: "先定准人设，让内容一开口就像你",
			topics: "把灵感打磨成值得点开的选题",
			confirm: "确认节奏，让整套内容准备好出发",
		}
		return t(`detail.selfMedia.initPanel.stepHero.${stepKey}.title`, fallback[stepKey])
	}

	return (
		<div
			className={cn(
				"relative isolate shrink-0 overflow-visible border-b px-4 sm:px-6",
				"transition-[border-color,padding,opacity] duration-300 ease-out",
				compact
					? "border-[#18181b]/[0.08] pb-1.5 pt-2.5"
					: "border-transparent pb-16 pt-11 sm:pb-20 sm:pt-12",
			)}
			data-testid="self-media-init-panel-header"
			data-compact={compact ? "true" : undefined}
			data-self-media-motion="step-indicator"
		>
			<StepHero currentStep={currentStep} compact={compact} />
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-x-0 z-[1] bg-gradient-to-b from-[#f8f8f9]/0 via-[#f8f8f9]/80 to-[#f8f8f9] backdrop-blur-[1px] transition-[bottom,top,height,opacity] duration-300 ease-out",
					compact ? "-bottom-5 h-7 opacity-70" : "top-[300px] h-28 opacity-100",
				)}
				data-testid="self-media-step-hero-transition"
			/>

			<div
				className={cn(
					"relative z-10 flex max-w-full flex-col transition-[gap] duration-300 ease-out",
					compact
						? "gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
						: "gap-4",
				)}
			>
				<motion.h2
					key={currentStep}
					className={cn(
						"tracking-normal transition-[font-size,line-height,max-width] duration-300 ease-out",
						compact
							? "min-w-0 max-w-[320px] truncate text-xs font-medium leading-5 text-zinc-500 sm:order-2 sm:max-w-[360px] sm:text-right sm:text-[13px]"
							: "max-w-[760px] text-[28px] font-[820] leading-[1.1] text-[#09090b] sm:text-[40px]",
					)}
					data-testid="self-media-step-guide-title"
					initial={reduceMotion ? false : { opacity: 0, y: compact ? 0 : 4 }}
					animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
				>
					{getGuideTitle()}
				</motion.h2>
				<div
					className={cn(
						"static flex items-center gap-1.5",
						compact && "sm:order-1 sm:shrink-0",
					)}
					data-testid="self-media-step-track"
				>
					<span className="mr-1 text-[10px] font-semibold text-[#71717a]">
						{t("detail.selfMedia.initPanel.nav.stepPosition", {
							index: currentStep + 1,
							total: STEPS.length,
							defaultValue: "第 {{index}} 步，共 {{total}} 步",
						})}
					</span>
					{STEPS.map((step, index) => {
						const isActive = index === currentStep
						const isCompleted = index < currentStep
						const isFutureStep = index > currentStep

						return (
							<Fragment key={step.key}>
								<motion.button
									type="button"
									aria-current={isActive ? "step" : undefined}
									aria-label={getStepLabel(index)}
									title={getStepLabel(index)}
									disabled={isFutureStep}
									data-self-media-motion="step-indicator-item"
									data-self-media-active={isActive ? "true" : undefined}
									className={cn(
										"group relative flex h-7 items-center gap-1.5 rounded-full bg-transparent px-0.5 text-left outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50",
										isFutureStep
											? "cursor-not-allowed opacity-55"
											: "cursor-pointer",
										isActive ? "text-[#18181b]" : "text-[#71717a]",
									)}
									onClick={() => {
										if (isFutureStep) return
										onNavigate(index)
									}}
									whileHover={
										reduceMotion || isFutureStep
											? undefined
											: { y: -1, scale: 1.03 }
									}
									whileTap={
										reduceMotion || isFutureStep ? undefined : { scale: 0.985 }
									}
									transition={{ duration: 0.18, ease: "easeOut" }}
								>
									<span
										className={cn(
											"relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-[780] transition-colors",
											isActive
												? "border-[#18181b] bg-[#18181b] text-white"
												: isCompleted
													? "border-[#18181b] bg-[#18181b] text-white"
													: "border-[#18181b]/15 bg-[#f8f8f9] text-[#71717a]",
										)}
									>
										{isCompleted ? (
											<Check className="size-3" strokeWidth={2.6} />
										) : (
											index + 1
										)}
									</span>
									<span
										className={cn(
											"hidden text-[11px] font-semibold sm:block",
											isActive ? "text-[#18181b]" : "text-[#71717a]",
										)}
									>
										{getShortStepLabel(index)}
									</span>
								</motion.button>
								{index < STEPS.length - 1 && (
									<motion.span
										aria-hidden="true"
										className={cn(
											"h-px w-5 origin-left rounded-full",
											index < currentStep
												? "bg-[#18181b]"
												: "bg-[#18181b]/10",
										)}
										initial={false}
										animate={{ scaleX: index < currentStep ? 1 : 0.72 }}
										transition={{
											duration: reduceMotion ? 0 : 0.24,
											ease: "easeOut",
										}}
									/>
								)}
							</Fragment>
						)
					})}
				</div>
			</div>
		</div>
	)
}
