import { useEffect, useRef, type ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import SmartTooltip from "@/components/other/SmartTooltip"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import { cn } from "@/utils/cn"

export interface HelpNavigationItem {
	id: string
	articleId?: string
	label: string
	path?: string
	icon: ReactNode
	children?: HelpNavigationItem[]
}

export interface HelpNavigationGroup {
	id: string
	label: string
	items: HelpNavigationItem[]
}

interface HelpNavigationProps {
	hint?: string
	groups: HelpNavigationGroup[]
	activeId: string
	expanded: ReadonlySet<string>
	onExpandedChange: (id: string, expanded: boolean) => void
	onSelect: (id: string) => void
}

/** 目录只管理说明导航；折叠状态由当前阅读会话持有，不写入应用侧栏设置。 */
export function HelpNavigation({
	hint,
	groups,
	activeId,
	expanded,
	onExpandedChange,
	onSelect,
}: HelpNavigationProps) {
	const { t } = useTranslation("interface")
	const ref = useRef<HTMLElement>(null)
	useEffect(() => {
		ref.current
			?.querySelector<HTMLElement>('[aria-current="page"]')
			?.scrollIntoView({ block: "nearest" })
	}, [activeId, expanded])
	function renderItem(
		item: HelpNavigationItem,
		depth: number,
		reserveToggle: boolean,
	): ReactNode {
		const hasChildren = Boolean(item.children?.length)
		const open = expanded.has(item.id)
		const active = item.articleId === activeId
		// 文件夹名称打开说明，箭头只展开目录；两个按钮保持独立的键盘操作。
		return (
			<Collapsible
				key={item.id}
				open={open}
				onOpenChange={(value) => onExpandedChange(item.id, value)}
			>
				<div
					style={{ paddingInlineStart: `calc(var(--help-nav-indent) * ${depth})` }}
					className={cn(
						"flex items-center rounded-md pr-1 hover:bg-accent hover:text-accent-foreground",
						active && "bg-accent text-accent-foreground",
					)}
				>
					{hasChildren ? (
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`${open ? t("contextHelp.collapse") : t("contextHelp.expand")} · ${item.label}`}
								className="h-8 w-5 shrink-0 hover:bg-transparent [@media(pointer:coarse)]:h-11"
							>
								{open ? (
									<ChevronDown size={14} aria-hidden />
								) : (
									<ChevronRight size={14} aria-hidden />
								)}
							</Button>
						</CollapsibleTrigger>
					) : reserveToggle ? (
						<span className="w-5 shrink-0" />
					) : null}
					<SmartTooltip
						elementType="span"
						className="min-w-0 flex-1 overflow-visible"
						content={item.path ?? item.label}
						forceShowTooltip={Boolean(item.path)}
						trigger={["hover", "focus"]}
						placement="right"
						tooltipContentClassName={cn(
							"max-w-[min(480px,calc(100vw-2rem))] break-words",
							item.path && "font-mono",
						)}
					>
						<Button
							variant="ghost"
							aria-current={active ? "page" : undefined}
							onClick={() =>
								item.articleId
									? onSelect(item.articleId)
									: onExpandedChange(item.id, !open)
							}
							className={cn(
								"h-auto min-h-9 w-full min-w-0 justify-start gap-2 whitespace-nowrap px-1 py-2 text-left text-[13px] font-normal leading-5 hover:bg-transparent [@media(pointer:coarse)]:min-h-11",
								active && "font-medium",
							)}
						>
							<span className="inline-flex shrink-0" aria-hidden>
								{item.icon}
							</span>
							<span className="min-w-0 truncate">{item.label}</span>
						</Button>
					</SmartTooltip>
				</div>
				{hasChildren && (
					<CollapsibleContent>
						{item.children?.map((child) => renderItem(child, depth + 1, reserveToggle))}
					</CollapsibleContent>
				)}
			</Collapsible>
		)
	}
	function renderGroup(group: HelpNavigationGroup): ReactNode {
		const open = expanded.has(group.id)
		// 分组内有子目录才保留折叠列；后代沿用该列，每级缩进仍递增，保证父子图标对齐。
		const reserveToggle = group.items.some((item) => Boolean(item.children?.length))
		return (
			<Collapsible
				key={group.id}
				open={open}
				onOpenChange={(value) => onExpandedChange(group.id, value)}
			>
				<CollapsibleTrigger asChild>
					<Button
						variant="ghost"
						className="h-auto min-h-9 w-full justify-start gap-1 whitespace-normal px-0 text-left text-sm font-semibold [@media(pointer:coarse)]:min-h-11"
					>
						<span className="flex w-5 shrink-0 items-center justify-center">
							{open ? (
								<ChevronDown size={16} aria-hidden />
							) : (
								<ChevronRight size={16} aria-hidden />
							)}
						</span>
						{group.label}
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent className="mb-3 space-y-1">
					{group.items.map((item) => renderItem(item, 1, reserveToggle))}
				</CollapsibleContent>
			</Collapsible>
		)
	}
	return (
		// 每级只增加一个统一步长；缩进放在行内，选中背景不随目录深度变窄。
		<nav
			ref={ref}
			aria-label={t("contextHelp.contents")}
			className="p-3 [--help-nav-indent:1rem]"
		>
			<p className="px-2 pb-3 text-[11px] leading-5 text-muted-foreground">
				{hint ?? t("contextHelp.catalogHint")}
			</p>
			{groups.map(renderGroup)}
		</nav>
	)
}
