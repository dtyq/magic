/**
 * MicrophoneDeviceSelector – lets the user pick a specific microphone device.
 *
 * Design decisions
 * ----------------
 * 1. Calls `navigator.mediaDevices.enumerateDevices()` to list `audioinput`
 *    devices.  Labels are only available after the user has already granted
 *    microphone permission (which the recording flow already requires).
 * 2. Refreshes the list whenever the dropdown opens so newly plugged-in
 *    devices appear without a page reload.
 * 3. An empty `deviceId` ("") means "follow OS default" (the `ideal:'default'`
 *    constraint added in AudioConstraintsConfig.ts).
 * 4. Intentionally mirrors AudioSourceSelector's visual style (cva trigger
 *    button with size variants, MagicDropdown).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Mic } from "lucide-react"
import { cva } from "class-variance-authority"
import MagicDropdown from "@/components/base/MagicDropdown"
import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@/components/shadcn-ui/dropdown-menu"
import { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import type { MenuProps } from "antd"

// ─── Style variants (mirrors AudioSourceSelector) ────────────────────────────

const triggerButtonVariants = cva(
	"inline-flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-[#f3f4f6] shadow-xs outline-none hover:bg-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-50",
	{
		variants: {
			size: {
				small: "h-6 gap-0.5 px-1 text-xs",
				mobile: "h-6 gap-0.5 px-1 text-xs",
				default: "h-8 gap-1.5 px-2 text-sm",
			},
		},
		defaultVariants: { size: "default" },
	},
)

const triggerIconVariants = cva("", {
	variants: {
		size: {
			small: "h-3 w-3",
			mobile: "h-3 w-3",
			default: "h-4 w-4",
		},
	},
	defaultVariants: { size: "default" },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MicrophoneDeviceSelectorProps {
	/** Currently selected device ID. Empty string = system default. */
	value: string
	/** Called with the selected deviceId and its human-readable label. */
	onChange: (deviceId: string, label: string) => void
	disabled?: boolean
	size?: MessageEditorSize
	"data-testid"?: string
}

/** Shape of each entry in the device list. */
interface DeviceEntry {
	deviceId: string
	label: string
}

// ─── Hook: enumerate audioinput devices ──────────────────────────────────────

async function listMicrophoneDevices(): Promise<DeviceEntry[]> {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices()
		return devices
			.filter((d) => d.kind === "audioinput")
			.map((d, index) => ({
				deviceId: d.deviceId,
				// Fallback label when permission not yet granted (shouldn't happen
				// here because recording flow already obtained permission).
				label: d.label || `Microphone ${index + 1}`,
			}))
	} catch {
		return []
	}
}

// ─── Component ────────────────────────────────────────────────────────────────

function MicrophoneDeviceSelector({
	value,
	onChange,
	disabled = false,
	size = "default",
	"data-testid": dataTestId,
}: MicrophoneDeviceSelectorProps) {
	const { t } = useTranslation("super")

	const [devices, setDevices] = useState<DeviceEntry[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [permissionError, setPermissionError] = useState(false)
	const refreshRef = useRef(false)

	const refresh = useCallback(async () => {
		if (refreshRef.current) return
		refreshRef.current = true
		setIsLoading(true)
		setPermissionError(false)
		try {
			const list = await listMicrophoneDevices()
			if (list.length === 0) {
				setPermissionError(true)
			} else {
				setDevices(list)
			}
		} catch {
			setPermissionError(true)
		} finally {
			setIsLoading(false)
			refreshRef.current = false
		}
	}, [])

	// Load once on mount; also re-load when a device is plugged/unplugged.
	useEffect(() => {
		void refresh()
		navigator.mediaDevices.addEventListener("devicechange", refresh)
		return () => {
			navigator.mediaDevices.removeEventListener("devicechange", refresh)
		}
	}, [refresh])

	// ── Derived data ──────────────────────────────────────────────────────────

	const defaultLabel = t("recordingSummary.audioSource.microphone.deviceDefault")

	/** Full list including the synthetic "System Default" entry at the top. */
	const allEntries: DeviceEntry[] = [
		{ deviceId: "", label: defaultLabel },
		...devices.filter((d) => d.deviceId !== "default" && d.deviceId !== "communications"),
	]

	const currentLabel = allEntries.find((d) => d.deviceId === value)?.label ?? defaultLabel

	// ── Dropdown items ────────────────────────────────────────────────────────

	const menuItems: MenuProps["items"] = isLoading
		? [
				{
					key: "__loading",
					disabled: true,
					label: t("recordingSummary.audioSource.microphone.deviceLoading"),
				},
			]
		: permissionError
			? [
					{
						key: "__error",
						disabled: true,
						label: t("recordingSummary.audioSource.microphone.devicePermissionDenied"),
					},
				]
			: allEntries.length === 1 && allEntries[0].deviceId === ""
				? [
						{
							key: "__empty",
							disabled: true,
							label: t("recordingSummary.audioSource.microphone.deviceEmpty"),
						},
					]
				: allEntries.map((entry) => ({
						key: entry.deviceId || "__default",
						label: entry.label,
						onClick: () => onChange(entry.deviceId, entry.label),
					}))

	return (
		<MagicDropdown
			menu={{ items: menuItems }}
			disabled={disabled}
			onOpenChange={(open) => {
				if (open) void refresh()
			}}
			mobileProps={{ title: t("recordingSummary.audioSource.microphone.deviceLabel") }}
			popupRender={() => (
				<>
					<DropdownMenuLabel>
						{t("recordingSummary.audioSource.microphone.deviceLabel")}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{isLoading ? (
						<div className="px-3 py-2 text-xs text-muted-foreground">
							{t("recordingSummary.audioSource.microphone.deviceLoading")}
						</div>
					) : permissionError ? (
						<div className="px-3 py-2 text-xs text-destructive">
							{t("recordingSummary.audioSource.microphone.devicePermissionDenied")}
						</div>
					) : (
						<DropdownMenuRadioGroup
							value={value || "__default"}
							onValueChange={(newValue) => {
								const selectedEntry = allEntries.find(
									(entry) => (entry.deviceId || "__default") === newValue,
								)
								if (selectedEntry) {
									onChange(selectedEntry.deviceId, selectedEntry.label)
								}
							}}
						>
							{allEntries.map((entry) => (
								<DropdownMenuRadioItem
									key={entry.deviceId || "__default"}
									value={entry.deviceId || "__default"}
									disabled={disabled}
									className="py-2"
								>
									{entry.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					)}
				</>
			)}
			overlayClassName="w-[280px]"
		>
			<span>
				<button
					type="button"
					className={triggerButtonVariants({ size })}
					data-testid={dataTestId}
					disabled={disabled}
					aria-label={t("recordingSummary.audioSource.microphone.deviceLabel")}
				>
					<Mic className={triggerIconVariants({ size })} />
					<span className="max-w-[120px] truncate whitespace-nowrap font-normal leading-5 text-secondary-foreground">
						{currentLabel}
					</span>
				</button>
			</span>
		</MagicDropdown>
	)
}

export default MicrophoneDeviceSelector
