import { useState, useCallback } from "react";
import { Node } from "reactflow";
import { HelperLinesOptions } from "../components/HelperLines/types";

interface UseHelperLinesProps {
  /** 流程图节点 */
  nodes: Node[];
  /** 原始节点拖动事件处理函数 */
  onNodeDrag?: (event: React.MouseEvent, node: Node) => void;
  /** 原始节点拖动开始事件处理函数 */
  onNodeDragStart?: (event: React.MouseEvent, node: Node) => void;
  /** 原始节点拖动结束事件处理函数 */
  onNodeDragStop?: (event: React.MouseEvent, node: Node, nodes?: Node[]) => void;
  /** 节点变更函数，用于实现节点吸附功能 */
  onNodesChange?: (changes: any[]) => void;
  /** 辅助线配置选项 */
  options?: HelperLinesOptions;
  /** 是否启用辅助线功能 */
  enabled?: boolean;
}

/**
 * 辅助线hook，用于在拖拽节点时显示对齐参考线并实现吸附对齐
 * 
 * @param props 配置项
 * @returns 包含辅助线状态和处理函数的对象
 */
export function useHelperLines(props: UseHelperLinesProps) {
  const { 
    nodes, 
    onNodeDrag, 
    onNodeDragStart, 
    onNodeDragStop,
    onNodesChange,
    options = {},
    enabled = false
  } = props;
  
  // 设置阈值，默认为5
  const SNAP_THRESHOLD = options.threshold || 5;
  
  // 是否启用吸附功能
  const enableSnap = options.enableSnap !== false;

  // 辅助线状态
  const [horizontalLines, setHorizontalLines] = useState<number[]>([]);
  const [verticalLines, setVerticalLines] = useState<number[]>([]);

  // 当前拖动的节点
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);

  // 处理节点拖动开始
  const handleNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (enabled) {
        setDraggedNode(node);
      }
      
      if (onNodeDragStart) {
        onNodeDragStart(event, node);
      }
    },
    [onNodeDragStart, enabled]
  );

  // 处理节点拖动
  const handleNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // 如果辅助线功能未启用，直接调用原始的onNodeDrag回调
      if (!enabled) {
        if (onNodeDrag) {
          onNodeDrag(event, node);
        }
        return;
      }

      if (!draggedNode) return;

      // 清除之前的辅助线
      setHorizontalLines([]);
      setVerticalLines([]);

      // 忽略被拖动的节点
      const otherNodes = nodes.filter((n) => n.id !== node.id);

      const horizontalAlignments: number[] = [];
      const verticalAlignments: number[] = [];
      
      // 用于存储节点吸附的位置
      let snapX: number | null = null;
      let snapY: number | null = null;

      // 比较当前拖动节点与其他节点的位置
      otherNodes.forEach((otherNode) => {
        // 水平对齐 - 检查顶部对齐
        if (Math.abs(node.position.y - otherNode.position.y) < SNAP_THRESHOLD) {
          horizontalAlignments.push(otherNode.position.y);
          if (enableSnap) {
            snapY = otherNode.position.y;
          }
        }

        // 水平对齐 - 检查底部对齐 (假设节点有高度)
        const nodeHeight = (node as any).height || 40;
        const otherNodeHeight = (otherNode as any).height || 40;
        if (
          Math.abs(
            node.position.y + nodeHeight - (otherNode.position.y + otherNodeHeight)
          ) < SNAP_THRESHOLD
        ) {
          horizontalAlignments.push(otherNode.position.y + otherNodeHeight);
          if (enableSnap) {
            snapY = otherNode.position.y + otherNodeHeight - nodeHeight;
          }
        }

        // 水平对齐 - 检查中心对齐
        if (
          Math.abs(
            node.position.y + nodeHeight / 2 - (otherNode.position.y + otherNodeHeight / 2)
          ) < SNAP_THRESHOLD
        ) {
          horizontalAlignments.push(otherNode.position.y + otherNodeHeight / 2);
          if (enableSnap) {
            snapY = otherNode.position.y + (otherNodeHeight / 2) - (nodeHeight / 2);
          }
        }

        // 垂直对齐 - 检查左侧对齐
        if (Math.abs(node.position.x - otherNode.position.x) < SNAP_THRESHOLD) {
          verticalAlignments.push(otherNode.position.x);
          if (enableSnap) {
            snapX = otherNode.position.x;
          }
        }

        // 垂直对齐 - 检查右侧对齐
        const nodeWidth = (node as any).width || 150;
        const otherNodeWidth = (otherNode as any).width || 150;
        if (
          Math.abs(
            node.position.x + nodeWidth - (otherNode.position.x + otherNodeWidth)
          ) < SNAP_THRESHOLD
        ) {
          verticalAlignments.push(otherNode.position.x + otherNodeWidth);
          if (enableSnap) {
            snapX = otherNode.position.x + otherNodeWidth - nodeWidth;
          }
        }

        // 垂直对齐 - 检查中心对齐
        if (
          Math.abs(
            node.position.x + nodeWidth / 2 - (otherNode.position.x + otherNodeWidth / 2)
          ) < SNAP_THRESHOLD
        ) {
          verticalAlignments.push(otherNode.position.x + otherNodeWidth / 2);
          if (enableSnap) {
            snapX = otherNode.position.x + (otherNodeWidth / 2) - (nodeWidth / 2);
          }
        }
      });

      // 更新辅助线
      setHorizontalLines(horizontalAlignments);
      setVerticalLines(verticalAlignments);

      // 应用吸附位置
      if (enableSnap && onNodesChange && (snapX !== null || snapY !== null)) {
        // 创建一个新的节点位置对象
        const newPosition = {
          x: snapX !== null ? snapX : node.position.x,
          y: snapY !== null ? snapY : node.position.y,
        };
        
        // 更新节点位置，应用吸附效果
        const nodeChange = {
          id: node.id,
          type: 'position',
          position: newPosition,
        };
        
        onNodesChange([nodeChange]);
      } else {
        // 如果没有吸附，仍然调用原来的onNodeDrag回调
        if (onNodeDrag) {
          onNodeDrag(event, node);
        }
      }
    },
    [draggedNode, nodes, onNodeDrag, onNodesChange, SNAP_THRESHOLD, enableSnap, enabled]
  );

  // 处理节点拖动结束
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, dragNodes?: Node[]) => {
      // 清除辅助线和拖动节点状态
      if (enabled) {
        setHorizontalLines([]);
        setVerticalLines([]);
        setDraggedNode(null);
      }

      // 调用原来的onNodeDragStop回调
      if (onNodeDragStop) {
        onNodeDragStop(event, node, dragNodes);
      }
    },
    [onNodeDragStop, enabled]
  );

  return {
    // 状态
    horizontalLines,
    verticalLines,
    
    // 辅助线配置
    options,
    
    // 是否启用
    enabled,
    
    // 事件处理器
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    
    // 是否有辅助线
    hasHelperLines: enabled && (horizontalLines.length > 0 || verticalLines.length > 0)
  };
} 