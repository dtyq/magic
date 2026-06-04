import { useState, type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight, RotateCcw, UserPlus, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"

import type { SharedWorkspaceCreatorOption, SharedWorkspaceTab } from "../types"

type SheetView = "main" | "creatorPicker"

interface SharedProjectsFilterSheetProps {
	isOpen: boolean
	tab: SharedWorkspaceTab
	selectedCreatorIds: string[]
	availableCreators: SharedWorkspaceCreatorOption[]
	activeFilterCount: number
	onClose: () => void
	onReset: () => void
	onCreatorToggle: (creatorId: string) => void
	onCreatorRemove: (creatorId: string) => void
}

interface SelectRowProps {
	label: string
	selected: boolean
	onClick: () => void
	leadingSlot?: ReactNode
	testId: string
}

/**
 * 把创建者名称压缩为头像首字母，接口无头像时仍保留稳定识别点。
 */
function getCreatorInitial(name: string) {
	return name.trim().charAt(0).toUpperCase() || "?"
}

/**
 * Sheet 分区标题统一处理间距和弱化颜色。
 */
function SectionLabel({ children }: { children: ReactNode }) {
	return <p className="px-[14px] text-[14px] leading-5 text-muted-foreground">{children}</p>
}

/**
 * Sheet 内部菜单组使用卡片背景，保持和其它移动端底部抽屉一致。
 */
function MenuGroup({ children }: { children: ReactNode }) {
	return <div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">{children}</div>
}

/**
 * 菜单分隔线抽成小组件，避免多处硬编码边框样式。
 */
function Divider() {
	return <div className="h-px w-full bg-border" />
}

/**
 * 筛选行只渲染当前接口真实支持的筛选项，不展示暂不支持的交互。
 */
function SelectRow({ label, selected, onClick, leadingSlot, testId }: SelectRowProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex min-h-12 w-full items-center gap-3 bg-transparent px-[14px] py-2 text-left transition-opacity active:opacity-60"
			data-testid={testId}
		>
			{leadingSlot}
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-[16px] leading-5 text-foreground">{label}</span>
			</span>
			{selected ? <Check className="size-5 shrink-0 text-primary" strokeWidth={2.5} /> : null}
		</button>
	)
}

/**
 * 创建者头像优先展示图片，缺失时回退为首字母圆点。
 */
function CreatorAvatar({ creator }: { creator: SharedWorkspaceCreatorOption }) {
	if (creator.avatarUrl) {
		return (
			<img
				src={creator.avatarUrl}
				alt=""
				className="size-7 shrink-0 rounded-full object-cover"
				aria-hidden
			/>
		)
	}

	return (
		<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] leading-none text-primary-foreground">
			{getCreatorInitial(creator.name)}
		</div>
	)
}

/**
 * 共享项目筛选 Sheet：只渲染当前接口真实支持的筛选项，缺口功能先不出现在 UI 中。
 */
