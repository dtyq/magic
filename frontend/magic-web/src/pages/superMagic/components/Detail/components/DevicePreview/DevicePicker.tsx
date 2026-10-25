import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronDown, Grid2X2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { DEVICE_PRESETS, getDevicePreset, type DevicePreset } from "./devices"
import { DeviceThumbnail } from "./DeviceThumbnail"
import { DevicePickerDialog } from "./DevicePickerDialog"
import { selectCustomDevice, selectDevice } from "./useDevicePreview"
import type { DevicePreviewControls } from "./types"

export function DevicePicker({
	config,
	setConfig,
	active,
	identity,
	container,
}: DevicePreviewControls & { container: HTMLElement | null }) {
	const { t } = useTranslation("super")
	const [menuOpen, setMenuOpen] = useState(false)
	const [dialogOpen, setDialogOpen] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		setMenuOpen(false)
		setDialogOpen(false)
	}, [active, identity])
	const current = getDevicePreset(config.preset)
	const customName =
		config.kind === "tablet"
			? t("fileViewer.devicePreview.customTablet")
			: config.kind === "foldable"
				? t("fileViewer.devicePreview.customFoldable")
				: t("fileViewer.devicePreview.customPhone")
	const name =
		current?.id === "ipad-mini"
			? t("fileViewer.devicePreview.classicIpadMini")
			: current?.name || customName
	function apply(device: DevicePreset) {
		setConfig(selectDevice(config, device))
		setMenuOpen(false)
		setDialogOpen(false)
	}
	function restoreFocus(event: Event) {
		event.preventDefault()
		if (active && triggerRef.current?.isConnected) triggerRef.current.focus()
	}
	return (
		<>
			<DropdownMenu open={menuOpen && active} onOpenChange={setMenuOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						ref={triggerRef}
						variant="ghost"
						className="h-[22px] max-w-[190px] gap-1 rounded-sm px-1 text-xs font-normal"
						aria-label={t("fileViewer.devicePreview.chooseDevice")}
					>
						<span className="truncate">{name}</span>
						<ChevronDown size={16} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					container={container}
					align="start"
					className="w-[290px] max-w-[calc(100vw-24px)]"
					onCloseAutoFocus={(event) => {
						if (dialogOpen || !active) event.preventDefault()
					}}
				>
					{(["phone", "tablet"] as const).map((kind) => (
						<DropdownMenuItem
							key={kind}
							className="gap-2 text-xs"
							onSelect={() => setConfig(selectCustomDevice(config, kind))}
						>
							<DeviceThumbnail
								device={{
									kind,
									profile: kind === "tablet" ? "tablet" : "modern",
									width: kind === "tablet" ? 820 : 390,
									height: kind === "tablet" ? 1180 : 844,
								}}
							/>
							<span className="flex-1">
								{kind === "tablet"
									? t("fileViewer.devicePreview.customTablet")
									: t("fileViewer.devicePreview.customPhone")}
							</span>
							{config.preset === "custom" && config.kind === kind && (
								<Check size={16} />
							)}
						</DropdownMenuItem>
					))}
					{(["mobile", "tablet"] as const).map((group) => (
						<div key={group}>
							<DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
								{group === "tablet"
									? t("fileViewer.devicePreview.commonTablets")
									: t("fileViewer.devicePreview.commonPhones")}
							</DropdownMenuLabel>
							{DEVICE_PRESETS.filter(
								(device) =>
									device.common &&
									(group === "tablet"
										? device.kind === "tablet"
										: device.kind !== "tablet"),
							).map((device) => (
								<DropdownMenuItem
									key={device.id}
									className="gap-2 text-xs"
									onSelect={() => apply(device)}
								>
									<DeviceThumbnail device={device} />
									<span className="min-w-0 flex-1">{device.name}</span>
									<span className="whitespace-nowrap text-[11px] text-muted-foreground">
										{device.kind === "foldable"
											? t("fileViewer.devicePreview.twoScreens")
											: `${device.width} × ${device.height}`}
										{device.reference &&
											device.kind !== "foldable" &&
											` · ${t("fileViewer.devicePreview.reference")}`}
									</span>
									{config.preset === device.id && <Check size={16} />}
								</DropdownMenuItem>
							))}
						</div>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="text-xs"
						onSelect={() => {
							setMenuOpen(false)
							setDialogOpen(true)
						}}
					>
						<Grid2X2 size={16} />
						{t("fileViewer.devicePreview.moreDevices")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<DevicePickerDialog
				open={dialogOpen && active}
				onOpenChange={setDialogOpen}
				onSelect={apply}
				preset={config.preset}
				container={container}
				onCloseAutoFocus={restoreFocus}
			/>
		</>
	)
}
