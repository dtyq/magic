import { memo } from "react"
import { ImagePlus } from "lucide-react"
import { cn } from "@/utils/cn"

/** 6px handles offset by half their size plus half the 1px border, so they center on the corners. */
const HANDLE_POSITIONS = [
	"-left-[3.5px] -top-[3.5px]",
	"-right-[3.5px] -top-[3.5px]",
	"-bottom-[3.5px] -left-[3.5px]",
	"-bottom-[3.5px] -right-[3.5px]",
] as const

/**
 * Cover of a canvas without generated images: the same dotted board as the home hero with one
 * blank artboard in the middle and a dashed frame behind it. Hovering the card selects the
 * artboard, as the real canvas does. While covers are still resolving only the board shows,
 * so a card that does have images never flashes the artboard first.
 */
function EmptyCanvasCover({ loading = false }: { loading?: boolean }) {
	return (
		<div className="relative size-full bg-muted/50" aria-hidden="true">
			<div
				className="absolute inset-0"
				style={{
					backgroundImage:
						"radial-gradient(oklch(var(--foreground) / 0.14) 1px, transparent 1.2px)",
					backgroundSize: "14px 14px",
					backgroundPosition: "center",
					WebkitMaskImage: "radial-gradient(closest-side, black 55%, transparent 100%)",
					maskImage: "radial-gradient(closest-side, black 55%, transparent 100%)",
				}}
			/>
			{loading ? null : (
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="relative aspect-[4/3] w-[44%]">
						<div className="absolute inset-0 -translate-y-[14%] translate-x-[16%] rotate-[5deg] border border-dashed border-foreground/15" />
						<div className="absolute inset-0 flex items-center justify-center bg-background shadow-[0_12px_28px_-16px_rgb(15_23_42/0.4)] ring-1 ring-border">
							<ImagePlus
								className="size-5 text-muted-foreground/50"
								strokeWidth={1.5}
							/>
						</div>
						<div className="absolute -inset-px border border-sky-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none">
							{HANDLE_POSITIONS.map((position) => (
								<span
									key={position}
									className={cn(
										"absolute size-1.5 border border-sky-500 bg-background",
										position,
									)}
								/>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default memo(EmptyCanvasCover)
