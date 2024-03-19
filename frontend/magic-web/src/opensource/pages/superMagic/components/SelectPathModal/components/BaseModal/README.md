# BaseModal 通用弹窗组件

## 概述

BaseModal 是 SelectPathModal 下的通用弹窗组件：桌面端基于 **shadcn Dialog**（Radix UI），移动端仍使用 CommonPopup。

## 特性

-   ✅ 桌面端使用 shadcn Dialog，样式与项目 Tailwind 体系一致
-   ✅ 移动端使用 CommonPopup（antd-mobile）
-   ✅ 支持自定义标题和提示信息
-   ✅ 可配置的搜索输入框
-   ✅ 完全自定义的内容区域
-   ✅ 灵活的底部操作区配置
-   ✅ TypeScript 类型支持

## API

### BaseModalProps

| 属性        | 类型              | 必填 | 默认值 | 描述               |
| ----------- | ----------------- | ---- | ------ | ------------------ |
| visible     | boolean           | ✅   | -      | 弹窗是否可见       |
| title       | ReactNode         | ❌   | -      | 弹窗标题           |
| tips        | ReactNode         | ❌   | -      | 标题下方的提示信息 |
| searchInput | SearchInputConfig | ❌   | -      | 搜索输入框配置     |
| content     | ReactNode         | ✅   | -      | 弹窗主要内容       |
| footer      | FooterConfig      | ❌   | -      | 底部操作区配置     |
| onClose     | () => void        | ❌   | -      | 关闭弹窗的回调     |
| width         | number            | ❌   | 720    | 弹窗宽度           |
| className     | string            | ❌   | -      | 自定义样式类名     |
| maskClosable  | boolean           | ❌   | false  | 点击遮罩是否关闭   |

### SearchInputConfig

```typescript
interface SearchInputConfig {
	value: string
	placeholder?: string
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
	onCompositionStart?: (e: React.CompositionEvent<HTMLInputElement>) => void
	onCompositionEnd?: (e: React.CompositionEvent<HTMLInputElement>) => void
}
```

### FooterConfig

```typescript
interface FooterConfig {
	leftContent?: ReactNode // 左侧内容（如创建按钮）
	okText?: string // 确认按钮文本
	cancelText?: string // 取消按钮文本
	onOk?: () => void // 确认按钮回调
	onCancel?: () => void // 取消按钮回调
	okDisabled?: boolean // 确认按钮是否禁用
}
```

## 使用示例

### 1. 基础弹窗

```tsx
import BaseModal from "./components/BaseModal"

function SimpleModal() {
	const [visible, setVisible] = useState(false)

	return (
		<BaseModal
			visible={visible}
			title="简单弹窗"
			content={<div>这是弹窗内容</div>}
			footer={{
				onOk: () => setVisible(false),
				onCancel: () => setVisible(false),
			}}
			onClose={() => setVisible(false)}
		/>
	)
}
```

### 2. 带搜索功能的弹窗

```tsx
function SearchModal() {
	const [visible, setVisible] = useState(false)
	const [searchValue, setSearchValue] = useState("")

	const searchInputConfig = {
		value: searchValue,
		placeholder: "搜索内容...",
		onChange: (e) => setSearchValue(e.target.value),
	}

	return (
		<BaseModal
			visible={visible}
			title="搜索弹窗"
			searchInput={searchInputConfig}
			content={<div>搜索结果: {searchValue}</div>}
			footer={{
				onOk: () => setVisible(false),
				onCancel: () => setVisible(false),
			}}
			onClose={() => setVisible(false)}
		/>
	)
}
```

### 3. 自定义操作按钮的弹窗

```tsx
function CustomFooterModal() {
	const [visible, setVisible] = useState(false)

	const leftContent = (
		<Button type="text" icon={<IconPlus />}>
			添加新项目
		</Button>
	)

	return (
		<BaseModal
			visible={visible}
			title="自定义底部"
			content={<div>弹窗内容</div>}
			footer={{
				leftContent,
				okText: "保存",
				cancelText: "取消",
				onOk: () => console.log("保存"),
				onCancel: () => setVisible(false),
				okDisabled: false,
			}}
			onClose={() => setVisible(false)}
		/>
	)
}
```

### 4. 带提示信息的弹窗

```tsx
function TipsModal() {
	const [visible, setVisible] = useState(false)

	return (
		<BaseModal
			visible={visible}
			title="文件选择"
			tips="请选择要操作的文件，支持多选"
			content={<div>文件列表...</div>}
			footer={{
				onOk: () => setVisible(false),
				onCancel: () => setVisible(false),
			}}
			onClose={() => setVisible(false)}
		/>
	)
}
```

## 样式定制

BaseModal 使用 `antd-style` 进行样式管理，可以通过 `className` 属性或覆盖默认样式类来自定义样式。

```tsx
<BaseModal
	className="my-custom-modal"
	// ... 其他属性
/>
```

## 与业务组件的关系

BaseModal 作为基础组件，可以被业务组件（如 SelectDirectoryModal）使用：

```tsx
// SelectDirectoryModal.tsx
import BaseModal from "../BaseModal"

function SelectDirectoryModal(props) {
	// 业务逻辑...

	const searchInputConfig = {
		value: fileName,
		placeholder: searchPlaceholder,
		onChange: searchDirectories,
		onCompositionStart,
		onCompositionEnd,
	}

	const footerConfig = {
		leftContent: createButton,
		okText: "确认",
		onOk: handleSubmit,
		onCancel: handleCancel,
		okDisabled: isLoading,
	}

	return (
		<BaseModal
			visible={props.visible}
			title={props.title}
			tips={props.tips}
			searchInput={searchInputConfig}
			content={<DirectoryContent />}
			footer={footerConfig}
			onClose={props.onClose}
		/>
	)
}
```

这种设计模式实现了 UI 层和业务逻辑层的完全分离，使得组件更加灵活和可复用。
