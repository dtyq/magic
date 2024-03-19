import { ShowColumns } from '@/MagicJsonSchemaEditor/constants'
import { useGlobal } from '@/MagicJsonSchemaEditor/context/GlobalContext/useGlobal'
import React, { useMemo } from 'react'

export default function useCols() {
	const { displayColumns = [] } = useGlobal()

	const LabelCol = useMemo(() => {
		return displayColumns.includes(ShowColumns.Value) || displayColumns.includes(ShowColumns.Description) ? 4 : 8
	}, [displayColumns])

	const TypeCol = useMemo(() => {
		return displayColumns.includes(ShowColumns.Value) ? 3 : 7
	}, [displayColumns])

	const ValueCol = useMemo(() => {
		if(!displayColumns.includes(ShowColumns.Label) &&
		!displayColumns.includes(ShowColumns.Type)) return 16
		if(displayColumns.includes(ShowColumns.Encryption)) return 9
		return 10
	}, [displayColumns])

	const DescCol = useMemo(() => {
		return !displayColumns.includes(ShowColumns.Value) &&
			displayColumns.includes(ShowColumns.Description)
			? 4
			: 0
	}, [displayColumns])


	return {
		LabelCol,
		TypeCol,
		ValueCol,
		DescCol
	}
}
