import { X } from "lucide-react"
import { type ButtonHTMLAttributes, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LucideLazyIcon } from "@/opensource/utils/lucideIconLoader"
import { SceneItem } from "../../../types/skill"

export type SelectedSkillBadgeVariant = "prefixedBadge" | "outlineButton"

export interface SelectedSkillBadgeRenderProps {
	skill: SceneItem
	icon: ReactNode
	inUseLabel: string
	closeButtonProps: ButtonHTMLAttributes<HTMLButtonElement>
}

interface SelectedSkillBadgeProps {
	scene: SceneItem
	onClose?: () => void
	variant?: SelectedSkillBadgeVariant
	render?: (props: SelectedSkillBadgeRenderProps) => ReactNode
}

const DESKTOP_ICON_SIZE = 16

// Create a lighter background color from the base color
function getLighterBackgroundColor(color: string): string {
	return `color-mix(in srgb, ${color} 10%, white)`
}

function getSkillIcon(skill: SceneItem): ReactNode {
	const isImage = skill.icon && (skill.icon.startsWith("http") || skill.icon.startsWith("/"))
	return isImage ? (
		<img
			src={skill.icon}
			alt={skill.name}
			width={DESKTOP_ICON_SIZE}
			height={DESKTOP_ICON_SIZE}
			className="rounded"
		/>
	) : (
		<LucideLazyIcon icon={skill.icon} size={DESKTOP_ICON_SIZE} />
	)
}

function PrefixedBadgeSelectedSkillBadge({
	skill,
	icon,
	inUseLabel,
	closeButtonProps,
}: SelectedSkillBadgeRenderProps) {
	const themeColor = skill.theme_color ?? "#000"
	const { t } = useTranslation("crew/create")
	return (
		<div className="flex w-full items-center gap-2 px-[6px]">
			<span className="whitespace-nowrap text-sm font-normal leading-5 text-foreground">
				{inUseLabel}
			</span>
			<div
				className="flex h-6 items-center justify-center gap-2 rounded-[6px] border border-solid px-2"
				style={{
					borderColor: themeColor,
					backgroundColor: getLighterBackgroundColor(themeColor),
				}}
			>
				<div className="size-4 shrink-0" style={{ color: themeColor }}>
					{icon}
				</div>
				<span
					className="whitespace-nowrap text-sm font-normal leading-5"
					style={{ color: themeColor }}
				>
					{skill.name || t("playbook.untitled")}
				</span>
				<button
					{...closeButtonProps}
					className="size-4 shrink-0 transition-opacity hover:opacity-70"
				>
					<X className="size-4" style={{ color: themeColor }} />
				</button>
			</div>
		</div>
	)
}

function OutlineButtonSelectedSkillBadge({
	skill,
	icon,
	closeButtonProps,
}: SelectedSkillBadgeRenderProps) {
	const themeColor = skill.theme_color ?? "#000"
	const { t } = useTranslation("crew/create")
	return (
		<div className="inline-flex items-center">
			<div
				className="shadow-xs flex h-[30px] items-center justify-center gap-2 rounded-full border border-border bg-background px-2.5"
				style={{
					borderColor: themeColor,
					backgroundColor: getLighterBackgroundColor(themeColor),
				}}
			>
				<div
					className="flex size-4 shrink-0 items-center justify-center text-foreground"
					style={{ color: themeColor }}
				>
					{icon}
				</div>
				<span
					className="whitespace-nowrap text-sm font-normal leading-5 text-foreground"
					style={{ color: themeColor }}
				>
					{skill.name || t("playbook.untitled")}
				</span>
				<button
					{...closeButtonProps}
					className="flex size-4 shrink-0 items-center justify-center rounded-sm transition-opacity hover:bg-black/10 hover:opacity-70"
					style={{ color: themeColor }}
				>
					<X className="size-4" />
				</button>
			</div>
		</div>
	)
}

function CurrentSceneBadge({
	scene: scene,
	onClose,
	variant = "prefixedBadge",
	render,
}: SelectedSkillBadgeProps) {
	const { t } = useTranslation("super/mainInput")
	const icon = getSkillIcon(scene)

	const closeButtonProps: ButtonHTMLAttributes<HTMLButtonElement> = {
		type: "button",
		onClick: (e) => {
			e.stopPropagation()
			onClose?.()
		},
		"aria-label": t("selectedSkillBadge.closeAriaLabel"),
	}

	const renderProps: SelectedSkillBadgeRenderProps = {
		skill: scene,
		icon,
		inUseLabel: t("selectedSkillBadge.inUse"),
		closeButtonProps,
	}

	if (render) {
		return <>{render(renderProps)}</>
	}

	if (variant === "outlineButton") {
		return <OutlineButtonSelectedSkillBadge {...renderProps} />
	}

	return <PrefixedBadgeSelectedSkillBadge {...renderProps} />
}

export default CurrentSceneBadge
