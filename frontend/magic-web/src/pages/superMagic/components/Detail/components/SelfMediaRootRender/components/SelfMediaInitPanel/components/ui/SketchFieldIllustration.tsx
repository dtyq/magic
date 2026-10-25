import { cn } from "@/utils/cn"
import authorIllustration from "@/assets/resources/self-media/field-author.png"
import positionIllustration from "@/assets/resources/self-media/field-position.png"
import audienceIllustration from "@/assets/resources/self-media/field-audience.png"
import assetsIllustration from "@/assets/resources/self-media/field-assets.png"

export type BrandFieldIllustrationVariant = "author" | "position" | "audience" | "assets"

interface SketchFieldIllustrationProps {
	variant: BrandFieldIllustrationVariant
	className?: string
	imageClassName?: string
	"data-testid"?: string
}

export function SketchFieldIllustration({
	variant,
	className,
	imageClassName,
	"data-testid": dataTestId,
}: SketchFieldIllustrationProps) {
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
				data-testid="sketch-field-illustration-image"
			/>
		</div>
	)
}

const ILLUSTRATION_SRC = {
	author: authorIllustration,
	position: positionIllustration,
	audience: audienceIllustration,
	assets: assetsIllustration,
} satisfies Record<BrandFieldIllustrationVariant, string>
