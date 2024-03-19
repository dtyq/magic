import { useEffect, useRef, useState } from "react"
import { Users } from "lucide-react"
import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import { AgentType, type CrewItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/opensource/components/shadcn-ui/tabs"
import { Empty, EmptyMedia, EmptyTitle } from "@/opensource/components/shadcn-ui/empty"

import CrewListItem from "./CrewListItem"

interface CrewSelectModalProps {
	visible: boolean
	modes: CrewItem[]
	selectedCrew: string
	onClose: () => void
	onSelectCrew: (mode: CrewItem) => void
}

enum TabType {
	Official = "official",
	My = "my",
}

export default function CrewSelectModal({
	visible,
	modes,
	selectedCrew,
	onClose,
	onSelectCrew,
}: CrewSelectModalProps) {
	const { t } = useTranslation("super/mainInput")

	// 官方数字员工
	const officialCrews = modes.filter((mode) => mode.agent.type === AgentType.Official)
	// 我的数字员工
	const myCrews = modes.filter(
		(mode) => mode.agent.type === AgentType.Custom || mode.agent.type === AgentType.Public,
	)

	const [activeTab, setActiveTab] = useState<TabType>(TabType.Official)

	const handleTabChange = useMemoizedFn((v: string) => setActiveTab(v as TabType))

	// 每次弹窗打开时，优先选中有数据的 tab，避免 modes 异步加载导致初始值错误
	useEffect(() => {
		if (!visible) return
		setActiveTab(officialCrews.length > 0 ? TabType.Official : TabType.My)
	}, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

	// Official → AgentType.Official；My → AgentType.Custom | AgentType.Public
	const filteredCrews = activeTab === TabType.Official ? officialCrews : myCrews

	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const selectedItemRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!visible) return
		// visible 变为 true 后，等待 MagicPopup children 渲染完成及 Vaul Drawer 入场动画结束
		const timer = setTimeout(() => {
			const container = scrollContainerRef.current
			const selectedItem = selectedItemRef.current
			if (!container || !selectedItem) return
			const containerRect = container.getBoundingClientRect()
			const itemRect = selectedItem.getBoundingClientRect()
			const targetScrollTop =
				container.scrollTop +
				(itemRect.top - containerRect.top) -
				(containerRect.height - itemRect.height) / 2
			container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" })
		}, 200)
		return () => clearTimeout(timer)
	}, [visible])

	const handleSelect = useMemoizedFn((crew: CrewItem) => {
		onSelectCrew(crew)
	})

	return (
		<MagicPopup visible={visible} onClose={onClose}>
			<div className="flex flex-col">
				{/* Header：标题 + 设置按钮 */}
				<div className="flex h-12 items-center gap-1.5 px-4">
					<div className="flex-1 text-lg font-semibold leading-none text-foreground">
						{t("crewSelectModal.title")}
					</div>
					{/* 数字员工编排功能 - 暂时隐藏 */}
					{/* <div className="flex size-9 cursor-pointer items-center justify-center rounded-md active:opacity-70">
						<Settings size={20} className="text-foreground" />
					</div> */}
				</div>

				{/* Tab 切换器（Official / My） */}
				<div className="w-[200px] px-4 pb-3">
					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<TabsList className="w-full rounded-[10px]">
							<TabsTrigger value={TabType.Official} className="font-medium">
								{t("crewSelectModal.tab.official")}
							</TabsTrigger>
							<TabsTrigger value={TabType.My} className="font-medium">
								{t("crewSelectModal.tab.my")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
					{/* Create Buddy 按钮 —— 暂时隐藏 */}
				</div>

				{/* Crew 列表 */}
				<div
					ref={scrollContainerRef}
					className="no-scrollbar h-[520px] overflow-y-auto px-4 pb-4"
				>
					{filteredCrews.length === 0 ? (
						<Empty className="h-full gap-2 border-0 text-center">
							<EmptyMedia variant="icon">
								<Users />
							</EmptyMedia>
							<EmptyTitle className="text-sm text-muted-foreground">
								{activeTab === TabType.Official
									? t("crewSelectModal.empty.official")
									: t("crewSelectModal.empty.my")}
							</EmptyTitle>
						</Empty>
					) : (
						<div className="flex flex-col gap-3">
							{filteredCrews.map((crew) => {
								const isActive = selectedCrew === crew.mode.identifier
								return (
									<div
										key={crew.mode.identifier}
										ref={isActive ? selectedItemRef : null}
									>
										<CrewListItem
											crew={crew}
											isActive={isActive}
											onClick={handleSelect}
										/>
									</div>
								)
							})}
						</div>
					)}
				</div>
			</div>
		</MagicPopup>
	)
}
