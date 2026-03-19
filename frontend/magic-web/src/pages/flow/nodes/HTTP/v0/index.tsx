import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { useState } from "react"
import type { HTTP } from "@/types/flow"
import { useUpdateEffect } from "ahooks"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { omit, cloneDeep, set } from "lodash-es"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import MagicJsonSchemaEditor from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { useTranslation } from "react-i18next"
import usePrevious from "../../../common/hooks/usePrevious"
import ApiSettings from "./ApiSettings"
import styles from "./index.module.less"
import type { WidgetValue } from "../../../common/Output"
import { customNodeType } from "../../../constants"
import Output from "../../../common/Output"
import { v0Template } from "./template"
const omitDomainPath = (api: WidgetValue["value"]["form"]) => {
	return {
		...api,
		structure: {
			...(omit(api?.structure, ["domain", "path"]) || {}),
		},
	}
}

export default function HTTPNodeV0() {
	const { t } = useTranslation()
	const { expressionDataSource } = usePrevious()

	const { currentNode } = useCurrentNode()
	const { nodeConfig, updateNodeConfig, notifyNodeChange } = useFlow()

	const [api, setApi] = useState<HTTP.Api>(
		// @ts-ignore
		omitDomainPath(currentNode?.params?.api || cloneDeep(v0Template.params?.api)),
	)

	const [output, setOutput] = useState<Schema>(
		// @ts-ignore
		currentNode?.output?.form?.structure,
	)

	// 上游同步下游
	useUpdateEffect(() => {
		if (!currentNode) return
		if (!currentNode?.system_output) {
			updateNodeConfig({
				...currentNode,
				system_output: cloneDeep(v0Template.system_output),
			})
		}
		if (currentNode?.params?.api) {
			// @ts-ignore
			setApi(omitDomainPath(currentNode?.params?.api))
		}
		if (currentNode?.output?.form?.structure) setOutput(currentNode?.output?.form?.structure)
	}, [currentNode])

	// 下游同步上游
	useUpdateEffect(() => {
		if (!currentNode) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]
		if (!currentNodeConfig) return
		// @ts-ignore
		set(currentNodeConfig, ["params", "api"], omitDomainPath(api))

		if (currentNodeConfig?.output) {
			currentNodeConfig.output.form.structure = output
		}
		notifyNodeChange?.()
	}, [api, output])

	return (
		<div className={styles.http}>
			<DropdownCard title={t("common.input", { ns: "flow" })} height="auto">
				<ApiSettings
					expressionSource={expressionDataSource}
					apiSettings={api}
					setApiSettings={setApi}
				/>
			</DropdownCard>
			<DropdownCard
				title={t("common.output", { ns: "flow" })}
				height="auto"
				headerClassWrapper={styles.output}
			>
				<MagicJsonSchemaEditor
					data={output}
					onChange={setOutput}
					allowExpression
					expressionSource={expressionDataSource}
					displayColumns={[ShowColumns.Key, ShowColumns.Label, ShowColumns.Type]}
				/>
			</DropdownCard>

			<Output
				// @ts-ignore
				value={currentNode?.system_output}
				title={t("common.systemOutput", { ns: "flow" })}
				wrapperClassName={styles.systemOutput}
			/>
		</div>
	)
}
