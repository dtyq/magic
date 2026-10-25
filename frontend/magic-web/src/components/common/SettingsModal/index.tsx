import { cn } from "@/utils/cn"
import {
	useMemo,
	useState,
	createElement,
	isValidElement,
	cloneElement,
	type ReactElement,
} from "react"
import { IconX } from "@tabler/icons-react"
import type { SettingsModalProps, SettingsModalChildrenProps } from "./types"
import { Tabs } from "antd-mobile"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"

/**
 * Render caller-provided setting panels with a desktop sidebar or mobile tab header.
 * Each tab owns its content and scrolling; the shell keeps navigation outside that content.
 * The selected child receives onClose so it can close the containing modal after an action.
 */
export default function SettingsModal(props: SettingsModalProps) {
	const { t } = useTranslation("super")
	const { onClose, tabs, defaultTab } = props

	const isMobile = useIsMobile()

	const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key)

	const currentPanel = useMemo(() => {
		const tab = tabs.find((t) => t.key === activeTab)
		const child: ReactElement<SettingsModalChildrenProps> | undefined = tab?.component
		return (
			<div className="flex h-full min-w-0 flex-auto flex-col overflow-hidden">
				{child && isValidElement(child) && cloneElement(child, { onClose })}
			</div>
		)
	}, [tabs, activeTab, onClose])

	if (isMobile) {
		return (
			<div className="flex h-[76vh] w-full flex-col">
				<div className="flex h-[52px] w-full flex-none items-center justify-between p-2.5">
					<Tabs onChange={(e) => setActiveTab(e as string)}>
						{tabs.map((tab) => {
							return (
								<Tabs.Tab
									title={
										<div
											className={cn(
												"flex w-full cursor-pointer items-center gap-1 self-stretch rounded-[4px] px-2.5 py-1.5 leading-5 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]",
												tab.key === activeTab && "text-primary",
											)}
										>
											{tab?.icon && createElement(tab.icon, { size: 16 })}
											<span>{tab?.label}</span>
										</div>
									}
									key={tab.key}
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
				{currentPanel}
			</div>
		)
	}

	return (
		<div className="flex h-[600px] w-full items-start overflow-hidden rounded-[12px] bg-background">
			<div className="flex h-full w-[200px] flex-none shrink-0 flex-col items-start justify-between self-stretch border-r border-border bg-neutral-50 p-3.5 dark:bg-neutral-900">
				<div className="mb-2.5 flex w-full flex-col gap-1 last:mb-0">
					<div className="w-full text-xs font-normal not-italic leading-4 text-foreground/40">
						{t("shareManagement.title")}
					</div>
					{tabs.map((tab) => {
						return (
							<div
								key={tab.key}
								onClick={() => setActiveTab(tab.key)}
								className={cn(
									"flex w-full cursor-pointer items-center gap-1 self-stretch rounded-[4px] px-2.5 py-1.5 leading-5 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]",
									tab.key === activeTab && "bg-fill dark:bg-white/10",
								)}
							>
								{tab?.icon && createElement(tab.icon, { size: 16 })}
								{tab.label}
							</div>
						)
					})}
				</div>
			</div>
			{currentPanel}
		</div>
	)
}
