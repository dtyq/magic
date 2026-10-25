import { cn } from "@/utils/cn"
import type { DeviceDefinition } from "./types"

export function DeviceThumbnail({
	device,
	large = false,
}: {
	device: Pick<DeviceDefinition, "kind" | "profile" | "width" | "height">
	large?: boolean
}) {
	const foldable = device.kind === "foldable"
	const height = large ? (foldable ? 50 : 62) : foldable ? 23 : 26
	return (
		<span
			aria-hidden
			className={cn(
				"flex shrink-0 items-center justify-center",
				large ? "h-[65px] w-20" : "h-7 w-9",
			)}
		>
			<span
				className={cn(
					"relative block shrink-0 border-[1.5px] border-foreground/60 bg-gradient-to-br from-muted to-accent shadow-[inset_0_0_0_1px_var(--background)]",
					device.kind === "phone" ? "rounded-[4px]" : "rounded-[3px]",
				)}
				style={{
					height,
					width: Math.max(large ? 25 : 12, (height * device.width) / device.height),
				}}
			>
				{foldable ? (
					<span
						className={cn(
							"absolute bg-foreground/25",
							device.profile === "flip"
								? "inset-x-0 top-1/2 h-px"
								: "inset-y-0 left-1/2 w-px",
						)}
					/>
				) : (
					<span
						className={cn(
							"absolute left-1/2 top-[2px] -translate-x-1/2 rounded-full bg-foreground/70",
							device.kind === "tablet" || device.profile === "punch-hole"
								? "size-[2px]"
								: "h-[2px] w-1/3",
						)}
					/>
				)}
				{device.profile === "home-button" && (
					<span className="absolute bottom-[2px] left-1/2 size-[3px] -translate-x-1/2 rounded-full border border-foreground/70" />
				)}
			</span>
		</span>
	)
}
