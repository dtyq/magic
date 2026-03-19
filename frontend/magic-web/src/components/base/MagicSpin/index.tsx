import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/lib/utils"
import { memo, useEffect, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"

type MagicSpinSize = "small" | "default" | "large"

interface MagicSpinProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	children?: ReactNode
	delay?: number
	section?: boolean
	size?: MagicSpinSize
	spinning?: boolean
	tip?: ReactNode
	wrapperClassName?: string
	innerClassName?: string
}

const iconSizeMap: Record<MagicSpinSize, number> = {
	small: 14,
	default: 16,
	large: 20,
}

const MagicSpin = memo(function MagicSpin({
	children,
	className,
	delay = 0,
	section = false,
	size = "default",
	spinning = true,
	tip,
	wrapperClassName,
	innerClassName,
	...props
}: MagicSpinProps) {
	void section
	const [showSpinner, setShowSpinner] = useState(() => (spinning ? delay <= 0 : false))

	useEffect(() => {
		if (!spinning) {
			setShowSpinner(false)
			return
		}

		if (delay <= 0) {
			setShowSpinner(true)
			return
		}

		setShowSpinner(false)
		const timer = window.setTimeout(() => setShowSpinner(true), delay)
		return () => window.clearTimeout(timer)
	}, [delay, spinning])

	const spinIndicator = (
		<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
			<Spinner className="animate-spin" size={iconSizeMap[size]} />
			{tip ? <div className="text-xs leading-5">{tip}</div> : null}
		</div>
	)

	const mergedWrapperClassName = cn("w-full", wrapperClassName, className)

	if (!children) {
		if (!showSpinner) {
			return null
		}
		return (
			<div
				className={cn("flex items-center justify-center", mergedWrapperClassName)}
				{...props}
			>
				{spinIndicator}
			</div>
		)
	}

	return (
		<div className={cn("relative w-full", mergedWrapperClassName)} {...props}>
			<div
				className={cn(
					showSpinner && "pointer-events-none select-none opacity-60",
					innerClassName,
				)}
			>
				{children}
			</div>
			{showSpinner ? (
				<div className="absolute inset-0 flex items-center justify-center">
					{spinIndicator}
				</div>
			) : null}
		</div>
	)
})

export default MagicSpin
