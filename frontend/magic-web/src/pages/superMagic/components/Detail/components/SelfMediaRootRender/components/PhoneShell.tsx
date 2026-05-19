import { forwardRef, type ReactNode, type CSSProperties, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

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
	},
	ref,
) {
	const [time, setTime] = useState<string>("")

	useEffect(() => {
		const updateTime = () => {
			const now = new Date()
			const hours = now.getHours().toString()
			const minutes = now.getMinutes().toString().padStart(2, "0")
			setTime(`${hours}:${minutes}`)
		}
		updateTime()
		const timer = setInterval(updateTime, 1000)
		return () => clearInterval(timer)
	}, [])

	const isDark = theme === "dark"
	const textColor = isDark ? "text-black" : "text-white"

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
						{/* Cellular */}
						<svg
							width="18"
							height="12"
							viewBox="0 0 18 12"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="opacity-90"
						>
							<rect x="1" y="8" width="3" height="4" rx="1" fill="currentColor" />
							<rect x="5" y="6" width="3" height="6" rx="1" fill="currentColor" />
							<rect x="9" y="3" width="3" height="9" rx="1" fill="currentColor" />
							<rect x="13" y="0" width="3" height="12" rx="1" fill="currentColor" />
						</svg>
						{/* Wi-Fi */}
						<svg
							width="16"
							height="12"
							viewBox="0 0 16 12"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							data-testid="self-media-phone-shell-wifi-icon"
							className="opacity-90"
						>
							<path
								d="M8 11.25C8.69036 11.25 9.25 10.6904 9.25 10C9.25 9.30964 8.69036 8.75 8 8.75C7.30964 8.75 6.75 9.30964 6.75 10C6.75 10.6904 7.30964 11.25 8 11.25Z"
								fill="currentColor"
							/>
							<path
								d="M11.0913 7.80176C9.3838 6.09428 6.6162 6.09428 4.90873 7.80176L3.84766 6.74069C6.1412 4.44715 9.8588 4.44715 12.1523 6.74069L11.0913 7.80176Z"
								fill="currentColor"
							/>
							<path
								d="M13.9203 4.97227C10.6508 1.70281 5.34924 1.70281 2.07978 4.97227L1.01872 3.9112C4.87426 0.0556602 11.1257 0.0556602 14.9813 3.9112L13.9203 4.97227Z"
								fill="currentColor"
							/>
						</svg>
						{/* Battery */}
						<svg
							width="25"
							height="12"
							viewBox="0 0 25 12"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="opacity-90"
						>
							<rect
								x="0.5"
								y="0.5"
								width="21"
								height="11"
								rx="3.5"
								stroke="currentColor"
								strokeOpacity="0.35"
							/>
							<rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" />
							<path
								d="M24 4C24.5523 4 25 4.44772 25 5V7C25 7.55228 24.5523 8 24 8V4Z"
								fill="currentColor"
								fillOpacity="0.4"
							/>
						</svg>
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
