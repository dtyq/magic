import { FuncTipsStyle } from "@/MagicExpressionWidget/style"
import { MethodArgsItem } from "@/MagicExpressionWidget/types"
import { useFlowInteraction } from "@/MagicFlow/components/FlowDesign/context/FlowInteraction/useFlowInteraction"
import { Popover, Tooltip } from "antd"
import i18next from "i18next"
import React, { useMemo } from "react"
import { DataSourceOption } from "../.."
import styles from "./index.module.less"

type FunctionTipsProps = React.PropsWithChildren<{
	targetOption: DataSourceOption
	keyword: string
}>

const FunctionTips = ({ targetOption, keyword }: FunctionTipsProps) => {
	const tempOptions = { ...targetOption }
	const { title, return_type, desc, arg } = tempOptions

	const headerTitle = useMemo(() => {
		return `${tempOptions.key}(${arg?.map?.((i: MethodArgsItem) => i.name).join(",")})`
	}, [tempOptions])

	const FuncTipComponent = useMemo(() => {
		return (
			<FuncTipsStyle>
				<div className="func-content">
					<Tooltip title={headerTitle}>
						<div className="func-title">{headerTitle}</div>
					</Tooltip>
					<div className="func-return">
						{i18next.t("expression.returnValue", { ns: "magicFlow" })}: {return_type}
					</div>
					{desc && <div className="func-desc">{desc}</div>}
				</div>
				<div className="args-content">
					<div className="args-title">
						{i18next.t("expression.argumentsDesc", { ns: "magicFlow" })}
					</div>
					{arg?.map?.((argItem: MethodArgsItem) => {
						const { name, type, desc: argDesc } = argItem
						return (
							<div key={name} className="args-desc">
								{name} <span className="field-type">{type}</span>
								<span className="desc">{argDesc}</span>
							</div>
						)
					})}
				</div>
			</FuncTipsStyle>
		)
	}, [])

	const { currentZoom } = useFlowInteraction()

	const { beforeStr, afterStr } = useMemo(() => {
		const index = title.indexOf(keyword)
		const beforeStr = title.substring(0, index)
		const afterStr = title.slice(index + keyword.length)
		return {
			beforeStr,
			afterStr,
		}
	}, [title, keyword])

	return (
		<Tooltip title={title} placement="left">
			<Popover
				content={FuncTipComponent}
				trigger="hover"
				placement="right"
				showArrow={false}
				zIndex={1073}
				overlayStyle={{
					scale: `${currentZoom}`, // 手动调整缩放
				}}
			>
				<div className={styles.text}>
					{beforeStr}
					<span className="site-tree-search-value">{keyword}</span>
					{afterStr}
				</div>
			</Popover>
		</Tooltip>
	)
}

export default FunctionTips
