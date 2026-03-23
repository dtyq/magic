/**
 * Audio source selector for recording
 * 录制音源选择器
 */

import { useTranslation } from "react-i18next"
import type { AudioSourceType } from "@/services/recordSummary/MediaRecorderService/types/RecorderTypes"
import { RecorderCoreAdapter } from "@/services/recordSummary/MediaRecorderService/RecorderCoreAdapter"
import MagicDropdown from "@/components/base/MagicDropdown"
import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@/components/shadcn-ui/dropdown-menu"
import IconMicrophone from "./icons/IconMicrophone"
import IconSystem from "./icons/IconSystem"
import IconArrow from "./icons/IconArrow"
import { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import { cva } from "class-variance-authority"
import { useCallback } from "react"
import { showRecordSystemAudioTip } from "../RecordSystemAudioTip/utils"
import type { MenuProps } from "antd"

// Trigger button variants
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
		defaultVariants: {
			size: "default",
		},
	},
)

// Trigger icon variants
const triggerIconVariants = cva("", {
	variants: {
		size: {
			small: "h-3 w-3",
			mobile: "h-3 w-3",
			default: "h-4 w-4",
		},
	},
	defaultVariants: {
		size: "default",
	},
})

interface AudioSourceSelectorProps {
	value: AudioSourceType | undefined
	onChange: (value: AudioSourceType) => void
	disabled?: boolean
	size?: MessageEditorSize
	"data-testid"?: string
}

/**
 * Audio source selector component
 * 音源选择器组件
 */
function AudioSourceSelector({
	value = "microphone",
	onChange,
	disabled = false,
	size = "default",
	"data-testid": dataTestId,
}: AudioSourceSelectorProps) {
	const { t } = useTranslation("super")

	const handleValueChange = useCallback(
		async (newValue: AudioSourceType) => {
			if (newValue === value) return
			if (newValue === "system" || newValue === "both") {
				await showRecordSystemAudioTip()
			}
			onChange(newValue)
		},
		[onChange, value],
	)

	// Check browser support for each audio source type
	const micSupport = RecorderCoreAdapter.isAudioSourceSupported("microphone")
	const systemSupport = RecorderCoreAdapter.isAudioSourceSupported("system")
	const bothSupport = RecorderCoreAdapter.isAudioSourceSupported("both")

	const options = [
		{
			label: t("recordingSummary.audioSource.microphone.label"),
			value: "microphone" as AudioSourceType,
			disabled: !micSupport.supported,
			icon: IconMicrophone,
			tooltip: micSupport.supported
				? t("recordingSummary.audioSource.microphone.desc")
				: micSupport.message,
		},
		{
			label: t("recordingSummary.audioSource.system.label"),
			value: "system" as AudioSourceType,
			disabled: !systemSupport.supported,
			icon: IconSystem,
			tooltip: systemSupport.supported
				? t("recordingSummary.audioSource.system.desc")
				: t("recordingSummary.audioSource.disabled"),
		},
		{
			label: t("recordingSummary.audioSource.both.label"),
			value: "both" as AudioSourceType,
			disabled: !bothSupport.supported,
			icon: IconSystem,
			tooltip: bothSupport.supported
				? t("recordingSummary.audioSource.both.desc")
				: t("recordingSummary.audioSource.disabled"),
		},
	]

	const currentOption = options.find((option) => option.value === value)
	const Icon = currentOption?.icon

	const menuItems: MenuProps["items"] = options.map((option) => ({
		key: option.value,
		disabled: option.disabled || disabled,
		label: (
			<div className="flex w-full flex-col items-start gap-1.5">
				<span className="font-medium">{option.label}</span>
				<span className="text-xs text-muted-foreground">{option.tooltip}</span>
			</div>
		),
		onClick: () => {
			void handleValueChange(option.value)
		},
	}))

	return (
		<MagicDropdown
			menu={{ items: menuItems }}
			disabled={disabled}
			mobileProps={{ title: t("recordingSummary.audioSource.label") }}
			popupRender={() => (
				<>
					<DropdownMenuLabel>{t("recordingSummary.audioSource.label")}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup
						value={value}
						onValueChange={(newValue) => {
							void handleValueChange(newValue as AudioSourceType)
						}}
					>
						{options.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={option.value}
								disabled={option.disabled || disabled}
								className="flex flex-col items-start gap-1.5 py-3"
							>
								<div className="flex items-center gap-2">
									<span className="font-medium">{option.label}</span>
								</div>
								<span className="text-xs text-muted-foreground">
									{option.tooltip}
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</>
			)}
			overlayClassName={`
				w-[300px]
				[&_[data-slot=dropdown-menu-item]]:!h-auto
				[&_[data-slot=dropdown-menu-item]]:!items-start
				[&_[data-slot=dropdown-menu-item]]:!py-3
			`}
		>
			<span>
				<button
					type="button"
					className={triggerButtonVariants({ size })}
					data-testid={dataTestId}
					disabled={disabled}
					aria-label={t("recordingSummary.audioSource.label")}
				>
					{Icon && <Icon className={triggerIconVariants({ size })} />}
					<span className="whitespace-nowrap font-normal leading-5 text-secondary-foreground">
						{t("recordingSummary.audioSource.prefix")}：{currentOption?.label}
					</span>
					<IconArrow className={triggerIconVariants({ size })} />
				</button>
			</span>
		</MagicDropdown>
	)
}

export default AudioSourceSelector
