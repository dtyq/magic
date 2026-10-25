import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Heart } from "lucide-react"
import { cn } from "@/utils/cn"

interface SlidesTemplateFavoriteIconProps {
	isFavorite: boolean
	className?: string
}

export default function SlidesTemplateFavoriteIcon({
	isFavorite,
	className,
}: SlidesTemplateFavoriteIconProps) {
	const reduceMotion = Boolean(useReducedMotion())

	return (
		<span
			className={cn("relative inline-flex shrink-0 overflow-visible", className)}
			data-favorite-state={isFavorite ? "favorite" : "unfavorite"}
		>
			<AnimatePresence initial={false}>
				{isFavorite && !reduceMotion ? (
					<motion.span
						key="favorite-pulse"
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 rounded-full border border-current opacity-0"
						initial={{ opacity: 0, scale: 0.55 }}
						animate={{ opacity: [0, 0.42, 0], scale: [0.5, 1.22, 1.62] }}
						exit={{ opacity: 0, scale: 1.55 }}
						transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
					/>
				) : null}
			</AnimatePresence>
			<motion.span
				className="absolute inset-0 inline-flex items-center justify-center"
				initial={false}
				animate={{
					opacity: 1,
					scale: reduceMotion ? 1 : isFavorite ? [0.8, 1.12, 1] : [0.9, 1.04, 1],
				}}
				transition={
					reduceMotion
						? { duration: 0 }
						: isFavorite
							? { duration: 0.34, times: [0, 0.62, 1], ease: [0.2, 0, 0, 1] }
							: { duration: 0.28, times: [0, 0.62, 1], ease: [0.2, 0, 0, 1] }
				}
			>
				<Heart
					className="size-full"
					fill={isFavorite ? "currentColor" : "none"}
					aria-hidden="true"
				/>
			</motion.span>
		</span>
	)
}
