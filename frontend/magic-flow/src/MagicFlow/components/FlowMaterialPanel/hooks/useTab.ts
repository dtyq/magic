import { useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { TabObject } from "../constants"
import PanelMaterial from "../components/PanelMaterial"
import PanelFlow from "../components/PanelFlow"
import PanelTools from "../components/PanelTools"
import PanelAgent from "../components/PanelAgent"
import { useTranslation } from "react-i18next"
import i18next from "i18next"

const TabContentMap = {
	[TabObject.Material]: PanelMaterial,
	[TabObject.Flow]: PanelFlow,
    [TabObject.Tools]: PanelTools,
    [TabObject.Agent]: PanelAgent
}

export default function useTab () {
    const { t } = useTranslation()
	const [ tab, setTab ] = useState(TabObject.Material)

	const changeTab = useMemoizedFn((e) => {
		if (typeof e !== "object") {
			setTab(e)
			return
		}
		setTab(e.target.value)
	})


	// 当前tab列表
	const tabList = useMemo(() => {
		return [
			{
				label: i18next.t("flow.node", { ns: "magicFlow" }),
				value: TabObject.Material,
				onClick: () => changeTab(TabObject.Material)
			},
			{
				label: i18next.t("flow.flow", { ns: "magicFlow" }),
				value: TabObject.Flow,
				onClick: () => changeTab(TabObject.Flow)
			},
			{
				label: i18next.t("flow.tools", { ns: "magicFlow" }),
				value: TabObject.Tools,
				onClick: () => changeTab(TabObject.Tools)
			},
			{
				label: i18next.t("flow.agent", { ns: "magicFlow" }),
				value: TabObject.Agent,
				onClick: () => changeTab(TabObject.Agent)
			}
		]
	}, [ changeTab ])

	// [[FC_1, show_1], [FC_2, show_2]]
	// 这样子返回的目的是避免每次点击tab都重新渲染，通过display控制是否显示
	const tabContents = useMemo(() => {
		return Object.entries(TabContentMap)
			.map(([ curTab, Comp ]) => ([ Comp, tab === curTab ]))
	}, [tab])

	return {
		tab,
		tabList,
		changeTab,
		tabContents
	}
}
