/**
 * 根据用户传入自定义字段特殊配置及特殊控件类型，返回不同的字段可配置项
 */
import { FormItemType } from '@/MagicExpressionWidget/types'
import React, { useContext, useMemo } from 'react'
import { getDefaultBooleanConstantSource } from '../schema-item/constants'
import { useGlobal } from '@/MagicJsonSchemaEditor/context/GlobalContext/useGlobal'
import { EditorContext } from '../../editor'
import _ from 'lodash'
import { SchemaValueSplitor } from '@/MagicJsonSchemaEditor/constants'

type CustomConfigProps = {
	value: any
	name: string
	type: string
}

export default function useCustomConfig({ value, name, type }: CustomConfigProps) {
	const {
		allowOperation,
		customFieldsConfig,
		onlyExpression,
		allowAdd
	} = useGlobal()

	const { expressionSource } = useContext(EditorContext)
	
	const expressionSourceWithDefaultOptions = useMemo(() => {
		if (value?.type === FormItemType.Boolean) {
			const booleanConstants = getDefaultBooleanConstantSource()
			return [...booleanConstants, ...(expressionSource || [])]
		}
		return expressionSource
	}, [expressionSource, value])

	const _onlyExpression = useMemo(() => {
		const result = value?.type === FormItemType.Boolean || onlyExpression
		if (!customFieldsConfig || !_.has(customFieldsConfig, [name, "onlyExpression"]))
			return result
		return _.get(customFieldsConfig, [name, "onlyExpression"])
	}, [value, customFieldsConfig])

	const _allowOperation = useMemo(() => {
		if (!customFieldsConfig || !_.has(customFieldsConfig, [name, "allowOperation"]))
			return allowOperation
		return _.get(customFieldsConfig, [name, "allowOperation"])
	}, [allowOperation, customFieldsConfig])

	
	const _allowAdd = useMemo(() => {
		if (!customFieldsConfig || !_.has(customFieldsConfig, [name, "allowAdd"]))
			return allowAdd
		return _.get(customFieldsConfig, [name, "allowAdd"])
	}, [allowAdd, customFieldsConfig])


	const _constantDataSource = useMemo(() => {
		if (_.has(customFieldsConfig, [name, "constantsDataSource"])) {
			return _.get(customFieldsConfig, [name, "constantsDataSource"])
		}
		return []
	}, [customFieldsConfig])
	
	// 是否可以添加子成员类型
	const canAddSubFields = useMemo(() => {
		// 所有数组类型和对象类型都可以添加子级
		return (
			type?.startsWith?.(`${FormItemType.Array}`) ||
			type === FormItemType.Object
		)
	}, [type])


  return {
	expressionSourceWithDefaultOptions,
	_onlyExpression,
	_allowOperation,
	canAddSubFields,
	_constantDataSource,
	_allowAdd
  }
}
