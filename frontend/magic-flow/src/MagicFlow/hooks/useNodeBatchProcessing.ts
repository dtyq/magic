import { useState, useCallback, useRef, useEffect } from 'react'

// 节点分批处理钩子函数
export interface BatchProcessingOptions {
  // 单次批处理的节点数量
  batchSize?: number
  // 批次间隔时间(毫秒)
  interval?: number
  // 是否在处理完成后自动停止
  autoStop?: boolean
  // 完成回调
  onComplete?: () => void
  // 进度回调
  onProgress?: (current: number, total: number) => void
}

export const useNodeBatchProcessing = (options: BatchProcessingOptions = {}) => {
  const {
    batchSize = 50,
    interval = 150,
    autoStop = true,
    onComplete,
    onProgress
  } = options

  // 批处理状态
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  
  // 存储节点和回调函数
  const nodeQueueRef = useRef<any[]>([])
  const processCallbackRef = useRef<(nodes: any[]) => void>(() => {})
  const intervalIdRef = useRef<any>(null)

  // 停止处理
  const stopProcessing = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }
    setIsProcessing(false)
  }, [])

  // 清理函数
  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
      }
    }
  }, [])

  // 批量处理节点
  const processNodesBatch = useCallback((
    allNodes: any[],
    processCallback: (nodes: any[]) => void,
    customOptions?: Partial<BatchProcessingOptions>
  ) => {
    const mergedOptions = { ...options, ...customOptions }
    const actualBatchSize = mergedOptions.batchSize || batchSize
    const actualInterval = mergedOptions.interval || interval
    
    // 保存节点和回调函数
    nodeQueueRef.current = [...allNodes]
    processCallbackRef.current = processCallback

    // 计算总批次
    const totalBatches = Math.ceil(allNodes.length / actualBatchSize)
    
    // 如果没有节点，直接返回
    if (allNodes.length === 0) {
      if (mergedOptions.onComplete) {
        mergedOptions.onComplete()
      }
      return
    }
    
    // 如果节点数量少于一个批次，直接处理
    if (allNodes.length <= actualBatchSize) {
      processCallback(allNodes)
      setProgress({ current: 1, total: 1 })
      if (mergedOptions.onProgress) {
        mergedOptions.onProgress(1, 1)
      }
      if (mergedOptions.onComplete) {
        mergedOptions.onComplete()
      }
      return
    }
    
    // 开始分批处理
    setIsProcessing(true)
    setProgress({ current: 0, total: totalBatches })
    
    let currentBatch = 0
    
    // 处理第一批
    const firstBatch = allNodes.slice(0, actualBatchSize)
    processCallback(firstBatch)
    currentBatch = 1
    setProgress({ current: currentBatch, total: totalBatches })
    if (mergedOptions.onProgress) {
      mergedOptions.onProgress(currentBatch, totalBatches)
    }
    
    // 设置定时器处理剩余批次
    intervalIdRef.current = setInterval(() => {
      const start = currentBatch * actualBatchSize
      const end = Math.min(start + actualBatchSize, allNodes.length)
      
      // 如果已经处理完所有批次
      if (currentBatch >= totalBatches) {
        stopProcessing()
        if (mergedOptions.onComplete) {
          mergedOptions.onComplete()
        }
        return
      }
      
      // 创建新的节点数组，包含所有之前处理过的节点和新批次节点
      const nextBatch = allNodes.slice(0, end)
      processCallback(nextBatch)
      
      // 更新进度
      currentBatch++
      setProgress({ current: currentBatch, total: totalBatches })
      if (mergedOptions.onProgress) {
        mergedOptions.onProgress(currentBatch, totalBatches)
      }
      
      // 所有批次处理完成后，如果设置了autoStop，则停止处理
      if (currentBatch >= totalBatches && autoStop) {
        stopProcessing()
        if (mergedOptions.onComplete) {
          mergedOptions.onComplete()
        }
      }
    }, actualInterval)
    
    return stopProcessing
  }, [options, batchSize, interval, stopProcessing, autoStop])

  return {
    isProcessing,
    progress,
    processNodesBatch,
    stopProcessing
  }
}

export default useNodeBatchProcessing 