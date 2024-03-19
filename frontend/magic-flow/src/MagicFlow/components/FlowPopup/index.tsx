import { prefix } from "@/MagicFlow/constants"
import SearchInput from "@/common/BaseUI/DropdownRenderer/SearchInput"
import { IconSearch } from "@douyinfe/semi-icons"
import { Tabs } from "antd"
import clsx from "clsx"
import i18next from "i18next"
import React, { useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { FlowPopupProvider } from "./context/FlowPopupContext/Provider"
import useFlowPopup, { TabKey } from "./hooks/useFlowPopup"
import styles from "./index.module.less"

interface FlowPopupProps {
	source?: string
	target?: string | null
	edgeId?: string | null
	sourceHandle?: string
	nodeId?: string // 切换节点类型时需要传
}

export const MaterialPanelWidth = 330

function FlowPopup({ source, target, edgeId, sourceHandle, nodeId }: FlowPopupProps) {
	const { t } = useTranslation()
	const { keyword, setKeyword, NodeList, onTabChange } = useFlowPopup()

	const inputRef = useRef<HTMLInputElement>(null)

	const items = useMemo(() => {
		return [
			{
				key: TabKey.BaseNode,
				label: i18next.t("flow.node", { ns: "magicFlow" }),
				children: (
					<div className={clsx(styles.nodeList, `${prefix}node-list`)}>{NodeList}</div>
				),
			},

			{
				key: TabKey.WorkFlow,
				label: i18next.t("flow.flow", { ns: "magicFlow" }),
				children: (
					<div className={clsx(styles.nodeList, `${prefix}node-list`)}>{NodeList}</div>
				),
			},
		]
	}, [NodeList, i18next])

	if (inputRef && inputRef.current) {
		inputRef.current.focus()
	}

	return (
		<FlowPopupProvider
			source={source}
			target={target}
			edgeId={edgeId}
			sourceHandle={sourceHandle}
			nodeId={nodeId}
		>
			<div className={clsx(styles.flowPopup, `${prefix}flow-popup`)}>
				<div className={clsx(styles.searchWrapper, `${prefix}search-wrapper`)}>
					<SearchInput
						prefix={<IconSearch />}
						placeholder={i18next.t("flow.searchNodes", { ns: "magicFlow" })}
						value={keyword}
						onChange={(e: any) => setKeyword(e.target.value)}
						ref={inputRef}
						onClick={(e: any) => e.stopPropagation()}
					/>
				</div>
				<Tabs defaultActiveKey="1" items={items} onChange={onTabChange} />
			</div>
		</FlowPopupProvider>
	)
}

export default FlowPopup
