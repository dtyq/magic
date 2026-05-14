import { ChevronRight } from "lucide-react"

import { MOBILE_SETTINGS_SECTION_CLASSNAME } from "../constants"
import type { MobileSettingsMenuItemConfig } from "../types"

/** 菜单行统一收口图标、间距和分隔线，避免主设置浮层的多组菜单各自维护样式。 */
function MobileSettingsMenuRow(props: {
	icon: React.ReactNode
	label: string
	value?: React.ReactNode
	onClick?: () => void
	disabled?: boolean
	danger?: boolean
	chevron?: boolean
	showDivider?: boolean
	dataTestId: string
}) {
	const {
		icon,
		label,
		value,
		onClick,
		disabled = false,
		danger = false,
		chevron = true,
		showDivider = false,
		dataTestId,
	} = props

	return (
		<>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				className="flex h-12 w-full items-center gap-3 bg-transparent px-3.5 transition-opacity active:opacity-60 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:opacity-50"
				data-testid={dataTestId}
			>
				<div
					className={`flex h-5 w-5 shrink-0 items-center justify-center ${
						danger ? "text-destructive" : "text-foreground"
					}`}
				>
					{icon}
				</div>
				<span
					className={`flex-1 text-left text-base leading-5 ${
						danger ? "text-destructive" : "text-foreground"
					}`}
				>
					{label}
				</span>
				{value ? (
					<span className="shrink-0 text-sm tabular-nums text-muted-foreground">
						{value}
					</span>
				) : null}
				{chevron && !danger && !disabled ? (
					<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
				) : null}
			</button>
			{showDivider ? (
				<div className="pl-3.5">
					<div className="h-px w-full bg-border" />
				</div>
			) : null}
		</>
	)
}

/** 用配置数组渲染菜单分组，让设置首页新增或排序菜单时只维护一份声明。 */
export function MobileSettingsMenuSection(props: { items: MobileSettingsMenuItemConfig[] }) {
	const { items } = props

	return (
		<div className={MOBILE_SETTINGS_SECTION_CLASSNAME}>
			{items.map((item, index) => (
				<MobileSettingsMenuRow
					key={item.dataTestId}
					icon={item.icon}
					label={item.label}
					value={item.value}
					onClick={item.onClick}
					disabled={item.disabled}
					danger={item.danger}
					chevron={item.chevron}
					showDivider={index < items.length - 1}
					dataTestId={item.dataTestId}
				/>
			))}
		</div>
	)
}