export function SharedProjectsFilterSheet({
	isOpen,
	tab,
	selectedCreatorIds,
	availableCreators,
	activeFilterCount,
	onClose,
	onReset,
	onCreatorToggle,
	onCreatorRemove,
}: SharedProjectsFilterSheetProps) {
	const { t } = useTranslation("super")
	const [view, setView] = useState<SheetView>("main")

	/**
	 * 关闭 Sheet 时重置子视图，保证下次打开仍回到筛选主面板。
	 */
	function handleOpenChange(open: boolean) {
		if (open) return

		setView("main")
		onClose()
	}

	/**
	 * 点击关闭按钮时也同步清理子视图状态。
	 */
	function handleClose() {
		setView("main")
		onClose()
	}

	const selectedCreators = availableCreators.filter((creator) =>
		selectedCreatorIds.includes(creator.id),
	)

	return (
		<MagicPopup
			visible={isOpen}
			onOpenChange={handleOpenChange}
			onClose={handleClose}
			position="bottom"
			title={
				view === "creatorPicker"
					? t("sharedProjects.filter.creatorLabel")
					: t("sharedProjects.filter.title")
			}
			headerVariant="actionHeader"
			headerTitle={
				view === "creatorPicker"
					? t("sharedProjects.filter.creatorLabel")
					: t("sharedProjects.filter.title")
			}
			headerLeadingAction={
				view === "creatorPicker"
					? {
							icon: <ChevronLeft />,
							ariaLabel: t("common.back"),
							onClick: () => setView("main"),
							testId: "shared-projects-filter-creators-back",
						}
					: {
							icon: <X />,
							ariaLabel: t("common.close"),
							onClick: handleClose,
							testId: "shared-projects-filter-close",
						}
			}
			headerTrailingAction={
				view === "main" && activeFilterCount > 0
					? {
							icon: <RotateCcw />,
							ariaLabel: t("sharedProjects.filter.reset"),
							onClick: onReset,
							testId: "shared-projects-filter-reset",
						}
					: undefined
			}
			className="max-h-[78vh] gap-0 rounded-t-[14px] border-0 bg-muted p-0"
			bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
			data-testid="shared-projects-filter-sheet"
		>
			<ScrollEdgeFadeContainer
				fadeColor="muted"
				className="min-h-0 flex-1"
				scrollClassName="no-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 px-[10px] pb-5 pt-2"
				contentDeps={[view, availableCreators.length, selectedCreatorIds.length]}
			>
				{view === "creatorPicker" ? (
					<MenuGroup>
						{availableCreators.map((creator, index) => (
							<div key={creator.id}>
								{index > 0 ? <Divider /> : null}
								<SelectRow
									label={creator.name}
									selected={selectedCreatorIds.includes(creator.id)}
									onClick={() => onCreatorToggle(creator.id)}
									leadingSlot={<CreatorAvatar creator={creator} />}
									testId={`shared-projects-filter-creator-${creator.id}`}
								/>
							</div>
						))}
					</MenuGroup>
				) : (
					<>
						{tab === "sharedWithMe" && availableCreators.length > 0 ? (
							<div className="flex flex-col gap-2">
								<SectionLabel>
									{t("sharedProjects.filter.creatorLabel")}
								</SectionLabel>
								<MenuGroup>
									{selectedCreators.length > 0 ? (
										<>
											<div className="flex flex-wrap gap-2 px-[14px] py-3">
												{selectedCreators.map((creator) => (
													<div
														key={creator.id}
														className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1.5 pr-2"
														data-testid={`shared-projects-filter-creator-chip-${creator.id}`}
													>
														<CreatorAvatar creator={creator} />
														<span className="text-[13px] leading-none text-foreground">
															{creator.name}
														</span>
														<button
															type="button"
															onClick={() =>
																onCreatorRemove(creator.id)
															}
															className="flex size-4 items-center justify-center active:opacity-60"
															aria-label={t(
																"sharedProjects.filter.removeCreator",
																{
																	name: creator.name,
																},
															)}
															data-testid={`shared-projects-filter-creator-remove-${creator.id}`}
														>
															<X className="size-3 text-muted-foreground" />
														</button>
													</div>
												))}
											</div>
											<Divider />
										</>
									) : null}

									<button
										type="button"
										onClick={() => setView("creatorPicker")}
										className="flex h-12 w-full items-center gap-3 bg-transparent px-[14px] transition-opacity active:opacity-60"
										data-testid="shared-projects-filter-add-creator"
									>
										<div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground">
											<UserPlus className="size-3.5 text-muted-foreground" />
										</div>
										<span className="flex-1 text-left text-[16px] leading-5 text-muted-foreground">
											{selectedCreators.length > 0
												? t("sharedProjects.filter.addMoreCreators")
												: t("sharedProjects.filter.addCreator")}
										</span>
										<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
									</button>
								</MenuGroup>
							</div>
						) : null}
					</>
				)}
			</ScrollEdgeFadeContainer>
		</MagicPopup>
	)
}
