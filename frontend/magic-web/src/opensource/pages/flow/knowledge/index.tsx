import { useMemo, useState } from "react"
import { Flex, type TableProps } from "antd"
import MagicTable from "@/opensource/components/base/MagicTable"
import type { Knowledge } from "@/opensource/types/knowledge"
import { createStyles } from "antd-style"
import MagicSearch from "@/opensource/components/base/MagicSearch"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useMemoizedFn, useMount } from "ahooks"
import { set, has } from "lodash-es"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconDotsVertical } from "@tabler/icons-react"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/opensource/apis"
import UpdateKnowledge from "./components/UpdateKnowledge"
import EnableCell from "./components/EnableCell"
import RecordMenu from "./components/RecordMenu"
import AuthControlButton from "../components/AuthControlButton/AuthControlButton"
import { hasAdminRight, hasEditRight, ResourceTypes } from "../components/AuthControlButton/types"
import { RouteName } from "@/opensource/routes/constants"
import { VectorKnowledge } from "@/opensource/types/flow"

const useKnowledgeLayoutStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			background-color: transparent;
			width: 100%;
			position: relative;
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
			margin: 0;
		`,
		top: css`
			height: 60px;
			padding: 0 20px;
			width: 100%;
			position: absolute;
			top: 0;
			backdrop-filter: blur(12px);
			z-index: 1;
		`,
		search: css`
			width: 200px !important;
		`,
		wrapper: css`
			margin-top: 60px;
			padding: 0 20px;
		`,
	}
})

export default function FlowKnowledge() {
	const { t } = useTranslation()
	const { styles } = useKnowledgeLayoutStyles()
	const navigate = useNavigate()

	const [knowledgeList, setKnowledgeList] = useState([] as Knowledge.KnowledgeItem[])

	const updateKnowledgeById = useMemoizedFn((id, keys, value) => {
		const knowledge = knowledgeList.find((k) => k.id === id)
		if (!knowledge) return
		set(knowledge, keys, value)
		setKnowledgeList([...knowledgeList])
	})

	const deleteKnowledgeById = useMemoizedFn((id: string) => {
		setKnowledgeList(knowledgeList.filter((knowledge) => knowledge.id !== id))
	})

	const navigateToKnowledgePage = useMemoizedFn((record: Knowledge.KnowledgeItem) => {
		navigate({
			name: RouteName.FlowKnowledgeDetail,
			params: { id: record.id },
		})
	})

	const columns = useMemo<TableProps<Knowledge.KnowledgeItem>["columns"]>(() => {
		return [
			{
				dataIndex: "name",
				title: t("common.name", { ns: "flow" }),
			},
			{
				dataIndex: "description",
				title: t("common.desc", { ns: "flow" }),
			},
			{
				dataIndex: "created_at",
				title: t("common.createAt", { ns: "flow" }),
			},
			{
				dataIndex: "updated_at",
				title: t("common.updateAt", { ns: "flow" }),
			},
			{
				dataIndex: "enabled",
				title: t("common.enable", { ns: "flow" }),
				render: (enabled, record) => {
					return (
						<EnableCell
							enabled={enabled}
							record={record}
							updateKnowledgeById={updateKnowledgeById}
							disabled={!hasEditRight(record?.user_operation)}
						/>
					)
				},
			},
			{
				title: t("common.manageRights", { ns: "flow" }),
				render: (record) => {
					return (
						<AuthControlButton
							resourceType={ResourceTypes.Knowledge}
							resourceId={record?.id ?? ""}
							disabled={!hasAdminRight(record.user_operation)}
						/>
					)
				},
			},
			{
				width: 40,
				render: (record) => {
					if (has(record, "remain_day")) {
						return null
					}
					return (
						<RecordMenu
							deleteKnowledgeById={deleteKnowledgeById}
							record={record as Knowledge.KnowledgeItem}
							trigger={["click"]}
						>
							<MagicIcon
								size={18}
								component={IconDotsVertical}
								onClick={(e) => e.stopPropagation()}
							/>
						</RecordMenu>
					)
				},
			},
		]
	}, [deleteKnowledgeById, t, updateKnowledgeById])

	const RenderRow = useMemoizedFn((p) => {
		const record = knowledgeList?.find((r) => r.id === p["data-row-key"])
		if (!record) return <tr {...p} />
		return (
			<RecordMenu
				record={record as Knowledge.KnowledgeItem}
				deleteKnowledgeById={deleteKnowledgeById}
			>
				<tr {...p} onClick={() => navigateToKnowledgePage(record)} />
			</RecordMenu>
		)
	})

	const initKnowledgeList = useMemoizedFn(() => {
		KnowledgeApi.getKnowledgeList({
			name: "",
			searchType: VectorKnowledge.SearchType.All,
			page: 1,
			pageSize: 100,
		}).then((res) => {
			if (res?.list) {
				setKnowledgeList(res.list)
			}
		})
	})

	useMount(() => {
		initKnowledgeList()
	})

	return (
		<Flex vertical flex={1} className={styles.container}>
			<Flex align="center" justify="space-between" className={styles.top}>
				<Flex align="center" gap={22}>
					<h2 className={styles.title}>{t("knowledgeDatabase.mine", { ns: "flow" })}</h2>
					<MagicSearch className={styles.search} />
				</Flex>
				<Flex align="center">
					<UpdateKnowledge initKnowledgeList={initKnowledgeList} />
				</Flex>
			</Flex>
			<MagicSpin section spinning={false} wrapperClassName={styles.wrapper}>
				<MagicTable<Knowledge.KnowledgeItem>
					pagination={false}
					columns={columns}
					rowKey={(record) => record.id}
					dataSource={knowledgeList}
					components={{
						body: {
							row: RenderRow,
						},
					}}
				/>
			</MagicSpin>
		</Flex>
	)
}
