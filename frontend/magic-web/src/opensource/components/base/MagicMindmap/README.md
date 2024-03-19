# MagicMindmap 魔法思维导图组件

MagicMindmap 是一个用于渲染和交互式操作思维导图的组件。该组件基于 MindMap 库实现，支持思维导图的展示、缩放和自适应布局等功能，为用户提供直观的思维导图可视化体验。

## 属性

| 属性名   | 类型    | 默认值 | 描述                                           |
| -------- | ------- | ------ | ---------------------------------------------- |
| data     | object  | -      | 思维导图的数据结构，包含节点和连接信息         |
| readonly | boolean | false  | 是否为只读模式，为 true 时用户无法编辑思维导图 |

此外，组件还支持传入其他 HTML div 元素的属性。

## 基本用法

```tsx
import MagicMindmap from '@/components/base/MagicMindmap';

// 基本用法
const mindmapData = {
  id: 'root',
  topic: '中心主题',
  children: [
    {
      id: 'sub1',
      topic: '子主题 1',
      children: [
        { id: 'sub1-1', topic: '子主题 1-1' },
        { id: 'sub1-2', topic: '子主题 1-2' }
      ]
    },
    {
      id: 'sub2',
      topic: '子主题 2',
      children: [
        { id: 'sub2-1', topic: '子主题 2-1' }
      ]
    }
  ]
};

<MagicMindmap data={mindmapData} />

// 只读模式
<MagicMindmap data={mindmapData} readonly={true} />

// 自定义样式
<MagicMindmap
  data={mindmapData}
  className="custom-mindmap"
  style={{ height: '500px', border: '1px solid #eee' }}
/>
```

## 数据结构

思维导图的数据结构遵循以下格式：

```typescript
interface MindMapNode {
	id: string // 节点唯一标识
	topic: string // 节点显示的文本
	children?: MindMapNode[] // 子节点数组
	style?: object // 可选的节点样式
	expanded?: boolean // 是否展开子节点
	// 其他可选属性...
}
```

## 特性

-   **交互式操作**：支持缩放、拖拽和节点展开/折叠
-   **自适应布局**：自动调整节点位置，确保最佳的可视化效果
-   **响应式设计**：适应容器大小变化，自动调整思维导图布局
-   **只读模式**：支持只读模式，适用于展示场景
-   **自定义样式**：可以通过 CSS 自定义思维导图的外观

## 使用场景

-   知识结构的可视化展示
-   项目计划和任务分解的呈现
-   概念和想法的组织与关联
-   学习内容的结构化展示
-   任何需要展示层级关系和关联的场景

MagicMindmap 组件为应用提供了一种直观而强大的方式来展示和操作思维导图，帮助用户更好地理解和组织信息结构。
