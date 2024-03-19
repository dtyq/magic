import { useMemoizedFn, useResetState } from "ahooks"
import _ from "lodash"
import React, { useState } from "react"
import CustomInputExpression from "../InputExpression"
import { useGlobalContext } from "../context/GlobalContext/useGlobalContext"
import { PopoverModalStyle } from "../style"
import {
	EXPRESSION_ITEM,
	EXPRESSION_VALUE,
	InputExpressionProps,
	InputExpressionValue,
} from "../types"
import { filterNullValue } from "../utils"

type UseArgsModalProps = {
	value: EXPRESSION_VALUE[]
	handleChange: (value: EXPRESSION_VALUE[]) => void
}

export default function useArgsModal({ value, handleChange }: UseArgsModalProps) {
	/** 函数参数项弹窗是否打开 */
	const [isOpenArgsModal, setIsOpenArgsModal] = useState(false)
	/** 当前修改的是那个函数块的参数 */
	const [config, setConfig, resetConfig] = useResetState({} as EXPRESSION_VALUE)
	/** 第几个参数 */
	const [argsIndex, setArgsIndex, resetArgsIndex] = useResetState(-1)
	/** 当前参数value */
	const [argValue, setArgValue, resetArgsValue] = useResetState(
		null as InputExpressionValue | null,
	)

	/** 当前参数项变更函数 */
	const handleChangeArg = useMemoizedFn((value: InputExpressionValue) => {
		// console.log("函数参数变更", value)
		setArgValue(value)
	})

	const openArgsModal = useMemoizedFn(() => {
		setIsOpenArgsModal(true)
	})

	const notifyChange = useMemoizedFn((resultArgsValue: EXPRESSION_VALUE) => {
		const resultValue = { ...resultArgsValue }
		let cloneVal = _.cloneDeep(value)
		const index = cloneVal.findIndex((item) => item.uniqueId === config.uniqueId)
		if (index > -1) {
			cloneVal.splice(index, 1, resultValue)
			cloneVal = filterNullValue(cloneVal)
			handleChange(cloneVal)
		}
	})

	const resetArgs = useMemoizedFn(() => {
		resetConfig()
		resetArgsIndex()
		resetArgsValue()
	})

	const closeArgsModal = useMemoizedFn(() => {
		setIsOpenArgsModal(false)
		notifyChange({ ...config })
		resetArgs()
	})

	/** 确认更新当前参数项函数 */
	const onConfirm = useMemoizedFn(() => {
		const resultValue = { ...config }
		const curIndex = argsIndex
		const target = resultValue.args as InputExpressionValue[]
		if (curIndex > target.length - 1) return
		target[curIndex] = argValue as InputExpressionValue
		notifyChange(resultValue)
		setIsOpenArgsModal(false)
	})

	const onPopoverModalClick = useMemoizedFn(
		(
			e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
			item: EXPRESSION_ITEM,
			arg: InputExpressionValue,
			index: number,
		) => {
			e.stopPropagation()
			const tempArg = _.cloneDeep(arg)
			setArgValue(tempArg)
			setArgsIndex(index)
			setConfig({ ...item })
			openArgsModal()
		},
	)

	return {
		isOpenArgsModal,
		closeArgsModal,
		argValue,
		handleChangeArg,
		onConfirm,
		onPopoverModalClick,
		openArgsModal,
	}
}

interface PopoverModalContentProps {
	onChange: (value: any) => void
	rawProps: InputExpressionProps
	value: any
}

export function PopoverModalContent({ onChange, rawProps, ...props }: PopoverModalContentProps) {
	const [value, setValue] = useState(props.value)
	const { mode } = useGlobalContext()
	const setCurrentValue = useMemoizedFn((val: any) => {
		setValue(val)
		onChange(val)
	})
	return (
		<PopoverModalStyle>
			<CustomInputExpression
				{...rawProps}
				value={value}
				onChange={setCurrentValue}
				allowExpression
				mode={mode}
				onlyExpression={false}
			/>
		</PopoverModalStyle>
	)
}
