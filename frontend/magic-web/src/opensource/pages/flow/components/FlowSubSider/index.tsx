import { IconRouteSquare, IconTools, IconChevronRight, IconFileTextAi } from "@tabler/icons-react"
import { useState } from "react"
import { MagicList } from "@/opensource/components/MagicList"
import { useLocation } from "react-router"
import { useNavigate } from "@/opensource/hooks/useNavigate"
import { RoutePath } from "@/const/routes"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import { IconMagicBots } from "@/enhance/tabler/icons-react"
import { FlowRouteType } from "@/types/flow"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { replaceRouteParams } from "@/utils/route"
import IconMcp from "@/assets/logos/mcp.png"

const useStyles = createStyles(({ css }) => {
	return {
		container: css`
			width: 240px;
			flex-shrink: 0;
		`,
		subSiderItem: css`
			padding: 5px;
		`,
	}
})

function FlowSubSider() {
	const { t } = useTranslation()

	const { pathname } = useLocation()

	const [collapseKey, setCollapseKey] = useState<string>(pathname)

	const { styles } = useStyles()

	const navigate = useNavigate()

	return (
		<SubSiderContainer className={styles.container}>
			<MagicList
				itemClassName={styles.subSiderItem}
				active={collapseKey}
				onItemClick={({ id }) => {
					setCollapseKey(id)
					navigate(id)
				}}
				items={[
					{
						id: RoutePath.AgentList,
						title: t("common.agent", { ns: "flow" }),
						avatar: {
							src: <MagicIcon component={IconMagicBots} color="currentColor" />,
							style: { background: "#315CEC", padding: 6 },
						},
						extra: <MagicIcon component={IconChevronRight} />,
					},
					{
						id: replaceRouteParams(RoutePath.Flows, {
							type: FlowRouteType.Sub,
						}),
						title: t("common.flow", { ns: "flow" }),
						avatar: {
							src: <MagicIcon component={IconRouteSquare} color="currentColor" />,
							style: { background: "#FF7D00", padding: 6 },
						},
						extra: <MagicIcon component={IconChevronRight} />,
					},
					{
						id: replaceRouteParams(RoutePath.Flows, {
							type: FlowRouteType.Tools,
						}),
						title: t("common.toolset", { ns: "flow" }),
						avatar: {
							src: <MagicIcon component={IconTools} color="currentColor" />,
							style: { background: "#8BD236", padding: 6 },
						},
						extra: <MagicIcon component={IconChevronRight} />,
					},

					{
						id: replaceRouteParams(RoutePath.Flows, {
							type: FlowRouteType.VectorKnowledge,
						}),
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
						id: replaceRouteParams(RoutePath.Flows, {
							type: FlowRouteType.Mcp,
						}),
						title: "MCP",
						avatar: {
							src: <img src={IconMcp} alt="" />,
						},
						extra: <MagicIcon component={IconChevronRight} />,
					},
				]}
			/>
		</SubSiderContainer>
	)
}

export default FlowSubSider
