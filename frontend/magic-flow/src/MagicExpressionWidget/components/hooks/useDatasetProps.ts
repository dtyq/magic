import { useMemo } from 'react'
import { EXPRESSION_ITEM } from '@/MagicExpressionWidget/types'

type DatasetProps = {
	config: EXPRESSION_ITEM
}

export default function useDatasetProps({ config }:DatasetProps ) {
	
	const datasetProps = useMemo(() => {
		return {
			"data-id": config.uniqueId,
			"data-type": config.type,
		}
	}, [config])

	return {
		datasetProps
	}
}
