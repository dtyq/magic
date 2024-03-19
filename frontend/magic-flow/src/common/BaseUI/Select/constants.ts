// 自定义流程事件名称
export const FLOW_EVENTS = {
  // 节点选中事件
  NODE_SELECTED: 'flow:node-selected',
  // 边选中事件
  EDGE_SELECTED: 'flow:edge-selected',
  // 画布点击事件
  CANVAS_CLICKED: 'flow:canvas-clicked',
  // 流程数据更新事件
  FLOW_DATA_UPDATED: 'flow:data-updated',
  // 布局变更事件
  LAYOUT_CHANGED: 'flow:layout-changed',
  // 缩放事件
  ZOOM_CHANGED: 'flow:zoom-changed',
}

// 事件总线工具
export const flowEventBus = {
  /**
   * 发送事件
   * @param eventName 事件名称
   * @param detail 事件详情
   */
  emit: (eventName: string, detail?: any) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  },
  
  /**
   * 监听事件
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @returns 清理函数
   */
  on: (eventName: string, handler: (event: CustomEvent) => void) => {
    const wrappedHandler = (e: Event) => handler(e as CustomEvent)
    window.addEventListener(eventName, wrappedHandler)
    return () => window.removeEventListener(eventName, wrappedHandler)
  },
  
  /**
   * 移除事件监听
   * @param eventName 事件名称
   * @param handler 事件处理函数
   */
  off: (eventName: string, handler: (event: CustomEvent) => void) => {
    window.removeEventListener(eventName, handler as EventListener)
  }
} 