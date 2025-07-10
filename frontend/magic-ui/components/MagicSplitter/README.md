# MagicSplitter 魔法分割面板组件

`MagicSplitter` 是一个基于 Ant Design Splitter 组件的增强版分割面板，提供了更简洁的样式和更好的用户体验。

## 属性

| 属性名           | 类型 | 默认值 | 说明                                |
| ---------------- | ---- | ------ | ----------------------------------- |
| ...SplitterProps | -    | -      | 支持所有 Ant Design Splitter 的属性 |

## 子组件

-   `MagicSplitter.Panel` - 分割面板的子面板组件，用于定义每个可调整大小的区域

## 基础用法

```tsx
import { MagicSplitter } from '@/components/base/MagicSplitter';

// 基础用法 - 水平分割
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>左侧面板内容</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>右侧面板内容</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 垂直分割
<MagicSplitter split="horizontal">
  <MagicSplitter.Panel>
    <div>上方面板内容</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>下方面板内容</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 设置默认尺寸
<MagicSplitter defaultSizes={[30, 70]}>
  <MagicSplitter.Panel>
    <div>左侧面板内容 (30%)</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>右侧面板内容 (70%)</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 多个面板
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>第一个面板</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>第二个面板</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>第三个面板</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 嵌套使用
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>左侧面板</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <MagicSplitter split="horizontal">
      <MagicSplitter.Panel>
        <div>右上面板</div>
      </MagicSplitter.Panel>
      <MagicSplitter.Panel>
        <div>右下面板</div>
      </MagicSplitter.Panel>
    </MagicSplitter>
  </MagicSplitter.Panel>
</MagicSplitter>
```

## 特点

1. **简洁设计**：移除了默认的拖动条样式，提供更干净的视觉效果
2. **无缝拖动**：拖动分割线时没有明显的视觉干扰
3. **灵活布局**：支持水平和垂直分割，以及嵌套使用
4. **零内边距**：面板默认没有内边距，让内容可以充分利用空间

## 何时使用

-   需要创建可调整大小的布局时
-   需要分割屏幕为多个可交互区域时
-   需要实现代码编辑器、文件浏览器等需要灵活调整空间的界面时
-   需要用户能够自定义各个区域的大小时

MagicSplitter 组件让你的分割面板更加简洁和用户友好，同时保持了 Ant Design Splitter 的所有功能特性。
