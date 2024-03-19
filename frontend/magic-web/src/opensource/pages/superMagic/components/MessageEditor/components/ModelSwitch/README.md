# ModelSwitch 组件重构说明

## 重构目标

将 `LanguageModelSwitch.tsx` 和 `index.tsx` 中的公共逻辑和 UI 组件抽离，实现代码复用。

## 文件结构

```
ModelSwitch/
├── index.tsx                      # 主组件（支持语言模型和图像模型切换）
├── LanguageModelSwitch.tsx        # 语言模型切换组件（简化版）
├── constants.ts                   # 共享常量（样式变体、图标尺寸映射）
├── types.ts                       # TypeScript 类型定义
├── utils.ts                       # 工具函数
├── components/
│   ├── ModelListContent.tsx       # 模型列表内容组件（复用）
│   ├── ModelIcon.tsx
│   ├── ModelName.tsx
│   ├── ModelTags.tsx
│   ├── ProviderName.tsx
│   └── ModelPreferenceTooltip.tsx
└── hooks/
    └── useModelSwitchLogic.ts     # 共享逻辑 Hook
```

## 抽离的公共部分

### 1. 常量 (`constants.ts`)

抽离了样式变体和尺寸映射：

- `modelSwitchVariants`: CVA 样式变体定义
- `ICON_SIZE_MAP`: 图标尺寸映射
- `CHEVRON_SIZE_MAP`: 下拉箭头尺寸映射

### 2. 共享逻辑 Hook (`hooks/useModelSwitchLogic.ts`)

封装了通用的状态管理和交互逻辑：

**状态管理：**
- `isOpen`: 下拉框打开状态
- `searchKeyword`: 搜索关键词
- `isOpeningModal`: 是否正在打开付费弹窗

**核心功能：**
- `handleModelClick`: 模型点击处理（包含 VIP 模型检测）
- `handleClose`: 关闭下拉框
- `handleOpenChange`: 下拉框状态变化处理
- `getModelDescription`: 获取模型描述
- 自动滚动到选中项

**参数：**
```typescript
interface UseModelSwitchLogicProps {
  onModelClick: (model: ModelItem) => void
  shouldCloseOnSelect?: boolean  // 是否在选择后关闭（默认 true）
}
```

### 3. 模型列表内容组件 (`components/ModelListContent.tsx`)

抽离了模型列表的 UI 渲染逻辑：

**功能：**
- 渲染模型分组列表
- 支持搜索过滤
- 显示模型名称、标签、描述
- Checkbox 选择交互
- Hover 状态管理

**参数：**
```typescript
interface ModelListContentProps {
  modelList: ModelListGroup[]
  selectedModel: ModelItem | null
  searchKeyword: string
  size: MessageEditorSize
  onModelClick: (model: ModelItem) => void
  selectedItemRef: React.RefObject<HTMLDivElement>
  getModelDescription: (model: ModelItem) => string | undefined
  modelKey?: "models" | "image_models"  // 支持不同的模型列表
}
```

## 组件差异

### LanguageModelSwitch.tsx

**特点：**
- 单一语言模型选择
- 选择后关闭下拉框
- 内部状态管理（immediate UI updates）
- 简化的交互流程

**使用场景：**
- 只需要选择语言模型
- 需要立即响应的 UI 更新

### index.tsx

**特点：**
- 支持语言模型和图像模型切换
- Tab 切换（语言模型 / 图像模型）
- 选择后不关闭（允许同时选择两种模型）
- Tooltip 提示当前选择的模型

**使用场景：**
- 需要同时选择语言模型和图像模型
- 需要在两种模型之间切换

## 复用策略

### 1. 逻辑复用

通过 `useModelSwitchLogic` Hook 复用：
- 状态管理
- 事件处理
- 自动滚动
- VIP 模型检测

### 2. UI 复用

通过 `ModelListContent` 组件复用：
- 模型列表渲染
- 搜索过滤
- Checkbox 交互
- Hover 状态

### 3. 样式复用

通过 `constants.ts` 复用：
- CVA 样式变体
- 尺寸映射
- 一致的视觉效果

## 使用示例

### 使用 LanguageModelSwitch

```tsx
import { ModelSwitch } from "./LanguageModelSwitch"

<ModelSwitch
  size="default"
  selectedModel={selectedModel}
  modelList={modelList}
  onModelChange={handleModelChange}
  showName
  showBorder
/>
```

### 使用主 ModelSwitch

```tsx
import { ModelSwitch } from "./index"

<ModelSwitch
  size="default"
  selectedModel={selectedLanguageModel}
  selectedImageModel={selectedImageModel}
  modelList={languageModelList}
  imageModelList={imageModelList}
  onModelChange={handleLanguageModelChange}
  onImageModelChange={handleImageModelChange}
  showName
  showBorder
/>
```

## 优势

1. **代码复用**：减少重复代码，提高可维护性
2. **逻辑分离**：业务逻辑和 UI 渲染分离
3. **类型安全**：完整的 TypeScript 类型定义
4. **易于扩展**：新增功能只需修改共享部分
5. **一致性**：两个组件保持一致的交互和视觉效果

## 技术栈

- **样式系统**: Tailwind CSS + CVA
- **UI 组件**: shadcn/ui (Checkbox, Tooltip)
- **状态管理**: React Hooks
- **类型系统**: TypeScript

