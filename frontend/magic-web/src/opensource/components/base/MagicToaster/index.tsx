import { cn } from "@/opensource/lib/utils"
import { Toaster } from "@/opensource/components/shadcn-ui/sonner"
import type { ToasterProps } from "sonner"

interface MagicToasterProps extends Partial<ToasterProps> {
	/** 是否使用居中定位样式，默认 true */
	centered?: boolean
}

export default function MagicToaster({
	centered = true,
	visibleToasts = 3,
	position = "top-center",
	className,
	...rest
}: MagicToasterProps) {
	return (
		<Toaster
			visibleToasts={visibleToasts}
			className={cn(
				centered && [
					"!left-0 !right-0 !top-[calc(var(--safe-area-inset-top)+40px)] !w-auto !translate-x-0",
					"[&_[data-sonner-toast]]:!left-0 [&_[data-sonner-toast]]:!right-0 [&_[data-sonner-toast]]:!mx-auto",
					"[&_[data-sonner-toast]]:!w-fit [&_[data-sonner-toast]]:!whitespace-nowrap [&_[data-sonner-toast]]:!py-2",
				],
				className,
			)}
			position={position}
			{...rest}
		/>
	)
}
