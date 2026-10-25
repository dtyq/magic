import { forwardRef, type CSSProperties, type ReactNode, type Ref } from "react"
import { cn } from "@/utils/cn"
import PhoneStatusIcons from "./PhoneStatusIcons"
import {
	getPhoneShellGeometry,
	getPhoneShellInsets,
	NO_PHONE_SHELL_INSETS,
	type PhoneShellProfile,
} from "./phoneShellGeometry"

export interface PhoneShellContentProps {
	children: ReactNode
	width: number
	height: number
	profile?: PhoneShellProfile
	showFrame?: boolean
	enabled?: boolean
	landscape?: boolean
	posture?: "folded" | "unfolded"
	rotated?: boolean
	contentRef?: Ref<HTMLDivElement>
	className?: string
	style?: CSSProperties
}

/** 内容始终留在同一个节点；开关外观只改变外围占位，不重建 iframe 或编辑器。 */
const PhoneShellContent = forwardRef<HTMLDivElement, PhoneShellContentProps>(
	function PhoneShellContent(
		{
			children,
			width,
			height,
			profile = "modern",
			showFrame = true,
			enabled = true,
			landscape = width > height,
			posture,
			rotated,
			contentRef,
			className,
			style,
		},
		ref,
	) {
		const framed = enabled && showFrame
		const insets = framed
			? getPhoneShellInsets(profile, landscape, posture)
			: NO_PHONE_SHELL_INSETS
		const tablet = profile === "tablet"
		const foldable = profile === "foldable" || profile === "flip"
		// 大折叠左右展开，Flip 上下展开；旋转后转轴方向也随之交换。
		const horizontalHinge = profile === "flip" ? !rotated : rotated
		const homeButton = profile === "home-button"
		const sideCamera = landscape && !tablet && !foldable
		const geometry = getPhoneShellGeometry(profile, landscape, posture)
		const iphoneStatus = profile === "modern" || profile === "notch"
		const statusHeight = iphoneStatus ? 34 : 20
		const statusSideWidth = (width - geometry.cameraWidth - 16) / 2
		// 两侧空间按缺口宽度计算；窄视口先隐藏图标，再隐藏时间，避免压住圆角或缺口。
		const showStatus = iphoneStatus ? width >= 230 && statusSideWidth >= 40 : width >= 280
		const showStatusIcons = !iphoneStatus || statusSideWidth >= 78
		const cameraStyle: CSSProperties = sideCamera
			? {
					left: homeButton ? 30 : 21,
					top: "50%",
					transform: "translate(-50%, -50%) rotate(-90deg)",
				}
			: {
					left: "50%",
					top: geometry.cameraTop,
					transform: "translateX(-50%)",
				}

		return (
			<div
				ref={ref}
				className={cn(enabled ? "relative shrink-0" : "contents", className)}
				style={
					enabled
						? {
								width: width + insets.left + insets.right,
								height: height + insets.top + insets.bottom,
								...style,
							}
						: undefined
				}
			>
				<div
					aria-hidden
					hidden={!framed}
					className="pointer-events-none absolute inset-0 border-[3px] border-[#777980] bg-[#101113]"
					style={{
						borderRadius: geometry.radius,
						boxShadow:
							foldable && posture === "folded"
								? "-3px 0 0 #484b51,-5px 0 0 #96989c,inset 0 0 0 2px #17181b,0 18px 35px -14px #00000050"
								: "0 0 0 1px #25262a,inset 0 0 0 2px #17181b,inset 0 0 0 4px #38393e,0 18px 35px -14px #00000050",
					}}
				/>
				<div
					aria-hidden
					hidden={!framed}
					className="pointer-events-none absolute bg-background"
					style={{
						...geometry.glassInsets,
						borderRadius: geometry.glassRadius,
					}}
				/>
				<div
					aria-hidden
					hidden={!framed}
					className="pointer-events-none absolute inset-0 select-none text-foreground"
				>
					{!homeButton && (!landscape || tablet || foldable) && showStatus && (
						<div
							className={cn(
								"absolute items-center",
								iphoneStatus
									? "grid font-semibold"
									: "flex justify-between font-medium",
							)}
							style={{
								left: iphoneStatus ? insets.left : 30,
								right: iphoneStatus ? insets.right : 28,
								top: geometry.statusCenter - statusHeight / 2,
								height: statusHeight,
								gridTemplateColumns: iphoneStatus
									? `minmax(0, 1fr) ${geometry.cameraWidth + 16}px minmax(0, 1fr)`
									: undefined,
								fontFamily: iphoneStatus
									? '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif'
									: undefined,
								fontSize: iphoneStatus ? 17 : tablet || foldable ? 12 : 14,
								lineHeight: iphoneStatus ? "22px" : undefined,
								letterSpacing: iphoneStatus ? "-0.45px" : undefined,
							}}
						>
							<span
								className={
									iphoneStatus ? "col-start-1 justify-self-center" : undefined
								}
							>
								9:41
							</span>
							<span
								className={cn(
									"flex items-center gap-[6px]",
									iphoneStatus && "col-start-3 justify-self-center",
									!showStatusIcons && "invisible",
								)}
							>
								<PhoneStatusIcons />
							</span>
						</div>
					)}
					{!(profile === "foldable" && posture === "unfolded") && (
						<div
							className="absolute bg-[#08090a]"
							style={{
								...cameraStyle,
								width: geometry.cameraWidth,
								height: geometry.cameraHeight,
								borderRadius: profile === "notch" ? "0 0 19px 19px" : 20,
							}}
						>
							{!homeButton && (
								<span className="absolute right-[8%] top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-[#14243b]" />
							)}
						</div>
					)}
					<div
						className={cn(
							"absolute",
							homeButton
								? "rounded-full bg-[#151618] shadow-[inset_0_0_0_2px_#414348]"
								: "rounded-full bg-foreground",
						)}
						style={
							homeButton && landscape
								? {
										right: 17,
										top: "50%",
										transform: "translateY(-50%)",
										width: 43,
										height: 43,
									}
								: {
										bottom: homeButton ? 17 : 13,
										left: "50%",
										transform: "translateX(-50%)",
										width: homeButton ? 43 : tablet ? 170 : 125,
										height: homeButton ? 43 : 4,
									}
						}
					/>
					<span className="absolute -right-[3px] top-[20%] h-12 w-[3px] rounded-sm bg-[#666971]" />
					<span className="absolute -left-[3px] top-[18%] h-10 w-[3px] rounded-sm bg-[#666971]" />
					{foldable &&
						posture === "unfolded" &&
						[false, true].map((end) => (
							<span
								key={String(end)}
								className="absolute rounded-sm bg-gradient-to-r from-[#43464c] via-[#9a9ca0] to-[#43464c]"
								style={
									horizontalHinge
										? {
												top: "calc(50% - 6px)",
												left: end ? undefined : 0,
												right: end ? 0 : undefined,
												width: 5,
												height: 12,
											}
										: {
												left: "calc(50% - 6px)",
												top: end ? undefined : 0,
												bottom: end ? 0 : undefined,
												width: 12,
												height: 5,
											}
								}
							/>
						))}
				</div>
				<div
					ref={contentRef}
					className={
						enabled
							? cn(
									"relative overflow-auto overscroll-contain bg-background",
									// 保留滚动节点和内容尺寸，仅隐藏设备内容区及其内部原生条。
									"[scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_*::-webkit-scrollbar]:hidden [&_*]:[scrollbar-width:none]",
									!framed && "outline outline-1 outline-border",
								)
							: "contents"
					}
					style={
						enabled
							? {
									width,
									height,
									marginLeft: insets.left,
									top: insets.top,
									borderRadius: framed ? 0 : 4,
									clipPath: framed ? geometry.contentClipPath : undefined,
								}
							: undefined
					}
				>
					{children}
				</div>
			</div>
		)
	},
)

export default PhoneShellContent
