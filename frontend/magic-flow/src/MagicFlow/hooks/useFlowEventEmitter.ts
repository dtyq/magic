import { useCallback } from 'react';
import { FLOW_EVENTS, flowEventBus } from '@/common/BaseUI/Select/constants';

/**
 * 用于流程设计组件，触发流程交互事件的钩子函数
 * 
 * 使用场景：
 * 1. 在节点被选中时触发事件
 * 2. 在边被选中时触发事件
 * 3. 在画布被点击时触发事件
 * 4. 在流程数据更新时触发事件
 * 5. 在布局变更时触发事件
 * 6. 在缩放变更时触发事件
 */
export const useFlowEventEmitter = () => {
  /**
   * 触发节点选中事件
   * @param nodeId 被选中的节点ID
   */
  const emitNodeSelected = useCallback((nodeId?: string) => {
    flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, nodeId);
  }, []);

  /**
   * 触发边选中事件
   * @param edgeId 被选中的边ID
   */
  const emitEdgeSelected = useCallback((edgeId?: string) => {
    flowEventBus.emit(FLOW_EVENTS.EDGE_SELECTED, edgeId);
  }, []);

  /**
   * 触发画布点击事件
   * @param position 点击位置坐标
   */
  const emitCanvasClicked = useCallback((position?: { x: number, y: number }) => {
    flowEventBus.emit(FLOW_EVENTS.CANVAS_CLICKED, position);
  }, []);

  /**
   * 触发流程数据更新事件
   * @param data 更新的数据
   */
  const emitFlowDataUpdated = useCallback((data?: any) => {
    flowEventBus.emit(FLOW_EVENTS.FLOW_DATA_UPDATED, data);
  }, []);

  /**
   * 触发布局变更事件
   * @param layout 布局信息
   */
  const emitLayoutChanged = useCallback((layout?: any) => {
    flowEventBus.emit(FLOW_EVENTS.LAYOUT_CHANGED, layout);
  }, []);

  /**
   * 触发缩放变更事件
   * @param zoom 缩放信息
   */
  const emitZoomChanged = useCallback((zoom?: number) => {
    flowEventBus.emit(FLOW_EVENTS.ZOOM_CHANGED, zoom);
  }, []);

  return {
    emitNodeSelected,
    emitEdgeSelected,
    emitCanvasClicked,
    emitFlowDataUpdated,
    emitLayoutChanged,
    emitZoomChanged
  };
};

export default useFlowEventEmitter; 