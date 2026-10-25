import { cn } from "@/utils/cn"
import brandIllustration from "@/assets/resources/self-media/title-brand.png"
import confirmIllustration from "@/assets/resources/self-media/title-confirm.png"
import outlineIllustration from "@/assets/resources/self-media/title-outline.png"
import topicsIllustration from "@/assets/resources/self-media/title-topics.png"

interface SketchTitleIllustrationProps {
	variant: "brand" | "topics" | "outline" | "confirm"
	className?: string
	imageClassName?: string
	"data-testid"?: string
}

export function SketchTitleIllustration({
	variant,
	className,
	imageClassName,
	"data-testid": dataTestId,
}: SketchTitleIllustrationProps) {
	return (
		<div
			className={cn("pointer-events-none relative shrink-0 overflow-hidden", className)}
			data-testid={dataTestId}
			aria-hidden="true"
		>
			<img
				src={ILLUSTRATION_SRC[variant]}
				alt=""
				className={cn(
					"h-full w-full max-w-none select-none object-contain",
					imageClassName,
				)}
				draggable={false}
				data-testid="sketch-title-illustration-image"
			/>
		</div>
	)
}

const ILLUSTRATION_SRC = {
	brand: brandIllustration,
	topics: topicsIllustration,
	outline: outlineIllustration,
	confirm: confirmIllustration,
} satisfies Record<SketchTitleIllustrationProps["variant"], string>
