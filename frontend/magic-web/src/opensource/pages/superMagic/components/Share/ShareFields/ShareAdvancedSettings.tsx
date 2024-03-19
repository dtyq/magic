import { memo, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Switch } from "@/opensource/components/shadcn-ui/switch"
import { ChevronDown, ChevronRight } from "lucide-react"
import { VipSwitch, VipBadge } from "@/opensource/pages/superMagic/components/VipSwitch"
import { ShareMode } from "../types"
import type { ShareAdvancedSettingsProps, ShareAdvancedSettingsData } from "./types"

/**
 * 开关配置项
 */
interface SwitchConfig {
	key: keyof ShareAdvancedSettingsData
	labelKey: string
	descriptionKey: string
	isVip: boolean
	defaultValue: boolean
	modes: ShareMode[] // 适用的模式
}

/**
 * 开关配置列表
 */
const SWITCH_CONFIGS: SwitchConfig[] = [
	{
		key: "allowCopy",
		labelKey: "share.allowCopyFiles",
		descriptionKey: "share.allowCopyFilesDescription",
		isVip: false,
		defaultValue: true,
		modes: [ShareMode.File],
	},
	{
		key: "showOriginalInfo",
		labelKey: "share.showOriginalInfo",
		descriptionKey: "share.showOriginalInfoDescription",
		isVip: true,
		defaultValue: true,
		modes: [ShareMode.File, ShareMode.Topic],
	},
	{
		key: "showFileList",
		labelKey: "share.viewFileList",
		descriptionKey: "share.viewFileListDescription",
		isVip: true,
		defaultValue: true,
		modes: [ShareMode.File],
	},
	{
		key: "allowDownloadProjectFile",
		labelKey: "share.allowDownloadAndExport",
		descriptionKey: "share.allowDownloadAndExportDescription",
		isVip: true,
		defaultValue: true,
		modes: [ShareMode.File],
	},
	{
		key: "hideCreatorInfo",
		labelKey: "share.hideCreatorInfo",
		descriptionKey: "share.hideCreatorInfoDescription",
		isVip: true,
		defaultValue: false,
		modes: [ShareMode.File],
	},
	{
		key: "view_file_list",
		labelKey: "share.viewFileList",
		descriptionKey: "share.viewFileListDescription",
		isVip: true,
		defaultValue: true,
		modes: [ShareMode.Topic],
	},
]

export default memo(function ShareAdvancedSettings(props: ShareAdvancedSettingsProps) {
	const { settings, onChange, mode } = props

	const { t } = useTranslation("super")
	const [isExpanded, setIsExpanded] = useState(true)

	// Handle individual setting changes
	const handleSettingChange = useCallback(
		(key: keyof ShareAdvancedSettingsData, value: boolean) => {
			onChange({
				...settings,
				[key]: value,
			})
		},
		[settings, onChange],
	)

	// 根据当前模式筛选需要显示的开关配置
	const visibleConfigs = SWITCH_CONFIGS.filter((config) => config.modes.includes(mode))

	return (
		<div className="flex select-none flex-col gap-3 rounded-lg bg-muted px-3 py-3">
			{/* Header */}
			<div
				className="flex cursor-pointer items-center justify-between gap-2"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<span className="text-sm font-medium leading-none text-foreground">
					{t("share.advancedSettings")}
				</span>
				{isExpanded ? (
					<ChevronDown className="h-4 w-4 transition-transform" />
				) : (
					<ChevronRight className="h-4 w-4 transition-transform" />
				)}
			</div>

			{/* Settings List */}
			{isExpanded && (
				<div className="flex flex-col gap-2">
					{visibleConfigs.map((config) => {
						const checked = settings[config.key] ?? config.defaultValue

						return (
							<div key={config.key} className="flex gap-3">
								{config.isVip ? (
									<VipSwitch
										checked={checked}
										onChange={(value) => handleSettingChange(config.key, value)}
									/>
								) : (
									<Switch
										checked={checked}
										onCheckedChange={(value) =>
											handleSettingChange(config.key, value)
										}
									/>
								)}
								<div className="flex flex-1 flex-col gap-2">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium leading-none text-foreground">
											{t(config.labelKey)}
										</span>
										{config.isVip && <VipBadge />}
									</div>
									<div className="text-sm leading-normal text-muted-foreground">
										{t(config.descriptionKey)}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
})
