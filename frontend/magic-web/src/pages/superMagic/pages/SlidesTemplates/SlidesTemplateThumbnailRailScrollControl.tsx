import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

interface SlidesTemplateThumbnailRailScrollControlProps {
	direction: "left" | "right"
	onClick: () => void
	title: string
}

export default function SlidesTemplateThumbnailRailScrollControl({
	direction,
	onClick,
	title,
}: SlidesTemplateThumbnailRailScrollControlProps) {
	const isPrevious = direction === "left"
	const Icon = isPrevious ? ChevronLeft : ChevronRight

	return (
		<div
			className={cn(
				"pointer-events-none absolute top-0 z-10 flex h-full w-14 items-center",
				isPrevious ? "left-0 justify-start" : "right-0 justify-end",
			)}
		>
			<Button
				type="button"
				variant="secondary"
				size="icon"
				className={cn(
					"pointer-events-auto size-9 rounded-full border border-white/[0.28] bg-zinc-950/[0.84] text-white shadow-[0_8px_22px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl hover:bg-zinc-950/[0.92]",
					isPrevious ? "ml-2" : "mr-2",
				)}
				aria-label={`${title} ${isPrevious ? "previous" : "next"} thumbnails`}
				onClick={onClick}
				data-testid={`slides-template-inline-preview-thumbnail-${isPrevious ? "previous" : "next"}-button`}
			>
				<Icon className="size-4" />
			</Button>
		</div>
	)
}
