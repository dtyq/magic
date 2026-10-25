import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import PhoneShell from "../PhoneShell"
import { usePhoneScaling } from "../../hooks/usePhoneScaling"
import {
	getPhoneShellInsets,
	NO_PHONE_SHELL_INSETS,
} from "../SelfMediaRootRender/components/phoneShellGeometry"
import { DEVICE_PREVIEW_PADDING } from "./constants"
import { useDevicePreviewResize } from "./useDevicePreviewResize"
import type { DevicePreviewControls } from "./types"

interface DevicePreviewViewportProps extends DevicePreviewControls {
	children: ReactNode
	enabled: boolean
	contentRef?: RefObject<HTMLDivElement>
	onDisplayScaleChange?: (scale: number) => void
}

export function DevicePreviewViewport({
	children,
	enabled,
	contentRef,
	onDisplayScaleChange,
	...controls
}: DevicePreviewViewportProps) {
	const { config } = controls
	const { t } = useTranslation("super")
	const spaceRef = useRef<HTMLDivElement>(null)
	const inset =
		enabled && config.showFrame
			? getPhoneShellInsets(
					config.profile,
					config.width > config.height,
					config.fold?.posture,
				)
			: NO_PHONE_SHELL_INSETS
	const { containerRef, scale: fitScale } = usePhoneScaling({
		enabled,
		designWidth: config.width + inset.left + inset.right,
		designHeight: config.height + inset.top + inset.bottom,
		padding: DEVICE_PREVIEW_PADDING,
	})
	const computedScale = !enabled
		? 1
		: fitScale === 0
			? 0
			: config.zoom === "fit"
				? fitScale
				: config.zoom
	const { session, handleProps } = useDevicePreviewResize({
		...controls,
		active: controls.active && enabled,
		scale: computedScale,
		containerRef,
		spaceRef,
	})
	const scale = session?.scale ?? computedScale
	const landscape = session?.landscape ?? config.width > config.height
	const insets =
		enabled && config.showFrame
			? getPhoneShellInsets(config.profile, landscape, config.fold?.posture)
			: NO_PHONE_SHELL_INSETS
	const outerWidth = config.width + insets.left + insets.right,
		outerHeight = config.height + insets.top + insets.bottom
	const visualWidth = outerWidth * scale,
		visualHeight = outerHeight * scale
	useLayoutEffect(() => {
		onDisplayScaleChange?.(scale)
	}, [scale, onDisplayScaleChange])
	const line = config.showFrame
		? "opacity-0 group-hover:opacity-40"
		: "opacity-30 group-hover:opacity-60"
	return (
		<div
			ref={containerRef}
			data-testid={enabled ? "device-preview-viewport" : undefined}
			className={
				enabled
					? "relative h-full min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-muted/50"
					: "contents"
			}
		>
			{/* auto margins 保留居中，同时允许大于容器的设备从左上角滚动到达。拖动期间固定中心和上边缘。 */}
			<div
				className={enabled ? "min-h-full min-w-full" : "contents"}
				style={
					!enabled
						? undefined
						: session
							? {
									width: Math.max(
										containerRef.current?.clientWidth || 0,
										session.centerX + visualWidth / 2 + DEVICE_PREVIEW_PADDING,
									),
									height: Math.max(
										containerRef.current?.clientHeight || 0,
										session.top + visualHeight + DEVICE_PREVIEW_PADDING,
									),
								}
							: {
									display: "flex",
									width: "max-content",
									padding: DEVICE_PREVIEW_PADDING,
								}
				}
			>
				<div
					ref={spaceRef}
					className={enabled ? "relative shrink-0" : "contents"}
					style={
						!enabled
							? undefined
							: {
									width: visualWidth,
									height: visualHeight,
									margin: session ? 0 : "auto",
									left: session ? session.centerX - visualWidth / 2 : undefined,
									top: session?.top,
									visibility: scale <= 0 ? "hidden" : undefined,
								}
					}
				>
					<div
						className={enabled ? "absolute left-0 top-0 origin-top-left" : "contents"}
						style={
							enabled
								? {
										width: outerWidth,
										height: outerHeight,
										transform: `scale(${scale})`,
										pointerEvents: session ? "none" : undefined,
									}
								: undefined
						}
					>
						<PhoneShell
							sizing="content"
							enabled={enabled}
							width={config.width}
							height={config.height}
							showFrame={config.showFrame}
							profile={config.profile}
							landscape={landscape}
							posture={config.fold?.posture}
							rotated={config.fold?.rotated}
							contentRef={contentRef}
						>
							{children}
						</PhoneShell>
					</div>
					{enabled && controls.active && scale > 0 && (
						<>
							<div
								{...handleProps("width")}
								role="separator"
								aria-orientation="vertical"
								aria-label={t("fileViewer.devicePreview.resizeWidth")}
								className="group absolute -right-2 top-0 z-10 h-full w-2 cursor-ew-resize touch-none select-none [@media(pointer:coarse)]:-right-4 [@media(pointer:coarse)]:w-4"
							>
								<span
									className={cn(
										"pointer-events-none absolute left-1/2 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-foreground",
										line,
									)}
								/>
							</div>
							<div
								{...handleProps("height")}
								role="separator"
								aria-orientation="horizontal"
								aria-label={t("fileViewer.devicePreview.resizeHeight")}
								className="group absolute -bottom-2 left-0 z-10 h-2 w-full cursor-ns-resize touch-none select-none [@media(pointer:coarse)]:-bottom-4 [@media(pointer:coarse)]:h-4"
							>
								<span
									className={cn(
										"pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-foreground",
										line,
									)}
								/>
							</div>
							<div
								{...handleProps("both")}
								aria-label={t("fileViewer.devicePreview.resizeBoth")}
								className="absolute -bottom-2 -right-2 z-20 size-3 cursor-nwse-resize touch-none select-none [@media(pointer:coarse)]:-bottom-4 [@media(pointer:coarse)]:-right-4 [@media(pointer:coarse)]:size-5"
							/>
						</>
					)}
				</div>
			</div>
		</div>
	)
}
