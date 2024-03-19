import { useGlobalContext } from '@/MagicExpressionWidget/context/GlobalContext/useGlobalContext'
import { useMemoizedFn, useUpdateEffect } from 'ahooks'
import React from 'react'
import { EXPRESSION_ITEM, LabelTypeMap } from '@/MagicExpressionWidget/types'
import { SnowflakeId } from '@/MagicExpressionWidget/helpers'


export type EncryptionProps = {
	displayValue: EXPRESSION_ITEM[]
	clearDisplayValues: () => void
	setDisplayValue: React.Dispatch<React.SetStateAction<EXPRESSION_ITEM[]>>
}

export default function useEncryption({
	displayValue,
	clearDisplayValues,
	setDisplayValue
}: EncryptionProps) {

	const { encryption, hasEncryptionValue } = useGlobalContext()

	/**
	 * 特殊处理加密状态下的focus，需要清空
	 */
	const handleFocusWhenEncryption = useMemoizedFn(() => {
		const hasPasswordValue = displayValue?.find?.(v => v.type === LabelTypeMap.LabelPassword)
		if(encryption && hasPasswordValue) {
			clearDisplayValues()
		}
	})

	
	useUpdateEffect(() => {
		// 如果已经加密并且已经有值，则显示password node
		if (encryption && hasEncryptionValue) {
			setDisplayValue([
				{
					type: LabelTypeMap.LabelPassword,
					uniqueId: SnowflakeId(),
					value: "",
				},
			])
		}
		
		// 如果切换为不加密，则清空password node
		if(!encryption) {
			setDisplayValue(displayValue.filter(v => v.type !== LabelTypeMap.LabelPassword))
		}
	}, [encryption])

	return {
		handleFocusWhenEncryption
	}
}
