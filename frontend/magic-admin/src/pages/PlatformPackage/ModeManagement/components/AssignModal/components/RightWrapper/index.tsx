import { useMemo } from "react"
import { Divider, Empty, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { MagicSelect, MagicButton } from "components"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { PlatformPackage } from "@/types/platformPackage"
import { useMount } from "ahooks"
import { useStyles } from "../../styles"
import GroupItem from "../GroupItem"
import { useModeConfigContext } from "../../hooks/useModeConfigContext"

const RightWrapper = () => {
	const { t } = useTranslation("admin/platform/mode")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()

	const {
		state,
		modeDetail,
		groupList,
		flowModeOptions,
		flowModeList,
		flowModeLoading,
		info,
		changeFlowMode,
		changeDistributionType,
		openAddOrEditGroupModal,
		wrappedGoToEdit,
		fetchFlowModeList,
	} = useModeConfigContext()

	const mode = modeDetail?.mode

	const isCustomConfig = state.distributionMethod === PlatformPackage.DistributionType.Independent

	const distributionMethodOptions = useMemo(() => {
		return [
			{
				label: t("customConfig"),
				value: PlatformPackage.DistributionType.Independent,
			},
			{
				label: t("flowOtherModel"),
				value: PlatformPackage.DistributionType.Follow,
			},
		]
	}, [t])

	const filterFlowModeOptions = useMemo(() => {
		return flowModeOptions?.filter((item) => item.value !== info?.id)
	}, [flowModeOptions, info])

	// 初始化加载模式列表
	useMount(() => {
		if (flowModeList.list.length === 0) {
			fetchFlowModeList({ page: 1, page_size: 20 }, true)
		}
	})

	// 处理下拉菜单滚动事件，实现分页加载
	const handlePopupScroll = (event: any) => {
		const { target } = event
		const hasMore = flowModeList.list.length < flowModeList.total
		// 当滚动到底部时加载更多数据
		if (
			!flowModeLoading &&
			hasMore &&
			target.scrollTop + target.offsetHeight >= target.scrollHeight - 20
		) {
			const currentPage = Math.ceil(flowModeList.list.length / 20)
			fetchFlowModeList({ page: currentPage + 1, page_size: 20 }, false)
		}
	}

	return (
		<Flex vertical gap={10} className={styles.content} flex={1}>
			<Flex justify="space-between" align="center">
				<Flex vertical gap={4}>
					<div className={styles.title}>{t("modelAssignMethod")}</div>
					<span className={styles.desc}>{t("modelAssignMethodDesc")}</span>
				</Flex>
				<MagicSelect
					options={distributionMethodOptions}
					value={state.distributionMethod}
					onChange={changeDistributionType}
					disabled={mode?.is_default === 1}
					style={{ width: 240 }}
				/>
			</Flex>
			<Divider style={{ margin: 0 }} />
			<Flex justify="space-between" align="center">
				<Flex vertical gap={4}>
					<div className={styles.title}>
						{isCustomConfig ? t("availableModel") : t("flowModel")}
					</div>
					<span className={styles.desc}>
						{isCustomConfig
							? t("availableModelDesc")
							: state.flowMode && (
									<div>
										<span>{t("flowModelDesc")}</span>
										<span
											className={styles.link}
											onClick={() =>
												wrappedGoToEdit({
													id: state.flowMode?.value,
													name_i18n: {
														zh_CN: state.flowMode?.label,
													},
												} as PlatformPackage.Mode)
											}
										>
											{t("goToEdit")}
										</span>
									</div>
							  )}
					</span>
				</Flex>
				{isCustomConfig ? (
					<MagicButton type="primary" onClick={() => openAddOrEditGroupModal()}>
						{t("createGroup")}
					</MagicButton>
				) : (
					<MagicSelect
						options={filterFlowModeOptions}
						style={{ width: 140 }}
						value={state.flowMode}
						labelInValue
						onChange={changeFlowMode}
						onPopupScroll={handlePopupScroll}
						loading={flowModeLoading}
					/>
				)}
			</Flex>
			<Flex
				vertical
				gap={10}
				className={styles.groupList}
				justify={groupList.size > 0 ? "flex-start" : "center"}
			>
				<SortableContext
					items={Array.from(groupList.keys())}
					strategy={verticalListSortingStrategy}
				>
					{groupList.size > 0 ? (
						Array.from(groupList.values()).map(({ group, models }) => {
							const modelList = Array.from(models.values())
							return (
								<GroupItem
									key={group.id}
									group={group}
									models={modelList}
									handle={isCustomConfig}
								/>
							)
						})
					) : (
						<Empty description={tCommon("noData")} />
					)}
				</SortableContext>
			</Flex>
		</Flex>
	)
}

export default RightWrapper
