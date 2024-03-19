import { motion } from "framer-motion"
import { cn } from "@/opensource/lib/utils"

interface IdentityScanLineProps {
	className?: string
	startTop?: number
	endTop?: number
}

export function IdentityScanLine({
	className,
	startTop = 132,
	endTop = 510,
}: IdentityScanLineProps) {
	return (
		<motion.div
			className={cn(
				"pointer-events-none absolute left-1/2 z-20 h-6 w-[560px] -translate-x-1/2",
				className,
			)}
			initial={{ top: startTop }}
			animate={{ top: [startTop, endTop, startTop] }}
			transition={{ duration: 3.6, ease: "easeInOut", repeat: Infinity }}
			data-testid="crew-identity-generating-scan-line"
		>
			<div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-amber-300/80" />
			<div className="absolute left-0 top-1/2 h-6 w-full -translate-y-1/2 bg-gradient-to-b from-transparent via-amber-100/30 to-transparent" />
			<motion.div
				className="absolute left-0 top-1/2 h-12 w-full -translate-y-1/2 bg-gradient-to-b from-transparent via-amber-100/60 to-transparent blur-md"
				animate={{ opacity: [0.55, 0.95, 0.55] }}
				transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
			/>
		</motion.div>
	)
}
