import { useId } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { motion, useReducedMotion } from "framer-motion"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { STEPS } from "../constants"
import { ChevronLeft, ChevronRight, Home, RefreshCw, Sparkles } from "lucide-react"

export interface StepNavigationFinalAction {
	label: string
	onClick: () => void
	disabled?: boolean
	disabledReason?: string
}

interface StepNavigationProps {
	currentStep: number
	canProceed: boolean
	hasAnyInitData: boolean
	onNext: () => void
	onPrev: () => void
	onClear: () => void
	onNavigate: (step: number) => void
	onBackHome?: () => void
	proceedHint?: string
	finalAction?: StepNavigationFinalAction | null
}

export default function StepNavigation({
	currentStep,
	canProceed,
	hasAnyInitData,
	onNext,
	onPrev,
	onClear,
	onNavigate,
	onBackHome,
	proceedHint,
	finalAction,
}: StepNavigationProps) {
	const { t } = useTranslation("super")
	const reduceMotion = useReducedMotion()
	const proceedHintId = useId()
	const finalActionHintId = useId()
	const isFinalStep = currentStep >= STEPS.length - 1
	const nextText = t("detail.selfMedia.initPanel.nav.next")
	const nextButtonLabel = proceedHint
		? t("detail.selfMedia.initPanel.nav.nextWithHint", {
				hint: proceedHint,
				defaultValue: "下一步：{{hint}}",
			})
		: nextText
	const showVisibleProceedHint = Boolean(proceedHint && !canProceed)

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

	return (
		<div
			className="shrink-0 px-4 pb-[max(var(--safe-area-inset-bottom),1.5rem)] pt-4 sm:px-6"
			data-testid="self-media-init-panel-footer"
			data-self-media-motion="step-footer"
		>
			<div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 sm:flex-nowrap sm:items-center sm:gap-4">
				{/* Left side actions */}
				<div className="flex items-center gap-2">
					{onBackHome && !isFinalStep ? (
						<MagicTooltip title={t("detail.selfMedia.initPanel.nav.backHome")}>
							<Button
								type="button"
								variant="ghost"
								aria-label={t("detail.selfMedia.initPanel.nav.backHome")}
								className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#f4f4f5] text-[#18181b] transition-colors hover:bg-[#e4e4e7]"
								onClick={onBackHome}
								data-testid="self-media-init-panel-back-home-button"
							>
								<Home size={18} />
							</Button>
						</MagicTooltip>
					) : null}

					{!isFinalStep ? (
						<MagicTooltip title={t("detail.selfMedia.initPanel.nav.clear")}>
							<Button
								type="button"
								variant="ghost"
								aria-label={t("detail.selfMedia.initPanel.nav.clear")}
								className={cn(
									"flex h-[46px] w-[46px] items-center justify-center rounded-full transition-colors",
									hasAnyInitData
										? "bg-[#f4f4f5] text-destructive hover:bg-[#e4e4e7]"
										: "bg-transparent text-muted-foreground opacity-50",
								)}
								onClick={onClear}
								disabled={!hasAnyInitData}
								data-testid="self-media-init-panel-clear-button"
							>
								<RefreshCw
									size={18}
									className={cn(
										hasAnyInitData &&
											"transition-transform duration-500 hover:rotate-180",
									)}
								/>
							</Button>
						</MagicTooltip>
					) : null}

					{currentStep > 0 && (
						<Button
							type="button"
							variant="ghost"
							className="group/prev flex h-[46px] items-center gap-1.5 rounded-full bg-[#f4f4f5] px-5 font-[780] text-[#18181b] transition-colors hover:bg-[#e4e4e7]"
							onClick={onPrev}
							data-testid="self-media-init-panel-prev-button"
						>
							<ChevronLeft
								size={16}
								className="transition-transform group-hover/prev:-translate-x-0.5"
							/>
							<span>{t("detail.selfMedia.initPanel.nav.prev")}</span>
						</Button>
					)}
				</div>

				{/* Center milestone dot indicators */}
				<div className="order-3 flex w-full select-none items-center justify-center gap-2 sm:order-none sm:w-auto">
					{STEPS.map((_, index) => {
						const isFutureStep = index > currentStep
						return (
							<button
								key={index}
								type="button"
								aria-current={index === currentStep ? "step" : undefined}
								className={cn(
									"h-2.5 rounded-full p-0 outline-none transition-all duration-300",
									isFutureStep ? "cursor-not-allowed" : "cursor-pointer",
									index === currentStep
										? "w-8 bg-[#18181b]"
										: index < currentStep
											? "w-2.5 bg-[#18181b]/40"
											: "w-2.5 bg-[#18181b]/15",
								)}
								onClick={() => {
									if (isFutureStep) return
									onNavigate(index)
								}}
								disabled={isFutureStep}
								aria-label={getStepLabel(index)}
								title={getStepLabel(index)}
								data-testid="on-navigate"
							/>
						)
					})}
				</div>

				{/* Right side actions */}
				{currentStep < STEPS.length - 1 ? (
					<motion.div
						className="flex min-w-[150px] flex-col items-end gap-1.5"
						data-self-media-motion="step-primary-action"
						initial={reduceMotion ? false : { opacity: 0, y: 5 }}
						animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
						whileTap={reduceMotion || !canProceed ? undefined : { scale: 0.985 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
					>
						{showVisibleProceedHint ? (
							<p
								id={proceedHintId}
								className="flex max-w-[240px] items-center gap-1.5 text-right text-[11px] font-semibold leading-snug text-[#71717a]"
								aria-live="polite"
								data-testid="self-media-init-panel-proceed-hint"
							>
								<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff776c]" />
								<span>{proceedHint}</span>
							</p>
						) : null}
						<Button
							type="button"
							variant="ghost"
							className="group/next flex h-[46px] items-center gap-1.5 rounded-full bg-[#18181b] px-6 font-[800] text-[#ffffff] shadow-[0_16px_34px_rgba(24,24,27,0.18)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
							onClick={onNext}
							disabled={!canProceed}
							aria-label={nextButtonLabel}
							aria-describedby={showVisibleProceedHint ? proceedHintId : undefined}
							title={nextButtonLabel}
						>
							<span>{nextText}</span>
							<ChevronRight
								size={16}
								className="transition-transform group-hover/next:translate-x-0.5"
							/>
						</Button>
					</motion.div>
				) : finalAction ? (
					<motion.div
						className="flex min-w-[190px] flex-col items-end gap-1.5"
						data-testid="self-media-init-panel-footer-final-action"
						data-self-media-motion="step-final-action"
						initial={reduceMotion ? false : { opacity: 0, y: 5, scale: 0.985 }}
						animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
						whileTap={
							reduceMotion || finalAction.disabled ? undefined : { scale: 0.985 }
						}
						transition={{ duration: 0.24, ease: "easeOut" }}
					>
						{finalAction.disabledReason ? (
							<p
								id={finalActionHintId}
								className="flex max-w-[260px] items-center gap-1.5 text-right text-[11px] font-semibold leading-snug text-[#71717a]"
								aria-live="polite"
							>
								<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff776c]" />
								<span>{finalAction.disabledReason}</span>
							</p>
						) : null}
						<Button
							type="button"
							variant="ghost"
							className="group/final flex h-[46px] items-center gap-1.5 rounded-full bg-[#18181b] px-6 font-[800] text-[#ffffff] shadow-[0_16px_34px_rgba(24,24,27,0.18)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
							onClick={finalAction.onClick}
							disabled={finalAction.disabled}
							aria-label={finalAction.label}
							aria-describedby={
								finalAction.disabledReason ? finalActionHintId : undefined
							}
							title={finalAction.disabledReason || finalAction.label}
						>
							<Sparkles size={15} className="group-hover/final:animate-pulse" />
							<span>{finalAction.label}</span>
							<ChevronRight
								size={16}
								className="transition-transform group-hover/final:translate-x-0.5"
							/>
						</Button>
					</motion.div>
				) : (
					<div className="w-[100px]" />
				)}
			</div>
		</div>
	)
}
