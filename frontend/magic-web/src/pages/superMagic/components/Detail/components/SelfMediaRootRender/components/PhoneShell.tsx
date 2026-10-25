import { forwardRef, type ReactNode, type CSSProperties, useState, useEffect } from "react"
import { cn } from "@/utils/cn"
import PhoneStatusIcons from "./PhoneStatusIcons"
import PhoneShellContent, { type PhoneShellContentProps } from "./PhoneShellContent"

export interface PhoneShellProps {
	children: ReactNode
	width?: number
	height?: number
	scale?: number
	className?: string
	innerClassName?: string
	style?: CSSProperties
	/** 状态栏主题色：dark (黑字, 用于浅色背景), light (白字, 用于深色背景) */
	theme?: "dark" | "light"
	/** 文件预览使用精确内容尺寸；默认 screen 保留既有平台预览的尺寸语义。 */
	sizing?: "screen" | "content"
	profile?: PhoneShellContentProps["profile"]
	showFrame?: boolean
	enabled?: boolean
	landscape?: boolean
	posture?: PhoneShellContentProps["posture"]
	rotated?: boolean
	contentRef?: PhoneShellContentProps["contentRef"]
}

/**
 * iPhone 17 Pro-like shell (393x852). Sized in design pixels and scaled with CSS
 * transform (top-center origin) so different platforms can share layout.
 */
const PhoneShell = forwardRef<HTMLDivElement, PhoneShellProps>(function PhoneShell(
	{
		children,
		width = 393,
		height = 852,
		scale = 1,
		className,
		innerClassName,
		style,
		theme = "dark",
		sizing = "screen",
		profile,
		showFrame,
		enabled,
		landscape,
		posture,
		rotated,
		contentRef,
	},
	ref,
) {
	const [time, setTime] = useState<string>("")

	useEffect(() => {
		if (sizing === "content") return
		const updateTime = () => {
			const now = new Date()
			const hours = now.getHours().toString()
			const minutes = now.getMinutes().toString().padStart(2, "0")
			setTime(`${hours}:${minutes}`)
		}
		updateTime()
		const timer = setInterval(updateTime, 1000)
		return () => clearInterval(timer)
	}, [sizing])

	const isDark = theme === "dark"
	const textColor = isDark ? "text-black" : "text-white"
	if (sizing === "content") {
		return (
			<PhoneShellContent
				ref={ref}
				width={width}
				height={height}
				profile={profile}
				showFrame={showFrame}
				enabled={enabled}
				landscape={landscape}
				posture={posture}
				rotated={rotated}
				contentRef={contentRef}
				className={className}
				style={style}
			>
				{children}
			</PhoneShellContent>
		)
	}

	return (
		<div
			ref={ref}
			className={cn(
				"relative shrink-0 overflow-hidden rounded-[55px] border-[10px] border-black bg-black shadow-2xl",
				className,
			)}
			style={{
				width: width + 28, // Include 14px border on each side
				height: height + 28, // Include 14px border top and bottom
				transform: `scale(${scale})`,
				transformOrigin: "center center",
				...style,
			}}
		>
			<div
				className={cn(
					"relative h-full w-full overflow-hidden rounded-[41px]",
					innerClassName,
				)}
			>
				{/* Status Bar */}
				<div
					className={cn(
						"pointer-events-none absolute left-0 top-0 z-50 flex h-[54px] w-full select-none items-center justify-between px-6",
						textColor,
					)}
				>
					{/* Time */}
					<div className="w-[54px] text-center text-[16px] font-semibold tracking-wide">
						{time || "9:41"}
					</div>

					{/* Dynamic Island */}
					<div className="pointer-events-auto absolute left-1/2 top-[11px] h-[37px] w-[120px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_4px_rgba(255,255,255,0.1)]">
						{/* Camera dot */}
						<div className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#111] shadow-[inset_0_0_2px_rgba(255,255,255,0.2)]">
							<div className="absolute left-[3px] top-[3px] h-1 w-1 rounded-full bg-[#222]" />
						</div>
					</div>

					{/* Right Icons: Cellular, Wi-Fi, Battery */}
					<div className="flex h-full items-center gap-[6px]">
						<PhoneStatusIcons />
					</div>
				</div>

				{children}

				{/* Home Indicator Handle */}
				<div className="pointer-events-none absolute bottom-2 left-0 z-50 flex w-full items-center justify-center">
					<div
						className={cn(
							"h-[5px] w-[134px] rounded-full",
							isDark ? "bg-black" : "bg-white",
						)}
					/>
				</div>
			</div>
		</div>
	)
})

export default PhoneShell
