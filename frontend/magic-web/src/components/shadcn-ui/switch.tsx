import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { Loader2 } from "lucide-react"

import { cn } from "@/utils/cn"

interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
	loading?: boolean
}

function Switch({ className, loading, disabled, children, ...props }: SwitchProps) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"peer inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
				children ? "relative h-6 w-auto" : "h-[1.15rem] w-8",
				className,
			)}
			disabled={disabled || loading}
			{...props}
		>
			{children}
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none flex items-center justify-center rounded-full bg-background ring-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
					children
						? "absolute left-0.5 top-0.5 size-5 transition-[left] data-[state=checked]:left-[calc(100%-1.375rem)] data-[state=checked]:translate-x-0 data-[state=unchecked]:translate-x-0"
						: "size-4 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
				)}
			>
				{loading && (
					<Loader2 className="h-3 w-3 animate-spin text-muted-foreground dark:text-foreground" />
				)}
			</SwitchPrimitive.Thumb>
		</SwitchPrimitive.Root>
	)
}

export { Switch }
