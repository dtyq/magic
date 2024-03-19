import { childFieldGap } from '@/MagicJsonSchemaEditor/constants'
import { useGlobal } from '@/MagicJsonSchemaEditor/context/GlobalContext/useGlobal'
import React, { useMemo } from 'react'

type SvgLineProps = {
	propertiesLength: number
	lastSchemaOffsetTop?: number
	childLength?: number
	defaultY1?: number
}

export default function useSvgLine({ propertiesLength, lastSchemaOffsetTop, childLength, defaultY1=-11 }: SvgLineProps) {

	const { showTopRow } = useGlobal()

	// 竖线svg属性
	const colSvgLineProps = useMemo(() => {
		const x = (propertiesLength - 1) * childFieldGap + 7
		const y1 = defaultY1
		const y2 = 26 + defaultY1 + (lastSchemaOffsetTop || 0)
		return {
			x1: x,
			x2: x,
			y1,
			y2,
		}
	}, [propertiesLength, childLength, lastSchemaOffsetTop])


	// 横线
	const rowSvgLineProps = useMemo(() => {
		const x1 = (propertiesLength - 1) * childFieldGap + 7
		const x2 = x1 + 12
		return {
			x1,
			x2,
			y1: 16,
			y2: 16,
			horizontal: true,
		}
	}, [propertiesLength, showTopRow])

	return {
		colSvgLineProps,
		rowSvgLineProps
	}
}
