import { Skeleton } from "antd"
import clsx from "clsx"
import React, { memo } from "react"
import { prefix } from "@/MagicFlow/constants"
import styles from "../index.module.less"

interface NodeContentProps {
	showParamsComp: boolean
	ParamsComp: React.ComponentType | null
}

const NodeContent = memo(
	({ showParamsComp, ParamsComp }: NodeContentProps) => {
		return (
			<div
				className={clsx(styles.paramsComp, `${prefix}params-comp`, {
					[styles.isEmpty]: !showParamsComp,
					"is-empty": !showParamsComp,
				})}
			>
				{ParamsComp && showParamsComp && <ParamsComp />}
				{!showParamsComp && (
					<>
						<Skeleton />
						<Skeleton />
					</>
				)}
			</div>
		)
	},
	(prevProps, nextProps) => {
		// 自定义比较函数，只在关键属性变化时重新渲染
		// 比较showParamsComp状态是否变化
		if (prevProps.showParamsComp !== nextProps.showParamsComp) {
			return false // 不相等，需要重新渲染
		}

		// 比较ParamsComp是否变化
		// 如果其中一个为null而另一个不是，或者两个组件引用不同，则需要重新渲染
		if (
			(!prevProps.ParamsComp && nextProps.ParamsComp) ||
			(prevProps.ParamsComp && !nextProps.ParamsComp) ||
			prevProps.ParamsComp !== nextProps.ParamsComp
		) {
			return false // 不相等，需要重新渲染
		}

		// 所有关键属性都相同，不需要重新渲染
		return true
	},
)

export default NodeContent
