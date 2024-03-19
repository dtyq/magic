# Z-Index Migration Guide

## 问题背景

之前使用 `getTailwindZIndex(value: number)` 动态生成 Tailwind 类名（如 `z-[9000]`），这种方式存在以下问题：

1. **Tailwind JIT 编译器限制**：动态生成的类名可能无法被 Tailwind 的内容扫描器识别
2. **构建时优化**：模板字符串生成的类名不利于静态分析和 tree-shaking

## 解决方案

改用预定义的 Tailwind 类名常量：

### 之前（不推荐）

```typescript
import { HTML_EDITOR_Z_INDEX, getTailwindZIndex } from './constants/z-index'

<div className={getTailwindZIndex(HTML_EDITOR_Z_INDEX.OVERLAY.SELECTION_HIGHLIGHT)} />
// 生成: className="z-[9100]"
```

### 现在（推荐）

```typescript
import { TAILWIND_Z_INDEX_CLASSES } from './constants/z-index'

<div className={TAILWIND_Z_INDEX_CLASSES.OVERLAY.SELECTION_HIGHLIGHT} />
// 直接使用: className="z-[9100]"
```

## 优势

1. ✅ **确保 Tailwind JIT 兼容性**：类名字符串直接出现在源代码中，保证被扫描到
2. ✅ **更好的类型安全**：使用 `as const` 确保类型推断
3. ✅ **构建时优化**：避免运行时字符串拼接
4. ✅ **代码更简洁**：少一次函数调用

## 已迁移的文件

- ✅ `IsolatedHTMLRenderer.tsx`
- ✅ `components/SelectionOverlay/SelectionOverlay.tsx`
- ✅ `components/PPTRender/PPTSidebar/index.tsx`
- ✅ `components/PPTRender/PPTSlide.tsx`
- ✅ `components/PPTRender/index.tsx`

## 废弃说明

- `getTailwindZIndex()` 已标记为 `@deprecated`，建议使用 `TAILWIND_Z_INDEX_CLASSES`
- `editing-script.ts` (V1 编辑脚本) 已标记为废弃，不再维护其中的 z-index 值

## 后续维护

添加新的 z-index 值时，需要同时更新两处：

```typescript
// 1. 数值常量（用于 inline styles）
export const HTML_EDITOR_Z_INDEX = {
	OVERLAY: {
		NEW_ELEMENT: 9200,
	},
}

// 2. Tailwind 类名常量（用于 className）
export const TAILWIND_Z_INDEX_CLASSES = {
	OVERLAY: {
		NEW_ELEMENT: "z-[9200]",
	},
}
```
