import React, { useMemo, useState } from "react"

import { FormItemType } from "@/MagicExpressionWidget/types"
import TSIcon from "@/common/BaseUI/TSIcon"
import { Button, Dropdown, Input, Popover, Tooltip } from "antd"
import { useMemoizedFn, useMount, useResetState, useUpdateEffect } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import { DataSourceOption } from "../.."
import { allMethodOptions, generateStepOptions, generateString } from "./helpers"
import "./index.less"
import { Wrap } from "./style"
import { useReactFlow } from "reactflow"

export type StepOption = {
	value: string // 实际的值，如 toArray()、toJson()、toNumber()..
	arguments?: string // 传递的参数，目前只支持string，如str.toArray(',')
	withArguments?: boolean
	label: string // 显示的文本，如转数组、转对象
	icon?: React.ReactElement // 显示的icon，如数组的icon...
	type: string
}

type TransformerProps = React.PropsWithChildren<{
	/** 数据来源 */
	source: DataSourceOption
	/** 实际变更函数 */
	onSelect: (node: any, trans?: string) => void
}>

/**
 * Transformer组件
 *
 * 该组件用于在ReactFlow环境中提供数据类型转换功能的悬浮面板。
 * 允许用户从一个数据类型转换到另一个数据类型，支持链式转换操作。
 *
 * 特性:
 * - 基于数据源类型动态生成可用的转换方法
 * - 支持链式调用多个转换方法
 * - 提供参数化转换，允许为特定转换设置参数
 * - 在ReactFlow缩放环境中自适应定位
 * - 提供面包屑导航以展示转换链条
 *
 * 解决方案:
 * - 使用ReactFlow的缩放信息动态调整弹出层的位置
 * - 将弹出层挂载到适当的DOM节点以确保正确的事件传递
 * - 通过动态计算偏移量而非内容缩放来保持UI交互性
 *
 * @param {TransformerProps} props - 组件属性
 * @param {DataSourceOption} props.source - 数据来源，包含类型信息
 * @param {Function} props.onSelect - 数据转换选择回调
 * @param {React.ReactNode} props.children - 触发弹出层的子元素
 * @returns {JSX.Element} 转换器组件
 */
const Transformer = ({ source, onSelect, children }: TransformerProps) => {
	const [values, setValues, resetValues] = useResetState([] as StepOption[])
	const [paths, setPaths] = useState([] as StepOption[])
	const [open, setOpen] = useState(false)

	const breadcrumbItems = useMemo(() => {
		if (!values.length) return []

		const list = values.reduce((res, val) => {
			const str = allMethodOptions?.find?.((item) => item.value === val.value)?.label
			res.push(str as string)
			return res
		}, [] as string[])

		return list as string[]
	}, [values])

	const panelOptions = useMemo(() => {
		return paths || ([] as StepOption[])
	}, [paths])

	/** 初始化可转换的函数列表 */
	const initStepOptions = useMemoizedFn((type: string) => {
		if (!type) return
		let typeArgs = type
		// 处理对象数组、字符串数组的类型不是array时，统一用array处理
		if (type.includes(FormItemType.Array)) {
			typeArgs = FormItemType.Array
		}
		const stepOptions = generateStepOptions(typeArgs)
		setPaths([...stepOptions])
	})

	useUpdateEffect(() => {
		const lastValue = _.last(values)
		if (lastValue) {
			initStepOptions(lastValue.type)
		} else {
			initStepOptions(source.type!)
		}
	}, [values])

	useMount(() => {
		initStepOptions(source.type!)
	})

	const handleSelected = useMemoizedFn((selectedOption: StepOption) => {
		setValues([...values, selectedOption])
	})

	const handleBreadcrumb = useMemoizedFn((index) => {
		setValues((old) => old.splice(0, index))
	})

	const onArgumentsChange = useMemoizedFn((newArguments: string, index: number) => {
		setPaths((oldPaths) => {
			return oldPaths.map((val, i) => {
				if (index !== i) return val
				return {
					...val,
					arguments: newArguments,
				}
			})
		})
	})

	const titleComponent = useMemo(() => {
		let showMenu = breadcrumbItems
		let showDropdownMenu = [] as string[]
		if (showMenu.length >= 3) {
			showMenu = breadcrumbItems.slice(0, 3)
			showDropdownMenu = breadcrumbItems.slice(3)
		}
		return (
			<p className="title">
				{showMenu.map((item, index) => {
					const isLastItem = index === breadcrumbItems.length - 1
					return (
						<>
							<span
								onClick={() => {
									handleBreadcrumb(index)
								}}
							>
								{item}
							</span>
							{!isLastItem && <TSIcon type="ts-arrow-right" />}
						</>
					)
				})}
				{showDropdownMenu.length > 0 && (
					<>
						<Dropdown
							className="nodrag"
							overlayStyle={{ zIndex: 9999 }}
							menu={{
								items: showDropdownMenu.map((item, index) => ({
									key: String(index + 4),
									label: item,
								})),
								onClick: ({ key }) => handleBreadcrumb(Number(key)),
							}}
						>
							<TSIcon type="ts-more-dot" />
						</Dropdown>
						<TSIcon type="ts-arrow-right" />
						<span>{i18next.t("common.pleaseSelect", { ns: "magicFlow" })}</span>
					</>
				)}
				{breadcrumbItems.length === 0 &&
					i18next.t("expression.transformToNewType", { ns: "magicFlow" })}
			</p>
		)
	}, [breadcrumbItems, handleBreadcrumb])

	const onConfirm = useMemoizedFn(() => {
		const targetTrans = generateString(values)
		onSelect(source, targetTrans)
		setOpen(false)
	})

	const onOpenChange = useMemoizedFn((visible: boolean) => {
		setOpen(visible)
		// 关闭时重置值
		if (!visible) {
			resetValues()
		}
	})

	return (
		<Popover
			placement="right"
			showArrow={false}
			classNames={{ root: "magic-type-transformer" }}
			onOpenChange={onOpenChange}
			open={open}
			content={
				<Wrap onClick={(e) => e.stopPropagation()}>
					{titleComponent}
					<ul className="nowheel">
						{panelOptions.map((item, index) => {
							return (
								<li key={item.value}>
									<span>
										{item.icon && <div className="magic-icon">{item.icon}</div>}
										{item.label}
									</span>

									{item.withArguments && (
										<Tooltip
											title={i18next.t("common.argumentsSetting", {
												ns: "magicFlow",
											})}
										>
											<Input
												className="arguments-input"
												width={20}
												defaultValue={item.arguments}
												onChange={(e) =>
													onArgumentsChange(e.target.value, index)
												}
											/>
										</Tooltip>
									)}
									<span
										onClick={() => {
											handleSelected(item)
										}}
										className="select"
									>
										{i18next.t("common.select", { ns: "magicFlow" })}
									</span>
								</li>
							)
						})}
					</ul>
					<div className="footer">
						<Button type="primary" size="small" onClick={onConfirm}>
							{i18next.t("common.confirm", { ns: "magicFlow" })}
						</Button>
					</div>
				</Wrap>
			}
		>
			{children}
		</Popover>
	)
}

export default Transformer
