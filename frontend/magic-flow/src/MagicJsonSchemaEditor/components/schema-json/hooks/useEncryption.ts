import { FormItemType } from '@/MagicExpressionWidget/types'
import { useGlobal } from '@/MagicJsonSchemaEditor/context/GlobalContext/useGlobal'
import { DisabledField } from '@/MagicJsonSchemaEditor/types/Schema'
import i18next, { t } from 'i18next'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type EncryptionProps = {
	value: any
}

export default function useEncryption({ 
	value
}: EncryptionProps) {


	const {
		disableFields
	} = useGlobal()
	
	// 是否禁用加密
	const disableEncryption = useMemo(() => {
		const isDisabledEncryption = disableFields.includes(DisabledField.Encryption)
		// 只允许普通值进行加密
		const enableEncryptionTypes = [
			FormItemType.Integer,
			FormItemType.Number,
			FormItemType.String,
		]
		// 判断是否有加密值，已经加密过则不允许再次加密
		const isEncryption = value?.encryption_value
		return isEncryption || isDisabledEncryption || !enableEncryptionTypes.includes(value?.type)
	}, [value, disableFields])


	/** 加密按钮提示 */
	const encryptionTooltips = useMemo(() => {
		// 判断是否有加密值，已经加密过则不允许再次加密
		const isEncryption = value?.encryption_value
		if(isEncryption) return i18next.t("jsonSchema.encryptionDesc", { ns: "magicFlow" })
		return ""
	}, [value])

	return {
		disableEncryption,
		encryptionTooltips
	}
}
