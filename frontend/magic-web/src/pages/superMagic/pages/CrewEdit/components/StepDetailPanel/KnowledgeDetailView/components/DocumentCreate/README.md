# DocumentCreate 组件重构文档

## 概览

`DocumentCreate` 组件负责管理文档创建的多步骤流程。经过重构，组件从 273 行的单体结构优化为清晰的模块化架构，代码量减少至约 80 行，可维护性显著提升。

## 重构亮点

### 1. 配置驱动的架构 (Configuration-Driven Architecture)

**问题**：原代码存在 `renderCustomContent`、`renderProject`、`renderWiki` 三个高度重复的渲染函数，每个包含相似的 switch-case 逻辑。

**解决方案**：引入步骤组件注册表 (`step-registry.ts`)，使用配置映射文档类型和步骤到对应组件：

```typescript
// config/step-registry.ts
export const STEP_COMPONENT_REGISTRY: StepRegistry = {
  [DOCUMENT_TYPES.CUSTOM]: {
    1: { component: lazy(() => import('./custom-content/steps/TextInputStep')), storeKey: 'customContentStore' },
    2: { component: lazy(() => import('./custom-content/steps/StrategyConfigStep')), storeKey: 'customContentStore' },
    3: { component: lazy(() => import('./custom-content/steps/DataProcessingStep')), storeKey: 'customContentStore' },
  },
  // ...其他文档类型
}
```

**收益**：
- 消除了 120+ 行重复代码
- 新增文档类型只需修改配置，无需改动主组件
- 支持动态导入，优化首屏加载性能

### 2. 关注点分离 (Separation of Concerns)

**自定义 Hooks**：

1. **`useDocumentCreateStore`**: Store 实例化与生命周期管理
2. **`useDocumentCreateNavigation`**: 导航回调逻辑封装
3. **`useDocumentCreateSteps`**: 步骤数据计算与国际化

**组件层级**：

```
DocumentCreate (Container)
├── DocumentCreateLayout (Layout)
└── StepRenderer (Strategy Pattern)
    ├── LocalDocuments (Single-step flow)
    └── Dynamic Step Components (Multi-step flows)
        ├── CustomContent Steps
        ├── Project Steps
        └── Wiki Steps
```

### 3. 性能优化 (Performance Optimizations)

遵循 Vercel React 最佳实践：

- **5.1 渲染时计算派生状态**：`currentStepIndex` 通过 `useMemo` 计算
- **5.5 Memoized 组件**：`StepRenderer`、`ErrorView`、`StepLoadingSkeleton` 使用 `React.memo`
- **5.9 函数式 setState 更新**：使用 `useMemoizedFn` 和 `useCallback` 保持引用稳定
- **2.4 动态导入**：步骤组件按需加载，减小初始 bundle 大小

### 4. 类型安全 (Type Safety)

集中式类型定义 (`types.ts`)：

```typescript
export interface DocumentCreateProps { /* ... */ }
export interface StepComponentBaseProps { /* ... */ }
export interface StepComponentConfig { /* ... */ }
export type StepRegistry = Record<DocumentType, Record<number, StepComponentConfig>>
```

## 目录结构

```
DocumentCreate/
├── index.tsx                 # 主组件 (80 行)
├── types.ts                  # 类型定义
├── layout.tsx                # 布局组件
├── store/                    # MobX 状态管理
│   ├── document-create-store.ts
│   ├── local-document-store.ts
│   ├── custom-content-store.ts
│   ├── project-document-store.ts
│   └── wiki-document-store.ts
├── config/                   # 配置文件
│   └── step-registry.ts      # 步骤组件注册表
├── hooks/                    # 自定义 Hooks
│   ├── useDocumentCreateStore.ts
│   ├── useDocumentCreateNavigation.ts
│   ├── useDocumentCreateSteps.ts
│   ├── index.ts
│   └── __tests__/            # Hook 单元测试
├── components/               # 辅助组件
│   ├── StepRenderer.tsx      # 统一步骤渲染器
│   ├── ErrorView.tsx         # 错误视图
│   ├── StepLoadingSkeleton.tsx  # 加载骨架屏
│   ├── index.ts
│   └── __tests__/            # 组件单元测试
├── custom-content/           # Custom Content 文档类型
│   └── steps/                # 步骤组件
├── project/                  # Project 文档类型
│   └── steps/
├── wiki/                     # Wiki 文档类型
│   └── steps/
└── local-documents/          # Local 文档类型
```

## 使用示例

### 基本使用

```tsx
<DocumentCreate
  knowledgeCode="kb-123"
  documentType={DOCUMENT_TYPES.CUSTOM}
  knowledgeName="我的知识库"
  onComplete={() => console.log('创建完成')}
  onCancel={() => console.log('取消创建')}
/>
```

### 扩展新文档类型

1. 在 `config/step-registry.ts` 中添加配置：

```typescript
[DOCUMENT_TYPES.NEW_TYPE]: {
  1: {
    component: lazy(() => import('./new-type/steps/Step1')),
    storeKey: 'newTypeStore'
  },
  // ...更多步骤
}
```

2. 在 `store/` 中创建对应的 store (如需要)
3. 在 `constants/` 中添加类型定义
4. 无需修改主组件代码 ✅

## 测试覆盖

- ✅ 步骤注册表配置测试 (13 tests)
- ✅ Hooks 单元测试 (16 tests)
- ✅ 组件渲染测试 (9 tests)
- **总计**: 38 个测试用例全部通过

## 性能指标

- 主组件代码量：273 行 → 80 行 (**减少 70%**)
- 重复代码消除：3 个 render 函数 (120+ 行) → 1 个 StepRenderer 组件
- Bundle 优化：所有步骤组件支持按需加载 (React.lazy)
- 类型安全：100% TypeScript 覆盖

## 迁移指南

### 影响范围

主组件 API 保持不变，外部调用无需修改：

```typescript
// 调用方式完全兼容
<DocumentCreate
  knowledgeCode={knowledgeCode}
  documentType={documentType}
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

### 内部变更

- 步骤组件导入从直接导入改为注册表动态加载
- 渲染逻辑从多个 render 函数统一为 `StepRenderer`
- 状态管理、导航、步骤计算提取为独立 hooks

## 维护建议

1. **添加新步骤**：在 `step-registry.ts` 中添加配置即可
2. **修改步骤组件**：直接编辑对应的步骤组件文件
3. **调整导航逻辑**：修改 `useDocumentCreateNavigation` hook
4. **扩展状态管理**：在对应的 store 文件中添加 MobX observable

## 相关文档

- [Vercel React Best Practices](.cursor/skills/vercel-react-best-practices/)
- [KnowledgeDetailView 重构文档](../README.md)
- [MobX 官方文档](https://mobx.js.org/)

## 技术债务

- [ ] 考虑将 `Step` 类型移至独立的 types 文件
- [ ] 为各子 store 添加单元测试
- [ ] 评估是否需要为 `StepRenderer` 添加错误边界

---

**重构日期**: 2026-04-01  
**重构人员**: AI Assistant (Claude Sonnet 4.5)  
**审核状态**: 待人工审核
