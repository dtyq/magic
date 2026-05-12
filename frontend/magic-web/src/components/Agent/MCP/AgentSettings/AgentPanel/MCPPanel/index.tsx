import { IconPlug, IconX, IconSearch, IconPlus } from "@tabler/icons-react"
import type { BasePanel } from "../types"
import { Segmented } from "antd"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import NoDataImage from "@/assets/resources/defaultImages/no_data.svg"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { observer } from "mobx-react-lite"
import { MCPItem } from "./MCPItem"
import { MCPUserGroup, useMCPPanelController } from "./useMCPPanelController"

const segmentedClassName = cn(
	"rounded-md border border-border p-1",
	"[&_.magic-segmented-group]:gap-0.5",
	"[&_.magic-segmented-item-label]:min-h-6",
	"[&_.magic-segmented-item-label]:rounded-[4px]",
	"[&_.magic-segmented-item-label]:px-2",
	"[&_.magic-segmented-item-label]:text-xs",
	"[&_.magic-segmented-item-label]:font-normal",
	"[&_.magic-segmented-item-label]:leading-6",
	"[&_.magic-segmented-item-label]:text-muted-foreground",
	"[&_.magic-segmented-item-selected]:shadow-[0_4px_14px_0_rgba(0,0,0,0.1),0_0_1px_0_rgba(0,0,0,0.3)]",
	"[&_.magic-segmented-item-selected_.magic-segmented-item-label]:font-semibold",
	"[&_.magic-segmented-item-selected_.magic-segmented-item-label]:text-foreground",
)

interface MCPPanelProps extends BasePanel {
	onSuccessCallback?: () => void
	/** Storage value (affected by the business scope of MCP, currently it needs to be associated with the Super Maggie project when using MCP configuration in Super Maggie) */
	storageKey?: string
	/** 是否使用临时存储模式 */
	useTempStorage?: boolean
}

export const MCPPanel = observer(function MCPPanel(props: MCPPanelProps) {
	const { onClose, onSuccessCallback, storageKey, useTempStorage = false } = props

	const { t } = useTranslation("agent")
	const controller = useMCPPanelController({
		onSuccessCallback,
		storageKey,
		useTempStorage,
	})
	const {
		isMobile,
		type,
		setType,
		searchText,
		setSearchText,
		data,
		loading,
		openCreateForm,
		openEditForm,
		onStatusChange,
		usableCache,
	} = controller

	const options = useMemo(() => {
		return [
			{
				value: MCPUserGroup.Official,
				label: t("mcp.panel.official"),
			},
			{
				value: MCPUserGroup.Organization,
				label: t("mcp.panel.custom"),
			},
			// {
			// 	value: MCPUserGroup.Person,
			// 	label: "自定义 MCP",
			// },
		]
	}, [t])

	const scrollDom = useMemo(
		() => (
			<div
				className="flex flex-col gap-2.5 overflow-hidden px-0 pt-2.5"
				data-testid="agent-mcp-panel-content"
			>
				<div className="flex h-8 w-full flex-none items-center justify-between px-2.5">
					<Segmented<string>
						value={type}
						className={segmentedClassName}
						onChange={(rawType) => setType(rawType as MCPUserGroup)}
						options={options}
						name="label"
						data-testid="agent-mcp-panel-group-segmented"
					/>
					{type === MCPUserGroup.Organization && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 px-3"
							onClick={openCreateForm}
							data-testid="agent-mcp-panel-open-form-button"
						>
							<IconPlus size={16} />
							{t("mcp.panel.openForm")}
						</Button>
					)}
				</div>
				<div className="flex min-h-[400px] w-full flex-1 overflow-hidden">
					{loading ? (
						<div className="flex h-full w-full items-center justify-center">
							<Spinner className="animate-spin text-muted-foreground" size={16} />
						</div>
					) : (
						<ScrollArea
							className="h-full w-full"
							viewportClassName="px-2.5"
							data-testid="agent-mcp-panel-list"
						>
							{data?.map((item) => (
								<MCPItem
									key={item.id}
									item={item}
									selected={usableCache.has(item.id)}
									onStatusChange={onStatusChange}
									onClick={openEditForm}
								/>
							))}
							{data && data?.length < 1 && (
								<div
									className="mx-auto mt-20 flex w-[200px] flex-col items-center justify-center gap-1"
									data-testid="agent-mcp-panel-empty"
								>
									<img src={NoDataImage} alt="" />
									<span className="text-muted-foreground">
										{t("mcp.panel.empty")}
									</span>
								</div>
							)}
						</ScrollArea>
					)}
				</div>
			</div>
		),
		[
			data,
			loading,
			onStatusChange,
			openCreateForm,
			openEditForm,
			options,
			setType,
			t,
			type,
			usableCache,
		],
	)

	if (isMobile) {
		return (
			<div className="flex h-full flex-col" data-testid="agent-mcp-panel">
				<div
					className="flex w-full flex-col gap-2.5 border-b border-border p-5 backdrop-blur-[12px]"
					data-testid="agent-mcp-panel-mobile-header"
				>
					<div className="flex w-full items-center gap-2">
						<div className="size-[30px] overflow-hidden rounded-md">
							<span className="flex size-[30px] items-center justify-center bg-black text-white">
								<IconPlug size="24" />
							</span>
						</div>
						<div>
							<div className="text-sm font-semibold leading-5 text-foreground">
								{t("mcp.panel.title")}
							</div>
							<div className="text-xs font-normal leading-4 text-muted-foreground">
								{t("mcp.panel.desc")}
							</div>
						</div>
					</div>
					<div className="inline-flex w-full items-center gap-2.5">
						<div className="relative w-full">
							<IconSearch
								size={16}
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								value={searchText}
								onChange={(event) => setSearchText(event.target.value)}
								placeholder={t("mcp.panel.searchPlaceholder")}
								className="pl-9"
								data-testid="agent-mcp-panel-search-input"
							/>
						</div>
					</div>
				</div>
				{scrollDom}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col" data-testid="agent-mcp-panel">
			<div
				className="flex items-center justify-between gap-2.5 border-b border-border p-5 backdrop-blur-[12px]"
				data-testid="agent-mcp-panel-header"
			>
				<div className="flex h-full items-center gap-2">
					<div className="size-[30px] overflow-hidden rounded-md">
						<span className="flex size-[30px] items-center justify-center bg-black text-white">
							<IconPlug size="24" />
						</span>
					</div>
					<div>
						<div className="text-sm font-semibold leading-5 text-foreground">
							{t("mcp.panel.title")}
						</div>
						<div className="text-xs font-normal leading-4 text-muted-foreground">
							{t("mcp.panel.desc")}
						</div>
					</div>
				</div>
				<div className="inline-flex items-center gap-2.5">
					<div className="relative w-[240px]">
						<IconSearch
							size={16}
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							value={searchText}
							onChange={(event) => setSearchText(event.target.value)}
							placeholder={t("mcp.panel.searchPlaceholder")}
							className="pl-9"
							data-testid="agent-mcp-panel-search-input"
						/>
					</div>
					<button
						type="button"
						className={cn(
							"flex size-6 items-center justify-center rounded-[4px]",
							"hover:bg-fill active:bg-fill-secondary",
							"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						)}
						onClick={onClose}
						data-testid="agent-mcp-panel-close-button"
					>
						<IconX size={24} />
					</button>
				</div>
			</div>
			{scrollDom}
		</div>
	)
})
