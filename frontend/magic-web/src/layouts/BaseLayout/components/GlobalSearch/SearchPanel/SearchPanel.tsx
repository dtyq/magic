import type { TabsProps } from "antd"
import { Tabs } from "antd"
import { useMemo, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { debounce, isEmpty } from "lodash-es"
import useSWR from "swr"

import { useKeyPress } from "ahooks"
import AppearanceProvider from "@/providers/AppearanceProvider"
import { DriveApi } from "@/apis"
import Panels from "./Panels"
import { useStyles } from "./styles"
import { SearchPanelTypes } from "./types"

interface SearchPanelProps {
	searchQuery?: string
	maxHeight?: number
}

function SearchPanel(props: SearchPanelProps) {
	const { searchQuery, maxHeight } = props
	const { t } = useTranslation("search")

	const { styles } = useStyles()

	const [activeKey, setActiveKey] = useState<SearchPanelTypes>(SearchPanelTypes.Contacts)
	const [debouncedQuery, setDebouncedQuery] = useState<string>("")

	// 使用防抖处理 searchQuery 更新
	useEffect(() => {
		const handler = debounce(() => {
			setDebouncedQuery(searchQuery ?? "")
		}, 1000)
		handler()
		return () => {
			handler?.cancel()
		}
	}, [searchQuery])

	useSWR(
		isEmpty(debouncedQuery) ? null : ["/open/oauth/home/search", debouncedQuery],
		() =>
			DriveApi.searchFiles({
				file: {
					keyword: debouncedQuery,
				},
			}),
		{
			onSuccess() {
				// console.log("----->", data)
			},
		},
	)

	const items = useMemo<TabsProps["items"]>(
		() => [
			// {
			// 	key: SearchPanelTypes.Integrate,
			// 	label: t("quickSearch.tabs.integrate"),
			// 	children: <Panels.Integrate maxHeight={maxHeight} />,
			// },
			{
				key: SearchPanelTypes.Contacts,
				label: t("quickSearch.tabs.contacts"),
				children: <Panels.Contacts maxHeight={maxHeight} />,
			},
			{
				key: SearchPanelTypes.AIAssistant,
				label: t("quickSearch.tabs.assistant"),
				children: <Panels.Assistant maxHeight={maxHeight} />,
			},
			// {
			// 	key: SearchPanelTypes.Groups,
			// 	label: t("quickSearch.tabs.groups"),
			// 	children: <Panels.Groups maxHeight={maxHeight} />,
			// },
			// {
			// 	key: SearchPanelTypes.Chat,
			// 	label: t("quickSearch.tabs.chat"),
			// 	children: <Panels.Chat maxHeight={maxHeight} />,
			// },
			{
				key: SearchPanelTypes.Application,
				label: t("quickSearch.tabs.application"),
				children: <Panels.Applications maxHeight={maxHeight} />,
			},
			{
				key: SearchPanelTypes.CloudDrive,
				label: t("quickSearch.tabs.cloudDrive"),
				children: <Panels.CloudDrive maxHeight={maxHeight} />,
			},
			// {
			// 	key: SearchPanelTypes.Approval,
			// 	label: t("quickSearch.tabs.approve"),
			// 	children: <Panels.Approval maxHeight={maxHeight} />,
			// },
			// {
			// 	key: SearchPanelTypes.Schedule,
			// 	label: t("quickSearch.tabs.schedule"),
			// 	children: <Panels.Schedule maxHeight={maxHeight} />,
			// },
			// {
			// 	key: SearchPanelTypes.TodoList,
			// 	label: t("quickSearch.tabs.todoList"),
			// 	children: <Panels.Todo maxHeight={maxHeight} />,
			// },
			{
				key: SearchPanelTypes.Tasks,
				label: t("quickSearch.tabs.tasks"),
				children: <Panels.Tasks maxHeight={maxHeight} />,
			},
			// {
			// 	key: SearchPanelTypes.Department,
			// 	label: t("quickSearch.tabs.department"),
			// 	children: <Panels.Department maxHeight={maxHeight} />,
			// },
			{
				key: SearchPanelTypes.Knowledge,
				label: t("quickSearch.tabs.knowledge"),
				children: <Panels.Knowledge maxHeight={maxHeight} />,
			},
		],
		[maxHeight, t],
	)

	useKeyPress("tab", (event) => {
		event?.stopPropagation()
		event?.preventDefault()
		if (items) {
			const index = items.findIndex((i) => i.key === activeKey)
			if (index < items.length) {
				setActiveKey(
					(index + 1 >= items.length
						? items[0].key
						: items[index + 1].key) as SearchPanelTypes,
				)
			}
		}
	})

	return (
		<AppearanceProvider>
			<Tabs
				destroyOnHidden
				className={styles.tabs}
				activeKey={activeKey}
				items={items}
				onChange={(event) => setActiveKey(event as SearchPanelTypes)}
			/>
		</AppearanceProvider>
	)
}

export default SearchPanel
