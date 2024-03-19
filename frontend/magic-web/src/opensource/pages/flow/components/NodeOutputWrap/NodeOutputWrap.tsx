import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import JSONSchemaRenderer from "@/opensource/pages/flow/components/JSONSchemaRenderer"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import styles from "./NodeOutputWrap.module.less"

type NodeOutputWrapProps = React.PropsWithChildren<{
	className?: string
}>

export default function NodeOutputWrap({ children, className }: NodeOutputWrapProps) {
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()

	return (
		<div className={cx(styles.nodeWrap, className)}>
			{children}
			<div className={styles.output}>
				<DropdownCard title={t("common.output", { ns: "flow" })} height="auto">
					{/* @ts-ignore */}
					<JSONSchemaRenderer form={currentNode?.output?.form?.structure} />
				</DropdownCard>
			</div>
		</div>
	)
}
