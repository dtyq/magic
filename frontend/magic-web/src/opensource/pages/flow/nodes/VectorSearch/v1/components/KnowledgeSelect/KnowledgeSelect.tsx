import usePrevious from "@/opensource/pages/flow/common/hooks/usePrevious"
import { useFlowStore } from "@/opensource/stores/flow"
import { Form, Tooltip } from "antd"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import { IconWindowMaximize } from "@tabler/icons-react"
import { useMemo } from "react"
import {
	KnowledgeCurrentConversation,
	KnowledgeCurrentTopic,
} from "@/opensource/pages/flow/constants"
import { useTranslation } from "react-i18next"
import styles from "./KnowledgeSelect.module.less"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"

type KnowledgeSelectProps = {
	name?: string
	multiple?: boolean
}

export default function KnowledgeSelect({
	name = "vector_database_id",
	multiple = false,
}: KnowledgeSelectProps) {
	const { t } = useTranslation()
	const { expressionDataSource } = usePrevious()

	const { useableDatabases } = useFlowStore()

	const knowledgeOptions = useMemo(() => {
		return useableDatabases.map((knowledge) => {
			return {
				label: knowledge.name,
				id: knowledge.id,
			}
		})
	}, [useableDatabases])

	const knowledgeSelectRenderConfig = useMemo(() => {
		return {
			type: "names",
			props: {
				value: null,
				onChange: () => {},
				options: knowledgeOptions,
				suffix: (item: any) => {
					if (
						item.id === KnowledgeCurrentConversation ||
						item.id === KnowledgeCurrentTopic
					)
						return null
					return (
						<Tooltip title={t("common.click2TargetKnowledge", { ns: "flow" })}>
							<IconWindowMaximize
								onClick={(e) => {
									e.stopPropagation()
									window.open(
										getRoutePath({
											name: RouteName.FlowKnowledgeDetail,
											params: {
												id: item.id,
											},
										}) as string,
										"_blank",
									)
								}}
								className={styles.iconWindowMaximize}
								size={20}
							/>
						</Tooltip>
					)
				},
			},
		}
	}, [knowledgeOptions, t])

	return (
		<Form.Item name={name} label={t("common.selectDatabase", { ns: "flow" })}>
			<MagicExpressionWrap
				multiple={multiple}
				// @ts-ignore
				renderConfig={knowledgeSelectRenderConfig}
				dataSource={expressionDataSource}
			/>
		</Form.Item>
	)
}
