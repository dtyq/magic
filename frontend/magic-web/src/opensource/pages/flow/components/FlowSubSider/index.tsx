import { IconRouteSquare, IconTools, IconChevronRight, IconFileTextAi } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { MagicList } from "@/opensource/components/MagicList"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import { IconMagicBots } from "@/opensource/enhance/tabler/icons-react"
import { FlowRouteType } from "@/opensource/types/flow"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import IconMcp from "@/opensource/assets/logos/mcp.png"
import { RouteName } from "@/opensource/routes/constants"
import { baseHistory } from "@/opensource/routes/history"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import type { MagicListItemData as MagicListItemItemType } from "@/opensource/components/MagicList/types"
import { cn } from "@/opensource/lib/utils"

const useStyles = createStyles(({ css }) => {
	return {
		container: css`
			width: 240px;
			height: 100%;
			flex-shrink: 0;
			min-height: unset;
		`,
		subSiderItem: css`
			padding: 5px;
		`,
	}
})

function FlowSubSider() {
	const { t } = useTranslation()

	const [collapseKey, setCollapseKey] = useState<string>(window.location.pathname)

	const { styles } = useStyles()

	const items = useMemo<Array<MagicListItemItemType>>(() => {
		return [
			{
				id: getRoutePath({ name: RouteName.AgentList }) as string,
				title: t("common.agent", { ns: "flow" }),
				avatar: {
					src: <MagicIcon component={IconMagicBots} color="currentColor" />,
					style: { background: "#315CEC", padding: 6 },
				},
				extra: <MagicIcon component={IconChevronRight} />,
			},
			{
				id: getRoutePath({
					name: RouteName.Flows,
					params: {
						type: FlowRouteType.Sub,
					},
				}) as string,
				title: t("common.flow", { ns: "flow" }),
				avatar: {
					src: <MagicIcon component={IconRouteSquare} color="currentColor" />,
					style: { background: "#FF7D00", padding: 6 },
				},
				extra: <MagicIcon component={IconChevronRight} />,
			},
			{
				id: getRoutePath({
					name: RouteName.Flows,
					params: {
						type: FlowRouteType.Tools,
					},
				}) as string,
				title: t("common.toolset", { ns: "flow" }),
				avatar: {
					src: <MagicIcon component={IconTools} color="currentColor" />,
					style: { background: "#8BD236", padding: 6 },
				},
				extra: <MagicIcon component={IconChevronRight} />,
			},
			{
				id: getRoutePath({
					name: RouteName.Flows,
					params: {
						type: FlowRouteType.VectorKnowledge,
					},
				}) as string,
				title: t("vectorDatabase.name", { ns: "flow" }),
				avatar: {
					src: <MagicIcon component={IconFileTextAi} color="currentColor" />,
					style: {
						background: "#32C436",
						padding: 6,
					},
				},
				extra: <MagicIcon component={IconChevronRight} />,
			},
			{
				id: getRoutePath({
					name: RouteName.MCP,
					params: {
						type: FlowRouteType.VectorKnowledge,
					},
				}) as string,
				title: "MCP",
				avatar: {
					src: <img src={IconMcp} alt="" />,
				},
				extra: <MagicIcon component={IconChevronRight} />,
			},
		]
	}, [t])

	return (
		<SubSiderContainer className={styles.container}>
			<MagicList
				itemClassName={cn(styles.subSiderItem, "mx-2")}
				active={collapseKey}
				onItemClick={({ id }) => {
					setCollapseKey(id)
					baseHistory.push(id)
				}}
				items={items}
			/>
		</SubSiderContainer>
	)
}

export default FlowSubSider
