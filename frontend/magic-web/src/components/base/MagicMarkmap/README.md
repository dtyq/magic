# MagicMarkmap 魔法思维导图组件

`MagicMarkmap` 是一个用于渲染和展示思维导图的组件，基于 Markmap 库实现，支持将 Markdown 格式的文本转换为交互式思维导图。

## 属性

| 属性名   | 类型    | 默认值 | 说明                             |
| -------- | ------- | ------ | -------------------------------- |
| content  | string  | -      | Markdown 格式的思维导图内容      |
| readonly | boolean | false  | 是否为只读模式，不允许编辑       |
| ...rest  | -       | -      | 支持传递其他 HTML 属性到容器元素 |

## 基础用法

```tsx
import { MagicMarkmap } from '@/components/base/MagicMarkmap';

// 基础用法
const markdownContent = `
# 项目计划
## 阶段一
### 需求分析
### 原型设计
## 阶段二
### 开发
### 测试
## 阶段三
### 部署
### 维护
`;

<MagicMarkmap content={markdownContent} />

// 只读模式
<MagicMarkmap content={markdownContent} readonly />

// 自定义样式
<MagicMarkmap
  content={markdownContent}
  style={{ height: '500px', width: '100%' }}
/>
```

## 思维导图格式

MagicMarkmap 使用 Markdown 的标题层级结构来定义思维导图的节点层级：

```markdown
# 根节点

## 二级节点1

### 三级节点1-1

### 三级节点1-2

## 二级节点2

### 三级节点2-1

#### 四级节点2-1-1
```

每个标题将成为思维导图中的一个节点，标题的层级决定了节点在思维导图中的层级。

## 特点

1. **Markdown 支持**：使用熟悉的 Markdown 语法创建思维导图
2. **交互式体验**：支持缩放、平移和折叠/展开节点
3. **自动布局**：自动计算节点位置和连线，无需手动排版
4. **响应式设计**：自动适应容器大小
5. **轻量级**：加载快速，性能优良

## 何时使用

-   需要展示层级结构的信息时
-   需要可视化项目计划或组织结构时
-   需要展示知识体系或概念关系时
-   需要将 Markdown 文档转换为思维导图时
-   需要在对话或文档中嵌入交互式思维导图时

MagicMarkmap 组件让思维导图的创建和展示变得简单高效，是展示结构化信息的理想选择。
