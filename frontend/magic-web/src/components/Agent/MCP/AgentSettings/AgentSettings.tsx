import { cn } from "@/utils/cn"
import {
	useMemo,
	useState,
	useRef,
	createElement,
	isValidElement,
	cloneElement,
	ReactElement,
} from "react"
import { MCPPanel } from "./AgentPanel"
import {
	/** IconClockPlay, IconMailShare, IconHeart, */ IconX,
	IconPlug,
} from "@tabler/icons-react"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import { useTranslation } from "react-i18next"
import { Tabs } from "antd-mobile"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useSize } from "ahooks"

// Switch to the single-column settings shell before the desktop split view becomes cramped.
const COMPACT_LAYOUT_BREAKPOINT = 760

export const enum PanelType {
	MCP = "MCP",
	// ScheduledTasks = "ScheduledTasks",
}

export interface AgentCommonProps extends AgentCommonModalChildrenProps {
	defaultPanel?: PanelType
	/** Storage value (affected by the business scope of MCP, currently it needs to be associated with the Super Maggie project when using MCP configuration in Super Maggie) */
	storageKey?: string
	onSuccessCallback?: () => void
	/** Use temporary local storage instead of persisting project settings through the API. */
	useTempStorage?: boolean
}

export default function AgentSettings(props: AgentCommonProps) {
	const { onClose, defaultPanel, storageKey, onSuccessCallback, useTempStorage } = props

	const { t } = useTranslation("agent")
	const isMobile = useIsMobile()
	const containerRef = useRef<HTMLDivElement>(null)
	const containerSize = useSize(containerRef)
	// Measure the actual embedded container so narrow desktop iframes get a usable layout.
	const isCompactLayout =
		!isMobile &&
		containerSize?.width !== undefined &&
		containerSize.width < COMPACT_LAYOUT_BREAKPOINT

	const [panelType, setPanelType] = useState(defaultPanel || PanelType.MCP)

	const menu = useMemo(() => {
		return {
			[PanelType.MCP]: {
				key: PanelType.MCP,
				label: t("common.settings.mcp"),
				icon: IconPlug,
				component: (
					<MCPPanel
						onSuccessCallback={onSuccessCallback}
						storageKey={storageKey}
						useTempStorage={useTempStorage}
						compact={isCompactLayout}
					/>
				),
			},
			// [PanelType.ScheduledTasks]: {
			// 	key: PanelType.ScheduledTasks,
			// 	icon: IconClockPlay,
			// 	label: t("common.settings.tasks"),
			// 	component: ScheduledTasksPanel,
			// },
		}
	}, [isCompactLayout, onSuccessCallback, storageKey, t, useTempStorage])

	const panel = useMemo(() => {
		const child: ReactElement<AgentCommonModalChildrenProps> = menu[panelType]?.component
		return (
			<div className="flex h-full min-w-0 flex-auto flex-col overflow-hidden">
				{child && isValidElement(child) && cloneElement(child, { onClose })}
			</div>
		)
	}, [menu, onClose, panelType])

	if (isMobile || isCompactLayout) {
		return (
			<div
				ref={containerRef}
				className={cn(
					"flex min-h-0 w-full flex-col",
					isCompactLayout ? "h-full" : "h-[76vh]",
				)}
			>
				<div className="flex h-[52px] w-full flex-none items-center justify-between p-2.5">
					<Tabs onChange={(e) => setPanelType(e as PanelType)}>
						{(Object.keys(menu) as Array<keyof typeof menu>).map((key) => {
							const o = menu[key]
							return (
								<Tabs.Tab
									title={
										<div
											className={cn(
												"flex w-full cursor-pointer items-center gap-1 self-stretch rounded-[4px] px-2.5 py-1.5 leading-5 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]",
												key === panelType && "text-primary",
											)}
										>
											{o?.icon && createElement(o.icon, { size: 16 })}
											<span>{o?.label}</span>
										</div>
									}
									key={o.key}
								/>
							)
						})}
					</Tabs>
					<div
						className="flex size-6 cursor-pointer items-center justify-center rounded-[4px] hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
						onClick={onClose}
					>
						<IconX size={24} />
					</div>
				</div>
				{panel}
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			className="flex h-[600px] w-full items-start overflow-hidden rounded-[12px] bg-background"
		>
			<div className="flex h-full w-[200px] flex-none shrink-0 flex-col items-start justify-between self-stretch border-r border-border bg-neutral-50 p-3.5 dark:bg-neutral-900">
				<div className="mb-2.5 flex w-full flex-col gap-2.5 last:mb-0">
					<div className="w-full text-xs font-normal not-italic leading-4 text-foreground/40">
						{t("common.settings.func")}
					</div>
					{(Object.keys(menu) as Array<keyof typeof menu>).map((key) => {
						const item = menu[key]
						return (
							<div
								key={key}
								onClick={() => setPanelType(key)}
								className={cn(
									"flex w-full cursor-pointer items-center gap-1 self-stretch rounded-[4px] px-2.5 py-1.5 leading-5 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]",
									key === panelType && "bg-fill dark:bg-white/10",
								)}
							>
								{item?.icon && createElement(item.icon, { size: 16 })}
								{item.label}
							</div>
						)
					})}
				</div>
			</div>
			{panel}
		</div>
	)
}
