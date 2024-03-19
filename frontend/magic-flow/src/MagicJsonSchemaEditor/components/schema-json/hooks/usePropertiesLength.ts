import { useGlobal } from '@/MagicJsonSchemaEditor/context/GlobalContext/useGlobal'
import React, { useMemo } from 'react'

type PropertiesLengthProps = {
	prefix: string[]
}

export default function usePropertiesLength({ prefix }: PropertiesLengthProps) {

	const { showTopRow } = useGlobal()
	
	// type=object的字段总数
	const propertiesLength = useMemo(() => {
		const result = prefix.filter((name) => name !== "properties").length
		return showTopRow ? result + 1 : result
	}, [prefix, showTopRow])


  return {
	propertiesLength
  }
}
