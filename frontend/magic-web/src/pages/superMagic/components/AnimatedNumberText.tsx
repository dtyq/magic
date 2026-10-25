import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useRef } from "react"
import { cn } from "@/utils/cn"
import { formatNumber } from "@/utils/format"

interface AnimatedNumberTextProps {
	value: number | undefined
	isEmphasized?: boolean
	className?: string
}

/** Renders each digit as a small vertical transition while the whole number settles. */
export function AnimatedNumberText({
	value,
	isEmphasized = false,
	className,
}: AnimatedNumberTextProps) {
	const prefersReducedMotion = useReducedMotion()
	const previousValueRef = useRef<number | undefined>(value)
	const directionRef = useRef<1 | -1>(1)

	if (
		typeof value === "number" &&
		typeof previousValueRef.current === "number" &&
		value !== previousValueRef.current
	) {
		directionRef.current = value > previousValueRef.current ? 1 : -1
	}

	useEffect(() => {
		previousValueRef.current = value
	}, [value])

	if (typeof value !== "number" || !Number.isFinite(value)) return null

	const direction = directionRef.current
	const formattedValue = formatNumber(value)
	const shouldEmphasize = isEmphasized && !prefersReducedMotion

	return (
		<motion.span
			className={cn("inline-flex origin-center items-center whitespace-nowrap", className)}
			initial={false}
			animate={
				shouldEmphasize
					? {
							x: 0,
							scale: 1.12,
							rotate: direction * 1.5,
							filter: "drop-shadow(0 0 6px rgba(255,106,31,0.38))",
						}
					: { x: 0, scale: 1, rotate: 0, filter: "drop-shadow(0 0 0 rgba(255,106,31,0))" }
			}
			transition={{
				duration: prefersReducedMotion ? 0 : 1.05,
				ease: [0.22, 1, 0.36, 1],
			}}
		>
			{formattedValue.split("").map((character, index) => (
				<span
					key={`number-cell-${index}`}
					className={cn(
						"relative inline-flex h-[1.3em] justify-center overflow-hidden align-middle [perspective:400px]",
						/\d/.test(character) ? "min-w-[0.56em]" : "min-w-[0.28em]",
					)}
				>
					<AnimatePresence
						initial={false}
						mode={prefersReducedMotion ? "sync" : "popLayout"}
					>
						<motion.span
							key={`${index}-${character}`}
							className="absolute inset-0 flex items-center justify-center text-center leading-none"
							initial={
								prefersReducedMotion
									? false
									: {
											y: direction * 115 + "%",
											opacity: 0,
											scale: 1.35,
											rotateX: direction * 80,
											filter: "blur(5px)",
										}
							}
							animate={{
								y: "0%",
								opacity: 1,
								scale: 1,
								rotateX: 0,
								filter: "blur(0px)",
							}}
							exit={
								prefersReducedMotion
									? undefined
									: {
											y: direction * -115 + "%",
											opacity: 0,
											scale: 0.78,
											rotateX: direction * -80,
											filter: "blur(5px)",
										}
							}
							transition={{
								duration: prefersReducedMotion ? 0 : 0.72,
								ease: [0.22, 1, 0.36, 1],
							}}
						>
							{character}
						</motion.span>
					</AnimatePresence>
				</span>
			))}
		</motion.span>
	)
}
