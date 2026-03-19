import MagicIcon from "@/components/base/MagicIcon"
import { useKnowledgeStore } from "@/stores/knowledge"
import { IconSearch } from "@tabler/icons-react"
import { useMemoizedFn, useMount } from "ahooks"
import { Flex } from "antd"
import { createStyles, cx } from "antd-style"
import Input from "antd/es/input/Input"
import { useEffect, useState } from "react"
import { useParams } from "react-router"
import useNavigate from "@/routes/hooks/useNavigate"
import type { Knowledge } from "@/types/knowledge"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import { FlowRouteType } from "@/types/flow"
import AddFragment from "./components/AddFragment"
import Fragments from "./components/Fragments"
import UpdateKnowledge from "../components/UpdateKnowledge"
import { hasEditRight } from "../../components/AuthControlButton/types"
import { RouteName } from "@/routes/constants"

const useKnowledgeDetailStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		wrapper: css`
			flex: 1;
		`,
		breadcrumb: css`
			color: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorUsages.text[2]};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			height: 20px;
			padding: 30px 20px 20px 20px;
		`,
		breadcrumbItem: css`
			cursor: pointer;

			&:hover {
				color: ${token.colorPrimaryHover};
			}

			&:last-child {
				color: ${token.colorPrimary};
			}
		`,
		knowledgeName: css``,
		split: css``,
		header: css`
			padding: 0 20px 12px 20px;
			border-bottom: 1px solid
				${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.border};
			height: 60px;

			.icon-edit {
				padding: 4px;
				cursor: pointer;
				border-radius: 4px;

				&:hover {
					background: ${isDarkMode
				? token.magicColorScales.grey[8]
				: token.magicColorScales.grey[0]};
				}
			}
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[1]};
			font-size: 20px;
			font-weight: 600;
		`,

		tagBlock: css`
			padding: 2px 4px;
			border-radius: 4px;
			background: ${isDarkMode
				? token.magicColorScales.grey[8]
				: token.magicColorScales.grey[0]};
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[1]};
		`,

		searchInput: css`
			margin-left: 12px;
		`,

		body: css`
			padding: 20px;
			flex: 1;
			max-height: calc(100vh - 110px);
		`,
	}
})

export default function KnowledgeDetail() {
	const { t } = useTranslation()

	const { styles } = useKnowledgeDetailStyles()

	const navigate = useNavigate()

	const { id } = useParams()

	const { data } = useKnowledgeStore((state) => state.useKnowledgeDetail)(id as string)

	const backToKnowledge = useMemoizedFn(() => {
		navigate({
			name: RouteName.Flows,
			params: { type: FlowRouteType.VectorKnowledge },
		})
	})

	const [keyword, setKeyword] = useState("")

	const [knowledge, setKnowledge] = useState<Knowledge.Detail>()

	useEffect(() => {
		setKnowledge(data)
	}, [data])

	const updateKnowledge = useMemoizedFn((newKnowledge: Knowledge.Detail) => {
		setKnowledge({ ...newKnowledge })
	})

	const [fragments, setFragments] = useState([] as Knowledge.FragmentItem[])

	const initFragmentList = useMemoizedFn(() => {
		KnowledgeApi.getFragmentList({
			knowledgeBaseCode: `${id}`,
			documentCode: "",
			page: 1,
			pageSize: 500,
		}).then((res) => {
			if (res?.list) {
				setFragments(res.list)
			}
		})
	})

	useMount(() => {
		initFragmentList()
	})

	return (
		<Flex className={styles.wrapper} vertical>
			<Flex className={styles.breadcrumb} gap={4} align="center">
				<span className={styles.breadcrumbItem} onClick={backToKnowledge}>
					{t("knowledgeDatabase.name", { ns: "flow" })}
				</span>
				<span className={styles.split}>/</span>
				<span className={cx(styles.breadcrumbItem, styles.knowledgeName)}>
					{knowledge?.name}
				</span>
			</Flex>
			<Flex className={styles.header} justify="space-between" align="center">
				<Flex vertical>
					<Flex className={styles.title} align="center" gap={4}>
						<span>{knowledge?.name}</span>
						{knowledge?.user_operation !== undefined &&
							hasEditRight(knowledge.user_operation) && (
								<UpdateKnowledge
									knowledge={knowledge}
									updateKnowledge={updateKnowledge}
								/>
							)}
					</Flex>
				</Flex>
				<Flex justify="space-between" gap={8} flex={1}>
					<Flex flex="0 0 200px">
						<Input
							onChange={(e) => setKeyword(e.target.value)}
							placeholder={t("common.search", { ns: "flow" })}
							prefix={<MagicIcon component={IconSearch} size={18} />}
							value={keyword}
							className={styles.searchInput}
						/>
					</Flex>
					<Flex align="center">
						{id &&
							knowledge?.user_operation !== undefined &&
							hasEditRight(knowledge.user_operation) && (
								<AddFragment knowledgeId={id} initFragmentList={initFragmentList} />
							)}
					</Flex>
				</Flex>
			</Flex>
			<div className={styles.body}>
				{id && (
					<Fragments
						knowledge={knowledge}
						knowledgeId={id}
						fragments={fragments}
						setFragments={setFragments}
						initFragmentList={initFragmentList}
					/>
				)}
			</div>
		</Flex>
	)
}
