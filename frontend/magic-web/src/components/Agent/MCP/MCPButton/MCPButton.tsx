import { useEffect, useState } from "react"
import { IconPlus, IconX } from "@tabler/icons-react"
import MagicScrollBar from "@/components/base/MagicScrollBar"
import MagicButton from "@/components/base/MagicButton"
import { useMemoizedFn, useCreation, useMount } from "ahooks"
import { AgentCommonModal } from "../../AgentCommonModal"
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/shadcn-ui/hover-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { IconMCP } from "@/enhance/tabler/icons-react"
import MagicImage from "@/components/base/MagicImage"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getMCPAccess } from "../store/mcp-access"
import { GuideTourElementId } from "@/pages/superMagic/components/LazyGuideTour"
import AgentSettings from "../AgentSettings"
import { cn } from "@/lib/utils"
import { Plug } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Badge } from "@/components/shadcn-ui/badge"
import { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import { observer } from "mobx-react-lite"

// 懒加载弹窗组件，避免阻塞按钮渲染
// const LazyAgentCommonModal = lazy(() =>
// 	import("../../AgentCommonModal").then((m) => ({ default: m.AgentCommonModal })),
// )
// const LazyAgentSettings = lazy(() => import("../AgentSettings"))

// // 预加载函数：按钮渲染后立即触发，不阻塞渲染
// const preloadModalComponents = () => {
// 	import("../../AgentCommonModal")
// 	import("../AgentSettings")
// }

// Removed antd-style, using Tailwind CSS instead

// Construct a unique AgentModal pop-up instance
// class AgentModal {
// 	static instance: ReturnType<typeof openAgentCommonModal> | null = null

// 	static open(onSuccessCallback?: () => void, storageKey?: string, useTempStorage?: boolean) {
// 		if (AgentModal.instance) {
// 			AgentModal.instance?.onClose?.()
// 			AgentModal.instance = null
// 		} else {
// 			AgentModal.instance = openAgentCommonModal({
// 				width: 900,
// 				footer: null,
// 				closable: false,
// 				onClose: () => {
// 					AgentModal.instance = null
// 				},
// 				children: (
// 					<AgentSettings
// 						onSuccessCallback={onSuccessCallback}
// 						storageKey={storageKey}
// 						useTempStorage={useTempStorage}
// 					/>
// 				),
// 			})
// 		}
// 	}
// }

export interface MCPButtonProps {
	className?: string
	/** Storage value (affected by the business scope of MCP, currently it needs to be associated with the Super Maggie project when using MCP configuration in Super Maggie) */
	storageKey?: string
	size?: MessageEditorSize
	iconSize?: number
	/** 是否使用本地临时存储模式（不通过接口保存） */
	useTempStorage?: boolean
}

/**
 * @description MCP button component
 * Current component storage strategy uses `ProjectStorage` Super Magic project association storage strategy
 * @param props
 * @constructor
 */
function MCPButton(props?: MCPButtonProps) {
	const { useTempStorage = false, iconSize = 20, size } = props || {}
	const isMobile = useIsMobile()
	const { t } = useTranslation("agent")

	const [modalOpen, setModalOpen] = useState(false)
	const mcpAccess = useCreation(
		() =>
			getMCPAccess({
				storageKey: props?.storageKey,
				useTempStorage,
			}),
		[props?.storageKey, useTempStorage],
	)

	const triggerRemoveMCP = useMemoizedFn(async (id: string) => {
		await mcpAccess.remove(id)
	})

	useEffect(() => {
		mcpAccess.load().catch(console.error)
	}, [mcpAccess])

	const displayMCPList = mcpAccess.mcpList
	const count = displayMCPList.length

	const openModal = useMemoizedFn(() => {
		setModalOpen(true)
	})

	const closeModal = useMemoizedFn(() => {
		setModalOpen(false)
	})

	useMount(() => {
		pubsub.publish(PubSubEvents.GuideTourElementReady, GuideTourElementId.MCPButton)
		// 按钮渲染后立即预加载弹窗组件
		// preloadModalComponents()
	})

	const button = (
		<button
			type="button"
			id={GuideTourElementId.MCPButton}
			title={t("mcp.button.text")}
			className={cn(
				"flex items-center justify-center gap-1 rounded-md border-0 bg-[#f5f5f5] text-foreground transition-all hover:opacity-80 active:opacity-60",
				"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
				size === "small" ? "h-6" : "h-8",
				props?.className,
			)}
			onClick={openModal}
			data-testid="mcp-button"
			data-count={count}
			data-active={count > 0}
		>
			<Plug size={iconSize} />
			{count > 0 && (
				<Badge
					variant="outline"
					className="h-5 overflow-visible rounded-md bg-white px-2 py-0.5 text-xs font-semibold"
				>
					{count}
				</Badge>
			)}
		</button>
	)

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Open_MCP_Config, openModal)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_MCP_Config, openModal)
		}
	}, [openModal])

	// 声明式弹窗（懒加载，不阻塞按钮渲染）
	// const modal = (
	// 	<Suspense fallback={null}>
	// 		<LazyAgentCommonModal
	// 			open={modalOpen}
	// 			onOpenChange={setModalOpen}
	// 			width={900}
	// 			footer={null}
	// 			closable={false}
	// 		>
	// 			<LazyAgentSettings
	// 				onSuccessCallback={refresh}
	// 				storageKey={props?.storageKey}
	// 				useTempStorage={useTempStorage}
	// 				onClose={closeModal}
	// 			/>
	// 		</LazyAgentCommonModal>
	// 	</Suspense>
	// )
	const modal = (
		<AgentCommonModal
			open={modalOpen}
			onOpenChange={setModalOpen}
			width={900}
			footer={null}
			closable={false}
		>
			<AgentSettings
				storageKey={props?.storageKey}
				useTempStorage={useTempStorage}
				onClose={closeModal}
			/>
		</AgentCommonModal>
	)

	// Mobile view
	if (isMobile) {
		return (
			<>
				{button}
				{modal}
			</>
		)
	}

	// Show Tooltip when no plugins are enabled
	if (count === 0) {
		return (
			<>
				<Tooltip>
					<TooltipTrigger asChild>{button}</TooltipTrigger>
					<TooltipContent side="top" className="z-[1200]">
						{t("mcp.button.text")}
					</TooltipContent>
				</Tooltip>
				{modal}
			</>
		)
	}

	const content = (
		<div className="flex flex-col items-start gap-1">
			<div className="flex w-full items-center justify-between px-2.5 py-1.5">
				<span className="text-xs font-semibold leading-4 text-foreground">
					{t("mcp.button.title")}
				</span>
				<MagicButton
					className="gap-0.5 rounded-lg px-1.5 text-xs shadow-none outline-none"
					icon={<IconPlus size={14} />}
					onClick={openModal}
				>
					{t("mcp.button.create")}
				</MagicButton>
			</div>
			<MagicScrollBar
				className="max-h-[200px] w-full [&_.simplebar-content]:px-1"
				autoHide={false}
			>
				{displayMCPList.map((item) => (
					<div
						className="flex items-center gap-2.5 self-stretch px-2.5 py-3"
						key={item.id}
					>
						<MagicImage
							className="h-10 w-10 flex-none overflow-hidden rounded-lg"
							src={item?.icon}
							alt={item?.name}
							fallback={
								<div className="h-10 w-10 flex-none overflow-hidden rounded-lg">
									<IconMCP size="100%" />
								</div>
							}
						/>
						<div className="flex flex-1 flex-col gap-0.5">
							<div className="line-clamp-1 self-stretch text-sm font-semibold leading-5 text-foreground">
								{item.name}
							</div>
							<div className="line-clamp-1 self-stretch overflow-hidden text-ellipsis text-xs font-normal leading-4 text-muted-foreground">
								{item?.description || t("mcp.card.desc")}
							</div>
						</div>
						<div
							className="flex aspect-square h-6 w-6 cursor-pointer items-center justify-center gap-0.5 rounded border border-border px-1.5 hover:bg-accent/50 active:bg-accent"
							onClick={() => triggerRemoveMCP(item.id)}
						>
							<IconX size={16} />
						</div>
					</div>
				))}
			</MagicScrollBar>
		</div>
	)

	return (
		<>
			<HoverCard openDelay={100} closeDelay={100}>
				<HoverCardTrigger asChild>{button}</HoverCardTrigger>
				<HoverCardContent
					side="top"
					align="center"
					className="z-[1200] w-[300px] rounded-lg bg-white p-1 shadow-lg"
				>
					{content}
				</HoverCardContent>
			</HoverCard>
			{modal}
		</>
	)
}

export default observer(MCPButton)
