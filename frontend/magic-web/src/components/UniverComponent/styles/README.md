# UniverComponent 样式处理模块

这个模块专门处理 Excel 文件到 Univer 格式的样式转换，完全参考了 `old/` 目录中的样式处理逻辑，并进行了代码隔离和文件拆分。

## 文件结构

```
styles/
├── index.ts              # 模块入口文件，导出所有样式处理功能
├── color-utils.ts        # 颜色处理工具，支持Excel颜色索引、RGB、主题色等
├── default-styles.ts     # 默认样式配置，针对中文环境优化
├── style-converter.ts    # 核心样式转换器，Excel样式 -> Univer样式
├── text-processor.ts     # 文本和富文本处理，支持HTML和Excel富文本
└── README.md            # 本文档
```

## 主要功能

### 1. 颜色处理 (`color-utils.ts`)

- **Excel 索引颜色支持**: 支持完整的 127 色 Excel 调色板
- **RGB 颜色转换**: 处理 ARGB 格式，自动移除 Alpha 通道
- **主题颜色处理**: 支持 Excel 主题色和色调变化(tint)
- **颜色标准化**: 统一转换为十六进制格式

```typescript
import { processExcelColor, getExcelIndexedColor } from './color-utils'

// 处理 Excel 颜色对象
const color = processExcelColor({ rgb: "FF0000" }, "#000000") // "#FF0000"

// 获取索引颜色
const indexedColor = getExcelIndexedColor(2) // "#FF0000"
```

### 2. 样式转换 (`style-converter.ts`)

核心样式转换功能，支持：

- **字体样式**: 大小、名称、粗体、斜体、颜色、上下标
- **背景填充**: 纯色、灰色填充模式
- **对齐方式**: 水平、垂直对齐，文本换行，旋转，缩进
- **边框样式**: 四边边框，多种线型和颜色
- **数字格式**: Excel 数字格式转换
- **富文本**: HTML 和 Excel 富文本支持

```typescript
import { convertExcelStyleToUniver } from './style-converter'

const excelStyle = {
  font: { sz: 14, name: "Arial", bold: true, color: { rgb: "FF0000" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
  alignment: { horizontal: "center", vertical: "middle" }
}

const univerStyle = convertExcelStyleToUniver(excelStyle)
```

### 3. 文本处理 (`text-processor.ts`)

- **HTML 转富文本**: 将 HTML 格式转换为 Univer 富文本格式
- **Excel 富文本**: 处理 Excel XML 富文本数据
- **跨环境兼容**: 支持浏览器和 Worker 环境

```typescript
import { convertHtmlToRichText, processExcelRichText } from './text-processor'

// HTML 转富文本
const richText = convertHtmlToRichText('<b>粗体</b><i>斜体</i>')

// Excel 富文本处理
const excelRichText = processExcelRichText(xmlString)
```

### 4. 默认样式 (`default-styles.ts`)

针对中文环境优化的默认样式：

- **居中对齐**: 水平和垂直居中
- **自动换行**: 支持长文本换行
- **中文字体**: 优先使用微软雅黑
- **合适间距**: 为中文显示优化的内边距

```typescript
import { getDefaultCellStyle, createDefaultStylesMap } from './default-styles'

const defaultStyle = getDefaultCellStyle()
const stylesMap = createDefaultStylesMap()
```

## 使用方式

### 基本使用

```typescript
import { 
  convertExcelStyleToUniver,
  processExcelColor,
  getDefaultCellStyle 
} from './styles'

// 转换 Excel 样式
const univerStyle = convertExcelStyleToUniver(excelStyleObject)

// 处理颜色
const color = processExcelColor(colorObject)

// 获取默认样式
const defaultStyle = getDefaultCellStyle()
```

### 在数据转换中使用

```typescript
import { transformExcelToUniverWorkbook } from './data-converter'

// 转换带样式的 Excel 数据
const workbookData = transformExcelToUniverWorkbook(excelSheetsData, fileName)
```

## 特性

### ✅ 完整的样式支持

- 字体样式（大小、名称、粗体、斜体、颜色）
- 背景填充（纯色、渐变、图案）
- 边框样式（四边边框、多种线型）
- 对齐方式（水平、垂直、换行、旋转）
- 数字格式（Excel 格式代码）
- 富文本（HTML 和 Excel 富文本）

### ✅ 中文环境优化

- 默认使用微软雅黑字体
- 合适的行高和列宽
- 居中对齐和自动换行
- 中文字符宽度计算

### ✅ 高性能

- 代码分离，按需加载
- 样式缓存和复用
- 智能样式合并

### ✅ 兼容性

- 支持浏览器和 Worker 环境
- 兼容多种 Excel 版本
- 向后兼容旧版本 API

## 测试

运行样式转换测试：

```typescript
import { runStyleTests } from './test-styles'

runStyleTests() // 运行所有样式功能测试
```

## 从 old/ 目录迁移

这个新的样式处理模块完全基于 `old/utils/` 中的代码，主要改进：

1. **代码隔离**: 将样式处理逻辑独立到专门的目录
2. **文件拆分**: 按功能拆分为多个专门的文件
3. **类型安全**: 改进了类型定义，减少 `any` 的使用
4. **模块化**: 更好的模块化设计，便于维护和扩展

所有原有的样式转换功能都得到了保留和增强。
