/**
 * 节点的基础样式计算hooks
 */
import { hexToRgba } from '@/MagicFlow/utils'
import React, { useMemo } from 'react'

type BaseStylesProps = {
	color: string
}

export default function useBaseStyles({ color }: BaseStylesProps) {

  const headerBackgroundColor = useMemo(() => {
	return hexToRgba(color, 0.05)
  }, [color])

  return {
	headerBackgroundColor
  }
}
