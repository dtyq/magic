import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { DEVICE_PRESETS, type DevicePreset } from "./devices"
import { DeviceThumbnail } from "./DeviceThumbnail"
import type { DeviceKind, DevicePreviewConfig } from "./types"

interface DevicePickerDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSelect: (device: DevicePreset) => void
	preset: DevicePreviewConfig["preset"]
	container: HTMLElement | null
	onCloseAutoFocus: (event: Event) => void
}

export function DevicePickerDialog({
	open,
	onOpenChange,
	onSelect,
	preset,
	container,
	onCloseAutoFocus,
}: DevicePickerDialogProps) {
	const { t } = useTranslation("super")
	const [filter, setFilter] = useState<DeviceKind | "all">("all")
	const [search, setSearch] = useState("")
	useEffect(() => {
		if (open) {
			setFilter("all")
			setSearch("")
		}
	}, [open])
	const filters = [
		{ value: "all" as const, label: t("fileViewer.devicePreview.all") },
		{ value: "phone" as const, label: t("fileViewer.devicePreview.phone") },
		{ value: "foldable" as const, label: t("fileViewer.devicePreview.foldable") },
		{ value: "tablet" as const, label: t("fileViewer.devicePreview.tablet") },
	]
	const query = search.trim().toLocaleLowerCase()
	const devices = DEVICE_PRESETS.filter(
		(device) =>
			(filter === "all" || device.kind === filter) &&
			`${device.name} ${device.brand}`.toLocaleLowerCase().includes(query),
	)
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				container={container}
				className="gap-0 overflow-hidden p-0 sm:max-w-[640px]"
				aria-describedby={undefined}
				onCloseAutoFocus={onCloseAutoFocus}
			>
				<DialogTitle className="px-5 pb-3 pt-5 text-base">
					{t("fileViewer.devicePreview.chooseDevice")}
				</DialogTitle>
				<div className="flex flex-wrap items-center gap-3 border-b px-5 pb-3">
					<div
						role="group"
						aria-label={t("fileViewer.devicePreview.deviceType")}
						className="flex gap-1"
					>
						{filters.map(({ value, label }) => (
							<Button
								key={value}
								variant="ghost"
								className={cn("h-7 px-2 text-xs", filter === value && "bg-accent")}
								aria-pressed={filter === value}
								onClick={() => setFilter(value)}
							>
								{label}
							</Button>
						))}
					</div>
					<Input
						type="search"
						className="h-8 min-w-40 flex-1 text-xs"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={t("fileViewer.devicePreview.search")}
						aria-label={t("fileViewer.devicePreview.search")}
					/>
				</div>
				{/* Cap the viewport, with a vh fallback for browsers without dynamic viewport units. */}
				<ScrollArea viewportClassName="h-auto max-h-[min(340px,50vh)] p-4 supports-[height:100dvh]:max-h-[min(340px,50dvh)] [&>div]:!grid [&>div]:grid-cols-2 [&>div]:gap-2 sm:[&>div]:grid-cols-3">
					{devices.map((device) => (
						<Button
							key={device.id}
							variant="outline"
							aria-pressed={preset === device.id}
							className={cn(
								"relative h-auto min-h-[132px] flex-col gap-1 whitespace-normal p-3 text-xs font-normal",
								preset === device.id && "border-primary bg-accent",
							)}
							onClick={() => onSelect(device)}
						>
							<DeviceThumbnail device={device} large />
							<span>
								{device.id === "ipad-mini"
									? t("fileViewer.devicePreview.classicIpadMini")
									: device.name}
							</span>
							{device.kind === "foldable" && (
								<span className="text-[11px] text-muted-foreground">
									{t("fileViewer.devicePreview.outerScreen")}{" "}
									{device.folded.width} × {device.folded.height}
								</span>
							)}
							<span className="text-[11px] text-muted-foreground">
								{device.kind === "foldable" &&
									t("fileViewer.devicePreview.innerScreen")}{" "}
								{device.width} × {device.height}
								{device.reference &&
									` · ${t("fileViewer.devicePreview.reference")}`}
							</span>
							{preset === device.id && (
								<Check size={16} className="absolute right-2 top-2" />
							)}
						</Button>
					))}
					{devices.length === 0 && (
						<p className="col-span-full py-10 text-center text-sm text-muted-foreground">
							{t("fileViewer.devicePreview.noResults")}
						</p>
					)}
				</ScrollArea>
				<div className="flex justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
					<span aria-live="polite">
						{t("fileViewer.devicePreview.deviceCount", { count: devices.length })}
					</span>
					<span>{t("fileViewer.devicePreview.cssPixels")}</span>
				</div>
			</DialogContent>
		</Dialog>
	)
}
