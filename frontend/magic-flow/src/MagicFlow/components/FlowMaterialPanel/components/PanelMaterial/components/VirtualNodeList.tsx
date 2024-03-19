import React, { memo, useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { prefix } from '@/MagicFlow/constants'
import styles from '../index.module.less'

interface VirtualNodeListProps {
  items: JSX.Element[]
  itemHeight: number
  overscan?: number
}

const VirtualNodeList = memo(({
  items,
  itemHeight,
  overscan = 5
}: VirtualNodeListProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })
  const [containerHeight, setContainerHeight] = useState(0)

  // 计算总高度
  const totalHeight = items.length * itemHeight

  // 监听滚动事件，计算可见范围
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return

      const { scrollTop, clientHeight } = containerRef.current
      
      // 计算开始和结束索引
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
      const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + clientHeight) / itemHeight) + overscan
      )

      setVisibleRange({ start: startIndex, end: endIndex })
    }

    // 设置容器高度
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      updateHeight()
      
      // 初始计算
      handleScroll()

      // 监听容器大小变化
      window.addEventListener('resize', updateHeight)
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      window.removeEventListener('resize', updateHeight)
    }
  }, [items.length, itemHeight, overscan])

  // 只渲染可见范围内的元素
  const visibleItems = items.slice(visibleRange.start, visibleRange.end + 1)

  return (
    <div 
      ref={containerRef}
      className={clsx(styles.virtualList, `${prefix}virtual-list`)}
      style={{ overflowY: 'auto', height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            position: 'absolute', 
            top: visibleRange.start * itemHeight,
            width: '100%'
          }}
        >
          {visibleItems}
        </div>
      </div>
    </div>
  )
})

export default VirtualNodeList 