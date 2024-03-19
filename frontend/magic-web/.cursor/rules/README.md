# Cursor Rules 规范文档

> 最后更新：2024-11 | 规则数量：19 个（已优化）

## 概述

本目录包含项目开发过程中需要遵循的各种规范和最佳实践。这些规则会在 Cursor AI 开发过程中自动应用，确保代码质量和一致性。

---

## 📚 规则分类

### 🎯 核心规则（必读）

#### 1. **基础开发规范** - `bases.mdc`
- 技术栈：TypeScript, React, Vite, MobX, Vitest
- 函数式编程原则
- 错误处理和边界情况
- ⭐ 已更新：反映 shadcn/ui + Tailwind CSS 新技术栈

#### 2. **技术栈指南** - `tech-stack-guide.mdc`
- 项目技术选型详解
- 样式系统共存策略
- 工具链配置
- ⭐ 已更新：新增样式系统迁移路径

#### 3. **React 风格指南** - `react-style-guide.mdc`
- 组件开发模式
- 样式系统选择决策树
- 状态管理最佳实践
- 性能优化技巧
- ⭐ 已更新：新旧样式系统分离

---

### 🎨 样式系统规则

#### 4. **shadcn/ui + Tailwind 指南** - `shadcn-tailwind-guide.mdc` ⭐ 新增
- **用于**：所有新组件开发
- shadcn/ui 组件使用规范
- Tailwind CSS 工具类最佳实践
- Figma 设计稿转换规范
- 与 MobX、i18n 集成

#### 5. **Ant Design 系统规范** - `antd-design-system.mdc`
- **用于**：现有组件维护（维护模式）
- Flex 组件强制使用规则
- 颜色 token 使用规范
- MagicIcon 集成规范

#### 6. **Figma 转 UI 规范** - `figma-shadcn-ui-generate.mdc`
- Figma 设计稿 1:1 还原流程
- 设计令牌映射
- 响应式实现标准

---

### 🏗️ 开发规范

#### 7. **代码组织规范** - `code-organization.mdc`
- 自动重构建议
- 目录结构规范
- 文件命名检查
- 导出文件生成

#### 8. **项目结构指南** - `project-structure.mdc`
- 文件夹组织原则
- 命名约定
- 模块划分策略

#### 9. **Git 工作流** - `git-workflow.mdc`
- 分支管理策略
- 提交规范
- PR 流程

---

### 🧪 测试和质量

#### 10. **测试和代码质量指南** - `testing-guide.mdc` ⭐ 新增（合并）
- 代码质量检测规范
- 单元测试规范（Vitest + React Testing Library）
- AAA 测试模式
- Mock 外部依赖
- 测试覆盖率要求（≥ 80%）
- 完整测试示例

---

### 🌐 国际化

#### 11. **国际化规范** - `internationalization.mdc` ⭐ 已更新（合并）
- 完整的 i18n 开发规范
- 文件结构和命名空间
- 翻译键组织规范
- 快速参考卡片（已合并）
- 常用翻译键速查

---

### 🔧 专项规则

#### 12. **API 开发规范** - `api-standards.mdc`
- 统一的请求响应格式
- 错误处理机制
- 类型安全的 API 封装
- React Hook 集成

#### 13. **性能优化规范** - `performance-optimization.mdc`
- 代码分割策略
- 懒加载最佳实践
- 内存管理和优化
- 渲染性能优化

#### 14. **安全规范** - `security-standards.mdc`
- XSS 和 CSRF 防护
- 敏感数据处理
- 权限控制系统
- 安全监控和审计

#### 15. **移动端响应式** - `mobile-responsive.mdc`
- 响应式断点标准
- 触摸交互优化
- 移动端组件设计
- PWA 功能支持

#### 16. **MobX 开发指南** - `mobx-development-guide.mdc`
- Store 设计模式
- Action 和 Computed
- 性能优化
- 最佳实践

#### 17. **版本管理** - `version-management.mdc`
- 商业版与开源版代码管理
- 目录结构划分
- 功能差异控制

---

### 🛠️ 工具类规则

#### 18. **单元测试指令** - `instruct-ut.mdc`
- 自动生成单元测试 todo list
- 按顺序执行测试生成

---

## ⚠️ 已废弃的规则（请勿使用）

以下规则文件已废弃，请勿参考：

| 文件名 | 废弃原因 | 替代方案 |
|--------|---------|---------|
| `typescript-javascript-rules.mdc` | 与 `bases.mdc` 完全重复 | 使用 `bases.mdc` |
| `todo-development-guide.mdc` | 业务特定，不具通用性 | 移至业务文档 |
| `figma-to-code.mdc` | 内容过时，使用旧技术栈 | 使用 `figma-shadcn-ui-generate.mdc` |
| `component-development-guide.mdc` | 内容已整合 | 使用 `react-style-guide.mdc` |
| `i18n-quick-reference.md` | 已合并到主文件 | 使用 `internationalization.mdc` |
| `code-assurance-testing.mdc` | 已合并 | 使用 `testing-guide.mdc` |
| `spec-for-ut.mdc` | 已合并 | 使用 `testing-guide.mdc` |
| `ddd-design-guide.mdc` | 过于理论化 | （可选）简化后整合 |

