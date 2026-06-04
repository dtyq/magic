import { Check, ChevronRight, Clock3, Globe, MessageCircleQuestion, Pin } from "lucide-react"
import { useMemoizedFn } from "ahooks"
import type { Timezone } from "@dtyq/timezone"

import { useTranslation } from "react-i18next"

import { Switch } from "@/components/shadcn-ui/switch"
import { useGlobalSuggestion } from "@/components/settings/FollowUpSuggestionItems/hooks"
import { IS_DARK_MODE_DISABLED } from "@/constants/theme"
import { useGlobalLanguage, useSupportLanguageOptions, useTheme } from "@/models/config/hooks"
import { useTimezone, useTimezoneList } from "@/providers/TimezoneProvider/hooks"
import { cn } from "@/lib/utils"

import { MOBILE_SETTINGS_SECTION_CLASSNAME } from "../constants"
import { MobileSettingsSheetContainer } from "./SheetContainer"

type ThemeOption = "auto" | "light" | "dark"

const MOBILE_APP_SETTINGS_SWITCH_CLASSNAME =
	"pointer-events-none mt-0.5 h-[28px] w-[48px] shrink-0 [&_[data-slot=switch-thumb]]:size-6"

/** 原型中的主题卡是 5:3 预览缩略图，这里用纯 CSS 结构模拟，避免再引入额外图片资源。 */
function MobileSettingsThemePreview(props: { mode: ThemeOption }) {
	const { mode } = props

	if (mode === "auto") {
		return (
			<div className="grid h-full w-full grid-cols-2 overflow-hidden rounded-md border border-border/70 bg-card">
				<div className="flex flex-col gap-1.5 bg-[#FBFBF9] px-2 py-2">
					<div className="h-2.5 w-2.5 rounded-full bg-black/8" />
					<div className="h-2 w-8 rounded-full bg-black/8" />
					<div className="mt-1.5 h-2 w-10 rounded-full bg-black/8" />
					<div className="h-2 w-8 rounded-full bg-black/8" />
				</div>
				<div className="flex flex-col gap-1.5 bg-[#1F1F21] px-2 py-2">
					<div className="h-2.5 w-2.5 rounded-full bg-white/10" />
					<div className="bg-white/12 h-2 w-8 rounded-full" />
					<div className="bg-white/12 mt-1.5 h-2 w-10 rounded-full" />
					<div className="bg-white/12 h-2 w-8 rounded-full" />
				</div>
			</div>
		)
	}

	if (mode === "dark") {
		return (
			<div className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-md border border-white/10 bg-[#1F1F21] px-2 py-2">
				<div className="h-2.5 w-2.5 rounded-full bg-white/10" />
				<div className="bg-white/12 h-2 w-8 rounded-full" />
				<div className="bg-white/12 mt-1.5 h-2 w-10 rounded-full" />
				<div className="bg-white/12 h-2 w-8 rounded-full" />
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-md border border-border/70 bg-[#FBFBF9] px-2 py-2">
			<div className="h-2.5 w-2.5 rounded-full bg-black/8" />
			<div className="h-2 w-8 rounded-full bg-black/8" />
			<div className="mt-1.5 h-2 w-10 rounded-full bg-black/8" />
			<div className="h-2 w-8 rounded-full bg-black/8" />
		</div>
	)
}

/** 主题选项改成卡片式单选，直接贴近原型而不是继续沿用普通菜单行。 */
function MobileSettingsThemeTile(props: {
	label: string
	mode: ThemeOption
	selected: boolean
	onClick: () => void
	dataTestId: string
}) {
	const { label, mode, selected, onClick, dataTestId } = props

	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onClick}
			className={cn(
				"flex flex-col gap-2 rounded-xl bg-card p-2 text-left transition-all active:opacity-80",
				selected ? "ring-2 ring-primary" : "ring-1 ring-border",
			)}
			data-testid={dataTestId}
		>
			<div className="aspect-[5/3] w-full overflow-hidden rounded-md">
				<MobileSettingsThemePreview mode={mode} />
			</div>
			<div className="flex h-5 items-center justify-center gap-1 px-1">
				<span
					className={cn(
						"truncate text-[13px] leading-5",
						selected ? "font-medium text-foreground" : "text-muted-foreground",
					)}
				>
					{label}
				</span>
				{selected ? (
					<Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
				) : null}
			</div>
		</button>
	)
}

/** 二级设置行保持原型里的“左图标 + 当前值 + 右箭头”结构，和主题卡形成清晰层级。 */
function MobileSettingsAppSettingRow(props: {
	icon: React.ReactNode
	label: string
	value: React.ReactNode
	valueClassName?: string
	showDivider?: boolean
	onClick: () => void
	dataTestId: string
}) {
	const { icon, label, value, valueClassName, showDivider = false, onClick, dataTestId } = props

	return (
		<>
			<button
				type="button"
				onClick={onClick}
				// 标签列用 auto 按内容定宽；值列用 minmax(0,1fr) 吃剩余空间。避免窄屏 WebView 里 14rem 固定值列把标签挤到逐字换行。
				className="grid h-12 w-full grid-cols-[1.25rem_auto_minmax(0,1fr)_1rem] items-center gap-3 bg-transparent px-3.5 transition-opacity active:opacity-60"
				data-testid={dataTestId}
			>
				<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
					{icon}
				</div>
				<span className="shrink-0 whitespace-nowrap text-left text-base leading-5 text-foreground">
					{label}
				</span>
				<div
					className={cn(
						// 右侧当前值需要先撑满整列，text-right 才会对齐到箭头左侧而不是停留在内容自身宽度上。
						"w-full min-w-0 overflow-hidden text-right text-sm tabular-nums text-muted-foreground",
						valueClassName,
					)}
				>
					{value}
				</div>
				<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
			</button>
			{showDivider ? (
				<div className="pl-[42px]">
					<div className="h-px w-full bg-border" />
				</div>
			) : null}
		</>
	)
}

/** 原型里的分组标题是弱化说明文字，这里单独抽出来统一控制字重和间距。 */
function MobileSettingsSectionLabel(props: { children: React.ReactNode }) {
	return <div className="px-3.5 text-sm leading-5 text-muted-foreground">{props.children}</div>
}

/**
 * 「偏好设置」分组里的开关行：左侧图标 + 主标题 + 多行说明 + 右侧 Switch。
 * 整行点击都会切换 Switch，所以 Switch 自身设为 `pointer-events-none`，避免双触发；
 * 主键盘可达性仍由外层 button 提供，标题与说明保持原型里的两行排版。
 */
function MobileSettingsAppSettingSwitchRow(props: {
	icon: React.ReactNode
	label: string
	description?: string
	checked: boolean
	onCheckedChange: (next: boolean) => void
	showDivider?: boolean
	dataTestId: string
}) {
	const {
		icon,
		label,
		description,
		checked,
		onCheckedChange,
		showDivider = false,
		dataTestId,
	} = props

	return (
		<>
			<button
				type="button"
				onClick={() => onCheckedChange(!checked)}
				className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-opacity active:opacity-60"
				data-testid={dataTestId}
				aria-pressed={checked}
			>
				<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
					{icon}
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="text-base leading-5 text-foreground">{label}</span>
					{description ? (
						<span className="text-xs leading-snug text-muted-foreground">
							{description}
						</span>
					) : null}
				</div>
				<Switch
					checked={checked}
					onCheckedChange={onCheckedChange}
					className={MOBILE_APP_SETTINGS_SWITCH_CLASSNAME}
					tabIndex={-1}
					aria-hidden
				/>
			</button>
			{showDivider ? (
				<div className="pl-[42px]">
					<div className="h-px w-full bg-border" />
				</div>
			) : null}
		</>
	)
}

/** 把时区对象拆成“城市名 + GMT”两段，方便 UI 给 GMT 单独预留稳定宽度。 */
function formatTimezoneSummary(timezone: string, timezoneList?: Array<Timezone.TimezoneItem>) {
	const matchedTimezone = timezoneList?.find((item) => item.code === timezone)

	if (!matchedTimezone) {
		return {
			cityLabel: timezone,
			gmtLabel: "",
		}
	}

	const cityLabel =
		matchedTimezone.city || matchedTimezone.label?.split(" / ").pop() || matchedTimezone.code
	const gmtLabel =
		typeof matchedTimezone.offset === "string" ? `GMT${matchedTimezone.offset}` : ""

	return { cityLabel, gmtLabel }
}

/** 应用设置弹窗只承载 UI 与入口分发，实际主题/语言/时区写入仍复用现有配置管线。 */
export function MobileSettingsAppSettingsSheet(props: {
	open: boolean
	onClose: () => void
	onOpenLanguage: () => void
	onOpenTimezone: () => void
}) {
	const { open, onClose, onOpenLanguage, onOpenTimezone } = props
	const { t } = useTranslation("interface")
	const { theme, setTheme } = useTheme()
	const currentLanguage = useGlobalLanguage()
	const languageOptions = useSupportLanguageOptions()
	const { timezone } = useTimezone()
	const { data: timezoneList } = useTimezoneList()
	// 追问建议偏好与 PC 端复用同一 hook；hook 内已对 userInfo 做乐观更新，Switch 随 useUserInfo 同步刷新。
	const {
		followUpSuggestions,
		keepUsedFollowUpSuggestions,
		setFollowUpSuggestions,
		setKeepUsedFollowUpSuggestions,
	} = useGlobalSuggestion()

	/** 主题切换直接复用现有配置仓库，让弹窗 UI 不感知持久化细节。 */
	const handleThemeChange = useMemoizedFn((nextTheme: ThemeOption) => {
		setTheme(nextTheme)
	})

	const currentLanguageLabel =
		languageOptions.find((option) => option.value === currentLanguage)?.label || currentLanguage
	const currentTimezoneSummary = formatTimezoneSummary(timezone, timezoneList)

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.appSettings")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			contentClassName="gap-2.5 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			scrollEdgeFade={{ fadeColor: "muted" }}
			dataTestId="mobile-settings-app-settings-sheet"
		>
			{/* Mobile theme picker stays hidden until dark mode is enabled product-wide. */}
			{!IS_DARK_MODE_DISABLED ? (
				<div className="flex flex-col gap-2">
					<MobileSettingsSectionLabel>
						{t("setting.appearance")}
					</MobileSettingsSectionLabel>
					<div role="radiogroup" className="grid grid-cols-3 gap-2">
						<MobileSettingsThemeTile
							mode="auto"
							label={t("setting.languages.auto")}
							selected={theme === "auto"}
							onClick={() => handleThemeChange("auto")}
							dataTestId="mobile-settings-theme-auto"
						/>
						<MobileSettingsThemeTile
							mode="light"
							label={t("setting.light")}
							selected={theme === "light"}
							onClick={() => handleThemeChange("light")}
							dataTestId="mobile-settings-theme-light"
						/>
						<MobileSettingsThemeTile
							mode="dark"
							label={t("setting.dark")}
							selected={theme === "dark"}
							onClick={() => handleThemeChange("dark")}
							dataTestId="mobile-settings-theme-dark"
						/>
					</div>
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				<MobileSettingsSectionLabel>{t("setting.region")}</MobileSettingsSectionLabel>
				<div className={MOBILE_SETTINGS_SECTION_CLASSNAME}>
					<MobileSettingsAppSettingRow
						icon={<Globe className="h-5 w-5" />}
						label={t("setting.language")}
						value={<span className="block truncate">{currentLanguageLabel}</span>}
						showDivider={true}
						onClick={onOpenLanguage}
						dataTestId="mobile-settings-app-language"
					/>
					<MobileSettingsAppSettingRow
						icon={<Clock3 className="h-5 w-5" />}
						label={t("setting.timezone")}
						value={
							<div className="grid w-full grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-1.5">
								<span className="truncate text-right">
									{currentTimezoneSummary.cityLabel}
								</span>
								{currentTimezoneSummary.gmtLabel ? (
									<span className="text-right">
										{currentTimezoneSummary.gmtLabel}
									</span>
								) : null}
							</div>
						}
						valueClassName="w-full"
						onClick={onOpenTimezone}
						dataTestId="mobile-settings-app-timezone"
					/>
				</div>
			</div>

			{/*
			 * 偏好设置：与原型一致放在「地区」之后，承载与桌面端一致的两项追问建议开关。
			 * 这两项控制 userInfo.preferences.show_follow_up_suggestions /
			 * keep_used_follow_up_suggestions，整组共享同一卡片背景。
			 */}
			<div className="flex flex-col gap-2">
				<MobileSettingsSectionLabel>{t("setting.preferences")}</MobileSettingsSectionLabel>
				<div className={MOBILE_SETTINGS_SECTION_CLASSNAME}>
					<MobileSettingsAppSettingSwitchRow
						icon={<MessageCircleQuestion className="h-5 w-5" />}
						label={t("setting.followUpSuggestionsAlwaysShow")}
						description={t("setting.followUpSuggestionsAlwaysShowDescription")}
						checked={followUpSuggestions}
						onCheckedChange={setFollowUpSuggestions}
						showDivider
						dataTestId="mobile-settings-app-follow-up-always-show"
					/>
					<MobileSettingsAppSettingSwitchRow
						icon={<Pin className="h-5 w-5" />}
						label={t("setting.followUpSuggestionsHistoryTurns")}
						description={t("setting.followUpSuggestionsHistoryTurnsDescription")}
						checked={keepUsedFollowUpSuggestions}
						onCheckedChange={setKeepUsedFollowUpSuggestions}
						dataTestId="mobile-settings-app-follow-up-keep-used"
					/>
				</div>
			</div>
		</MobileSettingsSheetContainer>
	)
}
