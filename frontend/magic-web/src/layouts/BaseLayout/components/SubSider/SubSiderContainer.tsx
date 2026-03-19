import { memo } from "react"
import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SubSiderContainerProps extends HTMLAttributes<HTMLDivElement> { }

const SubSiderContainer = memo(function SubSiderContainer({
	children,
	className,
	...rest
}: SubSiderContainerProps) {
	// const {width, handler} = useResizable(240, resizable, MIN_WIDTH)

	return (
		<div
			className={cn(
				"relative flex h-full min-h-[calc(100%-48px)] w-full select-none flex-col items-center border-r border-border bg-background py-2.5",
				className,
			)}
			data-testid="base-layout-sub-sider-container"
			{...rest}
		>
			{children}
		</div>
	)
})

export default SubSiderContainer