---

## 🚀 快速开始

### 新项目/新组件开发
```
1. 阅读：bases.mdc + tech-stack-guide.mdc
2. 样式：shadcn-tailwind-guide.mdc
3. 测试：testing-guide.mdc
4. 国际化：internationalization.mdc
```

### 维护现有组件
```
1. 阅读：bases.mdc + react-style-guide.mdc
2. 样式：antd-design-system.mdc（维护模式）
3. 测试：testing-guide.mdc
```

### Figma 设计稿转代码
```
1. 阅读：figma-shadcn-ui-generate.mdc
2. 使用：shadcn-tailwind-guide.mdc
3. 测试：testing-guide.mdc
```

---

## 📊 规则优先级

规则按以下优先级应用：

1. **Critical** - 安全规范、测试规范、核心架构原则
2. **High** - 性能优化、API 规范、样式系统、移动端适配
3. **Medium** - 组件开发、代码组织、国际化
4. **Low** - 文档规范、工具链配置

---

## 🔄 最近更新

### 2024-11 重大优化 ⭐

#### 新增规则
- ✅ **shadcn-tailwind-guide.mdc** - 新样式系统完整指南
- ✅ **testing-guide.mdc** - 整合测试和代码质量规范

#### 更新规则
- ✅ **AGENTS.md** - 更新架构快照和实施标准
- ✅ **bases.mdc** - 反映新样式系统（shadcn/ui + Tailwind）
- ✅ **tech-stack-guide.mdc** - 新增样式系统共存策略
- ✅ **react-style-guide.mdc** - 新增样式系统选择指南
- ✅ **internationalization.mdc** - 合并快速参考卡片

#### 标记维护模式
- ⚠️ **antd-design-system.mdc** - 仅用于现有组件维护

#### 规则优化
- 🗑️ 标记 8 个废弃规则
- 📦 合并 3 组重复规则
- 📉 规则数量从 26 个优化到 19 个（减少 27%）

---

## 📖 规则使用方式

### 1. 自动应用
在 Cursor 中编写代码时，相关规则会自动应用，AI 助手会根据上下文选择合适的规则进行代码建议。

### 2. 手动引用
可以通过以下方式手动引用特定规则：
```
@rule-name
@.cursor/rules/rule-name.mdc
```

### 3. 规则组合
某些复杂场景可能需要组合多个规则：
```
@shadcn-tailwind-guide @testing-guide @internationalization
```

---

## 💡 开发建议

### 样式系统选择决策树

```
开发新组件？
├─ 是 → 使用 shadcn/ui + Tailwind CSS
│       └─ 参考：shadcn-tailwind-guide.mdc
└─ 否 → 维护现有组件
        └─ 使用 antd-style
            └─ 参考：antd-design-system.mdc
```

### 测试要求

- **核心组件**: 测试覆盖率 ≥ 80%
- **工具函数**: 测试覆盖率 ≥ 90%
- **业务逻辑**: 测试覆盖率 ≥ 85%

### 国际化要求

- **所有用户可见文本必须使用翻译键**
- 同时更新 `zh_CN` 和 `en_US` 语言包
- 使用 `useTranslation` Hook

---

## 🤝 贡献指南

### 新增规则原则
1. **通用性** - 规则应该具有通用性，避免业务特定
2. **唯一性** - 避免创建内容重复的规则
3. **实用性** - 规则应该有实际应用价值，不要过于理论化
4. **时效性** - 及时更新过时的规则以反映技术栈变化

### 规则命名规范
- 使用清晰的描述性名称
- 采用一致的命名模式（`*-guide.mdc`, `*-standards.mdc`）
- 避免使用业务术语

### 规则更新流程
1. 编辑对应的规则文件
2. 更新本 README 文件中的相关描述
3. 确保规则之间的一致性
4. 运行 linter 检查

---

## ❓ 常见问题

### Q: 如何选择样式系统？
**A**: 新组件使用 shadcn/ui + Tailwind CSS，现有组件保持 antd-style。绝不混用。

### Q: 测试文件放在哪里？
**A**: 放在组件目录下的 `__tests__/` 文件夹中，与源文件同级。

### Q: 如何处理国际化？
**A**: 使用 `useTranslation` Hook，所有用户可见文本都必须使用翻译键。

### Q: 规则冲突怎么办？
**A**: 优先级高的规则优先。如有疑问，参考 `AGENTS.md`。

---

## 📞 获取帮助

- 查看对应规则文件的详细说明
- 参考项目内的示例代码
- 在团队中讨论最佳实践

---

## 📈 统计信息

| 指标 | 数值 |
|------|------|
| 总规则数 | 19 个（活跃） |
| 废弃规则 | 8 个 |
| 最近更新 | 2024-11 |
| 覆盖领域 | 样式、测试、国际化、性能、安全、架构 |
| 优化程度 | 减少 27% |

---

> 💡 **提示**: 在开发过程中遇到问题时，优先查看相关规则。如果规则不够完善，欢迎提出改进建议！
>
> 🎯 **重要**: 新组件请务必使用 shadcn/ui + Tailwind CSS 技术栈！
