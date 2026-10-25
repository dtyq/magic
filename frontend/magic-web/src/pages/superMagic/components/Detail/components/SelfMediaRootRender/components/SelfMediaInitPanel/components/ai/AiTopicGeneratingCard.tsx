import { Check, FileText, Layers3, PenLine, Sparkles, X } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"

interface AiTopicGeneratingCardProps {
	generatingTexts: string[]
	generatingStep: number
	stopLabel: string
	onAbort: () => void
}

export default function AiTopicGeneratingCard({
	generatingTexts,
	generatingStep,
	stopLabel,
	onAbort,
}: AiTopicGeneratingCardProps) {
	const reduceMotion = useReducedMotion()
	const progress =
		generatingTexts.length <= 1
			? 100
			: Math.round(
					(Math.min(generatingStep, generatingTexts.length - 1) /
						(generatingTexts.length - 1)) *
						100,
				)

	const handleStop = () => {
		onAbort()
	}

	return (
		<motion.div
			className="relative isolate grid min-h-[178px] w-full overflow-hidden rounded-[24px] border border-white/80 bg-[#f7f7f8]/90 px-4 py-4 shadow-[inset_0_1px_rgba(255,255,255,0.95),0_14px_38px_rgba(24,24,27,0.08)] sm:px-5 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-5"
			data-testid="ai-topic-generating-card"
			data-self-media-motion="topic-generating-card"
			initial={reduceMotion ? false : { opacity: 0, y: 8 }}
			animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
			transition={{ duration: 0.28, ease: "easeOut" }}
		>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-[#18181b]/10">
				<motion.div
					className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#ffd637] to-transparent"
					data-self-media-motion="topic-scanline"
					initial={reduceMotion ? false : { x: "-120%" }}
					animate={reduceMotion ? { x: "0%" } : { x: ["-120%", "220%"] }}
					transition={
						reduceMotion
							? { duration: 0 }
							: { duration: 2.4, repeat: Infinity, ease: "linear" }
					}
				/>
			</div>

			<div className="relative flex min-w-0 flex-col justify-center py-2">
				<div className="relative pl-8" data-testid="ai-topic-progress-track">
					<div className="absolute left-[9px] top-2 h-[calc(100%-1rem)] w-px rounded-full bg-[#18181b]/10" />
					<motion.div
						className="absolute left-[9px] top-2 w-px origin-top rounded-full bg-[#ffd637]"
						initial={false}
						animate={{ height: `${progress}%` }}
						transition={{ duration: reduceMotion ? 0 : 0.32, ease: "easeOut" }}
						data-self-media-motion="topic-progress-fill"
					/>

					<div className="flex flex-col gap-3">
						{generatingTexts.map((text, index) => {
							const isActive = index === generatingStep
							const isPast = index < generatingStep
							return (
								<motion.div
									key={text}
									className={cn(
										"relative flex min-w-0 items-center gap-3 rounded-[16px] px-2 py-1.5 transition-colors",
										isActive
											? "bg-white text-[#18181b] shadow-[0_8px_22px_rgba(24,24,27,0.06)]"
											: isPast
												? "text-[#71717a]"
												: "text-[#a1a1aa]",
									)}
									data-self-media-motion={
										isActive
											? "topic-stage-active"
											: isPast
												? "topic-stage-complete"
												: "topic-stage-pending"
									}
									data-self-media-active={isActive ? "true" : undefined}
									initial={false}
									animate={
										reduceMotion
											? { opacity: 1 }
											: isActive
												? { opacity: 1, x: 0, scale: [1, 1.012, 1] }
												: { opacity: isPast ? 0.86 : 0.68, x: 0, scale: 1 }
									}
									transition={
										isActive && !reduceMotion
											? {
													duration: 1.35,
													repeat: Infinity,
													ease: "easeInOut",
												}
											: { duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }
									}
								>
									<div className="absolute -left-[31px] flex size-5 items-center justify-center">
										{isPast ? (
											<motion.span
												className="flex size-4 items-center justify-center rounded-full bg-[#18181b] text-white"
												initial={reduceMotion ? false : { scale: 0.78 }}
												animate={{ scale: 1 }}
												transition={{ duration: 0.2, ease: "easeOut" }}
											>
												<Check className="size-3" strokeWidth={2.4} />
											</motion.span>
										) : isActive ? (
											<span className="relative flex size-5 items-center justify-center rounded-full bg-[#fff1a6]">
												<motion.span
													className="absolute size-5 rounded-full border border-[#ffd637]/70"
													data-self-media-motion="topic-spark"
													animate={
														reduceMotion
															? { opacity: 0.8, scale: 1 }
															: {
																	opacity: [0.45, 0.95, 0.45],
																	scale: [0.9, 1.08, 0.9],
																}
													}
													transition={{
														duration: reduceMotion ? 0 : 1.25,
														repeat: reduceMotion ? 0 : Infinity,
														ease: "easeInOut",
													}}
												/>
												<span className="relative size-2.5 rounded-full bg-[#18181b]" />
											</span>
										) : (
											<span className="size-2 rounded-full bg-[#18181b]/25" />
										)}
									</div>
									<span
										className={cn(
											"min-w-0 truncate text-sm",
											isActive ? "font-[780]" : "font-semibold",
										)}
									>
										{text}
									</span>
								</motion.div>
							)
						})}
					</div>
				</div>

				<motion.div
					className="mt-5 w-fit"
					whileTap={reduceMotion ? undefined : { scale: 0.96 }}
				>
					<Button
						onClick={handleStop}
						variant="outline"
						size="sm"
						className="w-fit rounded-full border-0 bg-[#18181b] px-4 font-[780] text-white shadow-[0_12px_24px_rgba(24,24,27,0.14)] hover:bg-[#27272a] hover:text-white"
					>
						<X className="size-3.5" />
						{stopLabel}
					</Button>
				</motion.div>
			</div>

			<div
				className="relative mt-5 hidden min-h-[140px] items-center justify-center md:flex"
				data-testid="ai-topic-workbench"
			>
				<motion.div
					className="absolute left-3 top-2 flex h-8 w-14 items-center justify-center rounded-[12px] bg-white text-[#18181b]/70 shadow-[0_10px_24px_rgba(24,24,27,0.06)]"
					data-self-media-motion="topic-workbench-float"
					animate={reduceMotion ? { y: 0 } : { y: [0, -5, 0], rotate: [0, 0.8, 0] }}
					transition={{
						duration: 2.2,
						repeat: reduceMotion ? 0 : Infinity,
						ease: "easeInOut",
					}}
				>
					<Layers3 className="size-4" strokeWidth={1.9} />
				</motion.div>
				<motion.div
					className="absolute bottom-4 right-3 h-2 w-16 rounded-full bg-[#18181b]/10"
					data-self-media-motion="topic-spark"
					animate={reduceMotion ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
					transition={{
						duration: 1.6,
						repeat: reduceMotion ? 0 : Infinity,
						ease: "easeInOut",
					}}
				>
					<div className="h-full w-2/3 rounded-full bg-[#ffd637]" />
				</motion.div>
				<motion.div
					className="absolute right-5 top-3 size-2 rounded-full bg-[#ffd637]"
					data-self-media-motion="topic-spark"
					animate={
						reduceMotion
							? { scale: 1 }
							: { scale: [0.8, 1.12, 0.8], opacity: [0.5, 1, 0.5] }
					}
					transition={{
						duration: 1.4,
						repeat: reduceMotion ? 0 : Infinity,
						ease: "easeInOut",
					}}
				/>
				<motion.div
					className="relative flex h-28 w-28 items-center justify-center rounded-[24px] bg-white text-[#18181b] shadow-[inset_0_1px_rgba(255,255,255,0.95),0_18px_36px_rgba(24,24,27,0.08)]"
					data-self-media-motion="topic-workbench-float"
					animate={reduceMotion ? { y: 0 } : { y: [0, -4, 0] }}
					transition={{
						duration: 2.5,
						repeat: reduceMotion ? 0 : Infinity,
						ease: "easeInOut",
					}}
				>
					<div className="absolute -left-4 top-6 h-16 w-12 rotate-[-8deg] rounded-[14px] bg-[#ededf0] shadow-[0_10px_22px_rgba(24,24,27,0.07)]" />
					<FileText className="relative size-10" strokeWidth={1.8} />
					<span className="absolute -right-3 -top-3 flex size-10 items-center justify-center rounded-full bg-[#ffd637] shadow-[0_12px_22px_rgba(24,24,27,0.14)]">
						<PenLine className="size-4" strokeWidth={2.2} />
					</span>
					<span className="absolute -bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#18181b] text-white shadow-[0_12px_22px_rgba(24,24,27,0.14)]">
						<Sparkles className="size-3.5" strokeWidth={2.2} />
					</span>
				</motion.div>
			</div>
		</motion.div>
	)
}
