# MagicEllipseWithTooltip 魔法省略提示组件

`MagicEllipseWithTooltip` 是一个智能的文本省略组件，当文本超出指定宽度时自动显示省略号，并在鼠标悬停时通过工具提示显示完整文本。

## 属性

| 属性名            | 类型   | 默认值 | 说明                                                     |
| ----------------- | ------ | ------ | -------------------------------------------------------- |
| text              | string | -      | 要显示的文本内容                                         |
| maxWidth          | string | -      | 文本最大宽度，超出部分用省略号代替，如 "200px"、"50%" 等 |
| ...HTMLAttributes | -      | -      | 支持所有 HTML div 元素的属性                             |

## 基础用法

```tsx
import { MagicEllipseWithTooltip } from '@/components/base/MagicEllipseWithTooltip';

// 基础用法
<MagicEllipseWithTooltip
  text="这是一段很长的文本，当它超出指定宽度时会显示省略号，鼠标悬停时会显示完整内容"
  maxWidth="200px"
/>

// 自定义样式
<MagicEllipseWithTooltip
  text="自定义样式的省略文本"
  maxWidth="150px"
  style={{
    color: 'blue',
    fontSize: '16px',
    fontWeight: 'bold'
  }}
/>

// 在表格单元格中使用
<Table
  columns={[
    {
      title: '描述',
      dataIndex: 'description',
      render: (text) => (
        <MagicEllipseWithTooltip
          text={text}
          maxWidth="150px"
        />
      ),
    },
    // 其他列...
  ]}
  dataSource={data}
/>

// 在列表项中使用
<List
  dataSource={data}
  renderItem={(item) => (
    <List.Item>
      <MagicEllipseWithTooltip
        text={item.title}
        maxWidth="100%"
      />
    </List.Item>
  )}
/>

// 处理事件
<MagicEllipseWithTooltip
  text="点击我触发事件"
  maxWidth="120px"
  onClick={() => console.log('文本被点击了')}
/>
```

## 特点

1. **智能检测**：只有当文本实际溢出时才会显示工具提示
2. **简洁设计**：使用单行省略，保持界面整洁
3. **灵活配置**：可以设置最大宽度，适应各种布局需求
4. **完全可定制**：支持所有 div 元素的属性和样式

## 何时使用

-   需要在有限空间内显示可能过长的文本时
-   需要保持界面整洁同时又不丢失信息时
-   在表格、列表、卡片等组件中显示标题或描述时
-   需要确保用户可以查看被截断文本的完整内容时

MagicEllipseWithTooltip 组件让你的长文本展示更加优雅和用户友好，既保持了界面的整洁，又确保了信息的完整性。
