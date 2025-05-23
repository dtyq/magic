import { Flex, Divider } from "antd"
import { cx } from "antd-style"
import type { UseableToolSet } from "@/types/flow"
import { useBoolean, useWhyDidYouUpdate } from "ahooks"
import { useTranslation } from "react-i18next"
import EmptyTools from "@/assets/logos/empty-tools.svg"
import ToolsCardBaseInfo from "./components/ToolsCardBaseInfo/ToolsCardBaseInfo"
import useStyles from "./style"
import React, { memo } from "react"
import { ToolSelectedItem } from "../../types"

// 使用React.lazy懒加载ToolsList组件
const ToolsList = React.lazy(() => import("./components/ToolsList"))

type ToolsCardProps = {
	toolSet: UseableToolSet.Item
	selectedTools?: ToolSelectedItem[]
}

function ToolsCard({ toolSet, selectedTools }: ToolsCardProps) {
	const { t: interfaceT } = useTranslation("interface")
	const { t } = useTranslation()

	const [cardOpen, { toggle }] = useBoolean(true)

	const { styles } = useStyles({ cardOpen })

	return (
		<Flex vertical className={styles.toolsetWrap}>
			<Flex vertical className={cx(styles.cardWrapper)} gap={8} onClick={toggle}>
				<ToolsCardBaseInfo toolSet={toolSet} lineCount={1} height={9} />
				<div>{`${interfaceT("agent.createTo")} ${toolSet.created_at?.replace(
					/-/g,
					"/",
				)}`}</div>

				<Divider className={styles.divider} />
				<Flex
					vertical
					className={cx(styles.tools, {
						[styles.cardOpen]: cardOpen,
					})}
				>
					{toolSet.tools.length > 0 && (
						<ToolsList
							tools={toolSet.tools}
							cardOpen={cardOpen}
							toolSet={toolSet}
							selectedTools={selectedTools}
						/>
					)}
					{toolSet.tools.length === 0 && (
						<Flex vertical align="center" justify="center" style={{ padding: "12px" }}>
							<img src={EmptyTools} alt="" />
							<span>{t("common.emptyTools", { ns: "flow" })}</span>
						</Flex>
					)}
				</Flex>
			</Flex>
		</Flex>
	)
}

export default memo(ToolsCard)
