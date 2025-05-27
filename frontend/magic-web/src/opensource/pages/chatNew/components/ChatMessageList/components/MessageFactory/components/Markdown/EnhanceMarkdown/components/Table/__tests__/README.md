# Table 组件单元测试

## 测试文件概览

### 📁 测试文件结构
```
__tests__/
├── useTableI18n.test.tsx       # 国际化 hook 测试
├── TableCell.test.tsx          # 表格单元格组件测试
├── RowDetailDrawer.test.tsx    # 行详细抽屉组件测试
├── TableWrapper.test.tsx       # 表格包装器组件测试
├── styles.test.tsx             # 样式 hook 测试
├── index.test.tsx              # 集成测试
└── README.md                   # 测试说明文档
```

## 🧪 测试覆盖范围

### useTableI18n Hook 测试
- ✅ 返回正确的翻译文本
- ✅ 包含所有必需的翻译键
- ✅ 返回字符串类型的翻译值

### TableCell 组件测试
- ✅ 渲染普通表格数据单元格
- ✅ 渲染表头单元格
- ✅ 处理短文本内容
- ✅ 长文本包装器功能
- ✅ 长文本点击展开功能
- ✅ 自动文本对齐（左对齐、右对齐、居中对齐）
- ✅ 处理数组形式的子元素
- ✅ 保持空格和特殊字符样式
- ✅ 处理空内容

### RowDetailDrawer 组件测试
- ✅ 根据 visible 状态控制渲染
- ✅ 使用默认标题
- ✅ 正确渲染表单项
- ✅ 处理缺失的数据
- ✅ onClose 回调函数调用
- ✅ 处理空的 headers 数组
- ✅ 处理 React 节点作为值
- ✅ 优先使用索引键获取数据

### TableWrapper 组件测试
- ✅ 渲染基本表格结构
- ✅ 列数限制功能（≤6列不显示更多按钮）
- ✅ 超过6列显示"显示更多"按钮
- ✅ 正确限制显示的列数
- ✅ 点击"显示更多"打开抽屉
- ✅ 抽屉显示完整行数据
- ✅ 不同行数据正确显示
- ✅ 抽屉关闭功能
- ✅ 处理没有 thead 的表格
- ✅ 处理没有 tbody 的表格
- ✅ 应用正确的 CSS 类
- ✅ 复杂表格结构数据提取

### useTableStyles Hook 测试
- ✅ 返回样式对象
- ✅ 包含所有必需的样式类
- ✅ cx 函数正确合并类名
- ✅ 返回正确的类型

### 集成测试
- ✅ 正确导出所有组件和 hooks
- ✅ TableWrapper 和 TableCell 协同工作
- ✅ 完整表格功能流程
- ✅ TableCell 长文本功能
- ✅ 国际化 hook 功能
- ✅ 样式 hook 功能
- ✅ RowDetailDrawer 独立功能
- ✅ 空 props 支持
- ✅ 复杂表格结构完整测试

## 🎯 核心功能测试

### 1. 列数限制与展开功能
测试表格在超过6列时自动隐藏多余列，并提供"显示更多"按钮来查看完整数据。

### 2. 长文本处理
测试 TableCell 组件对超长文本的智能处理，包括自动检测、点击展开等功能。

### 3. 智能文本对齐
测试根据内容自动判断文本对齐方式（左对齐、右对齐、居中对齐）的功能。

### 4. 国际化支持
测试所有用户可见文本的国际化翻译功能。

### 5. 响应式设计
测试移动端适配和响应式布局功能。

### 6. 样式系统
测试 antd-style 的 CSS-in-JS 样式系统集成。

## 🚀 运行测试

```bash
# 运行所有表格组件测试
npm test -- Table

# 运行特定测试文件
npm test -- TableWrapper.test.tsx

# 运行测试并生成覆盖率报告
npm test -- --coverage Table
```

## 📊 测试数据

### Mock 数据示例
- **简单表格**: 3列2行的基础数据
- **复杂表格**: 8列多行的完整数据
- **长文本**: 超过50字符的测试文本
- **特殊符号**: 数学符号和特殊字符
- **React 节点**: JSX 元素作为单元格内容

### Mock 组件
- **antd 组件**: Drawer、Form.Item
- **react-i18next**: useTranslation hook
- **antd-style**: createStyles function
- **样式系统**: 完整的样式类和 cx 函数

## ✨ 最佳实践

### 1. 组件隔离测试
每个组件都有独立的测试文件，确保测试的独立性和可维护性。

### 2. Mock 外部依赖
合理 mock 外部依赖（antd、react-i18next、antd-style），确保测试的稳定性。

### 3. 用户行为模拟
通过 fireEvent 模拟真实的用户交互，如点击、展开等操作。

### 4. 边界情况测试
测试空数据、缺失数据、异常数据等边界情况。

### 5. 集成测试
通过集成测试验证组件间的协同工作效果。

## 🔧 测试工具

- **Vitest**: 现代化的测试框架
- **React Testing Library**: React 组件测试库
- **@testing-library/jest-dom**: DOM 断言扩展
- **用户事件模拟**: fireEvent 和用户交互测试

这套测试覆盖了 Table 组件的所有核心功能，确保了代码质量和功能的可靠性。 