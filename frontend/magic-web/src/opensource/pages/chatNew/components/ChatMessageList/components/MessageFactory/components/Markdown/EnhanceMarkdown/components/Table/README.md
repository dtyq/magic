# Table 组件

此文件夹包含增强 Markdown 表格相关的所有组件。

## 文件结构

```
Table/
├── index.ts              # 统一导出文件
├── TableWrapper.tsx      # 表格包装器，支持列数限制和展开功能
├── TableCell.tsx         # 表格单元格，支持长文本处理和对齐
├── RowDetailDrawer.tsx   # 行详细信息抽屉组件
├── useTableI18n.ts       # 国际化 hook
├── styles.ts             # antd-style 样式定义
└── README.md            # 说明文档
```

## 功能特性

### TableWrapper
- 🔢 **列数限制**：超过 6 列时自动隐藏后续列
- 🔍 **展开功能**：点击"显示更多"按钮在 Drawer 中查看完整数据
- 📱 **响应式设计**：移动端自适应

### TableCell
- 📏 **长文本处理**：自动检测并支持长文本展开
- ⚖️ **智能对齐**：根据内容自动判断对齐方式
- 🎯 **特殊符号支持**：数学符号和特殊字符的居中显示

### RowDetailDrawer
- 🎨 **Antd 集成**：使用 antd Drawer 组件
- 📋 **表单展示**：以表单形式展示行数据
- 🚀 **流畅动画**：内置滑入动画效果

### 国际化支持
- 🌍 **多语言**：支持中文和英文
- 🔧 **统一管理**：通过 `useTableI18n` hook 统一管理翻译
- 📝 **完整覆盖**：所有用户可见文本都支持国际化

## 使用方法

```tsx
import { TableWrapper, TableCell, useTableStyles, useTableI18n } from "./Table"

// 在 markdown 组件配置中使用
const components = {
  table: TableWrapper,
  td: (props) => <TableCell {...props} />,
  th: (props) => <TableCell isHeader {...props} />
}

// 如需自定义样式
const MyComponent = () => {
  const { styles, cx } = useTableStyles()
  return <div className={styles.tableContainer}>...</div>
}

// 使用国际化
const MyTableComponent = () => {
  const i18n = useTableI18n()
  return <button>{i18n.showMore}</button>
}
```

## 样式系统

使用 `antd-style` 的 CSS-in-JS 解决方案：
- 🎨 **主题集成**：自动适配 antd 主题色彩
- 🌓 **暗色模式**：支持明暗主题切换
- 📱 **响应式**：内置移动端适配
- 🔧 **类型安全**：完整的 TypeScript 类型支持

## 配置选项

- `MAX_VISIBLE_COLUMNS`: 最大可见列数（默认 6）
- `LONG_TEXT_THRESHOLD`: 长文本阈值（默认 50 字符）

## 国际化配置

在 `src/opensource/assets/locales/{locale}/interface.json` 中添加以下翻译：

```json
{
  "markdownTable": {
    "showMore": "显示更多",
    "rowDetails": "行详细信息",
    "clickToExpand": "点击展开完整内容",
    "showAllColumns": "显示全部",
    "hideAllColumns": "隐藏",
    "defaultColumn": "列"
  }
}
```

支持的语言：
- 🇨🇳 中文 (`zh_CN`)
- 🇺🇸 英文 (`en_US`) 