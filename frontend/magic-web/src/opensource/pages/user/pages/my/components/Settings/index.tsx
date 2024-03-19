import { ChevronLeft } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useNavigate } from "@/opensource/routes/hooks/useNavigate"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import { RouteName } from "@/opensource/routes/constants"
import FontSizeChanger from "@/opensource/components/settings/FontSizeChanger"
import { useGlobalLanguage, useSupportLanguageOptions } from "@/opensource/models/config/hooks"
import { useTimezone, useTimezoneList } from "@/opensource/providers/TimezoneProvider/hooks"
import { useMemo } from "react"
import SettingItem from "../common/SettingItem"

function Settings() {
	const { t } = useTranslation("interface")
	const navigate = useNavigate()

	const options = useSupportLanguageOptions()
	const language = useGlobalLanguage()
	const { timezone } = useTimezone()
	const { data: timezoneList } = useTimezoneList()

	// 获取当前时区显示名称
	const currentTimezoneName = useMemo(() => {
		const targetTimezone = timezoneList?.find((tz) => tz.code === timezone)
		return targetTimezone ? `GMT ${targetTimezone.offset}` : timezone
	}, [timezone, timezoneList])

	// 获取当前语言显示名称
	const languageLabel = useMemo(() => {
		const langOption = options.find((option) => option.value === language)
		return langOption?.label || language
	}, [language, options])

	// 返回上一页
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: {
				type: "slide",
				direction: "right",
			},
		})
	})

	const handleLanguageClick = useMemoizedFn(() => {
		navigate({
			name: RouteName.ProfileSettingsLanguage,
		})
	})

	const handleTimezoneClick = useMemoizedFn(() => {
		navigate({
			name: RouteName.ProfileSettingsTimezone,
		})
	})

	return (
		<div className="flex h-full w-full flex-col bg-sidebar">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">
						{t("sider.settings")}
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex w-full flex-1 flex-col gap-4 overflow-y-auto px-3.5">
				{/* 语言设置 */}
				<div className="flex w-full flex-col overflow-hidden rounded-md bg-popover">
					<SettingItem
						label={t("setting.language")}
						description={t("setting.languageDescription")}
						value={
							<div className="whitespace-nowrap text-sm text-foreground">
								{languageLabel}
							</div>
						}
						onClick={handleLanguageClick}
					/>
				</div>

				{/* 时区设置 */}
				<div className="flex w-full flex-col overflow-hidden rounded-md bg-popover">
					<SettingItem
						label={t("setting.timezone")}
						description={t("setting.timezoneDescription")}
						value={
							<div className="whitespace-nowrap text-sm text-foreground">
								{currentTimezoneName}
							</div>
						}
						onClick={handleTimezoneClick}
					/>
				</div>

				{/* 字体大小 */}
				<div className="flex w-full flex-col gap-2.5 overflow-hidden rounded-md bg-popover px-3 py-3">
					<div className="flex w-full items-center justify-between gap-2">
						<div className="text-sm text-foreground">{t("setting.fontSize")}</div>
					</div>
					<FontSizeChanger />
					<div className="text-xs leading-4 text-muted-foreground">
						{t("setting.fontSizeDescription")}
					</div>
				</div>
			</div>
		</div>
	)
}

export default observer(Settings)
