# MagicCollapse 魔法折叠面板组件

`MagicCollapse` 是一个基于 Ant Design Collapse 组件的增强版折叠面板，提供了更美观的样式和更好的用户体验。

## 属性

| 属性名           | 类型 | 默认值 | 说明                                |
| ---------------- | ---- | ------ | ----------------------------------- |
| ...CollapseProps | -    | -      | 支持所有 Ant Design Collapse 的属性 |

## 基础用法

```tsx
import { MagicCollapse } from '@/components/base/MagicCollapse';
import { Collapse } from 'antd';

const { Panel } = Collapse;

// 基础用法
<MagicCollapse>
  <Panel header="这是面板标题1" key="1">
    <p>这是面板内容1</p>
  </Panel>
  <Panel header="这是面板标题2" key="2">
    <p>这是面板内容2</p>
  </Panel>
  <Panel header="这是面板标题3" key="3">
    <p>这是面板内容3</p>
  </Panel>
</MagicCollapse>

// 默认展开指定面板
<MagicCollapse defaultActiveKey={['1']}>
  <Panel header="默认展开的面板" key="1">
    <p>这是默认展开的面板内容</p>
  </Panel>
  <Panel header="默认关闭的面板" key="2">
    <p>这是默认关闭的面板内容</p>
  </Panel>
</MagicCollapse>

// 手风琴模式（一次只能展开一个面板）
<MagicCollapse accordion>
  <Panel header="手风琴面板1" key="1">
    <p>手风琴面板内容1</p>
  </Panel>
  <Panel header="手风琴面板2" key="2">
    <p>手风琴面板内容2</p>
  </Panel>
</MagicCollapse>

// 监听展开/折叠事件
<MagicCollapse onChange={(key) => console.log('当前展开的面板:', key)}>
  <Panel header="可监听的面板1" key="1">
    <p>面板内容1</p>
  </Panel>
  <Panel header="可监听的面板2" key="2">
    <p>面板内容2</p>
  </Panel>
</MagicCollapse>
```

## 特点

1. **优化的样式**：使用 ghost 模式，去除了边框，更加简洁美观
2. **自定义展开图标**：使用 MagicIcon 组件作为展开图标，视觉效果更统一
3. **平滑的动画**：展开/折叠时有平滑的旋转动画效果
4. **灵活布局**：展开图标位于右侧，符合现代设计趋势

## 何时使用

-   需要将复杂内容分组展示时
-   需要节省页面空间，将内容折叠起来时
-   需要创建手风琴效果（一次只展开一个面板）时
-   需要分类展示信息，并允许用户按需查看时

MagicCollapse 组件让你的折叠面板更加美观和用户友好，同时保持了 Ant Design Collapse 的所有功能特性。
