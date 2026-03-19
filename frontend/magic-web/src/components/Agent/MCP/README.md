# MCP (Model Context Protocol) 组件库

MCP（Model Context Protocol）是一个统一的协议，用于连接 AI 助手和外部数据源与工具。这个组件库提供了完整的 MCP 管理功能，包括选择、配置、授权和管理 MCP 服务。

## 📁 文件结构

```
MCP/
├── README.md                     # 项目文档
├── types.ts                      # 类型定义
├── index.tsx                     # 主入口文件
├── service/                      # 服务层
│   ├── MCPManagerService.ts      # MCP管理服务
│   └── MCPOAuthService.ts        # MCP OAuth服务
├── AgentCommonModal/             # 通用模态框组件
│   ├── index.tsx                 # 入口文件
│   └── AgentCommonModal.tsx      # 模态框实现
├── AgentSettings/                # 代理设置组件
│   ├── index.tsx                 # 主组件
│   ├── styles.ts                 # 样式文件
│   └── AgentPanel/               # 设置面板
│       ├── index.ts              # 面板入口
│       ├── types.ts              # 面板类型
│       ├── styles.ts             # 面板样式
│       ├── MCPPanel/             # MCP面板
│       └── ScheduledTasksPanel.tsx # 定时任务面板
├── MCPSelect/                    # MCP选择组件
│   ├── index.tsx                 # 入口文件
│   ├── MCPSelect.tsx             # 选择界面
│   ├── MCPButton.tsx             # MCP按钮
│   ├── MCPItem.tsx               # MCP项目
│   └── Empty.tsx                 # 空状态
├── MCPForm/                      # MCP表单组件
│   ├── index.tsx                 # 表单组件
│   └── styles.ts                 # 表单样式
├── MCPEditor/                    # MCP编辑器组件
│   ├── index.tsx                 # 编辑器组件
│   └── styles.ts                 # 编辑器样式
└── MCPOAuth/                     # MCP OAuth组件
    ├── index.tsx                 # OAuth组件
    └── styles.ts                 # OAuth样式
```

## 🔧 核心类型定义

### IMCPItem

```typescript
export interface IMCPItem {
	id: string // MCP唯一标识
	icon: string // MCP图标URL
	name: string // MCP名称
	enabled: boolean // 是否启用
	description: string // MCP描述
}
```

## 🚀 组件介绍

### 1. MCPManagerService - MCP 管理服务

**功能**: 提供统一的 MCP 管理接口，支持不同策略的 MCP 获取和管理。

**架构**: 使用策略模式，支持官方、组织、个人三种 MCP 类型。

**使用方法**:

```typescript
import { MCPManagerService, OfficialStrategy } from "./service/MCPManagerService"

// 创建服务实例
const service = new MCPManagerService()

// 设置策略
service.setContext(new OfficialStrategy())

// 获取MCP列表
const mcpList = await service.getMCPList()

// 设置MCP状态
await service.setMCPStatus(mcpItem)
```

**使用案例**:

-   获取官方 MCP 列表：`new OfficialStrategy()`
-   获取组织 MCP 列表：`new OrganizationStrategy()`
-   获取个人 MCP 列表：`new PersonStrategy()`

### 2. MCPOAuthService - OAuth 授权服务

**功能**: 处理 MCP 的 OAuth 授权流程，包括轮询授权状态、管理授权状态等。

**特性**:

-   支持轮询授权状态
-   自动清理资源
-   支持重启授权流程

**使用方法**:

```typescript
import { MCPOAuthService } from "./service/MCPOAuthService"

const service = new MCPOAuthService(FlowApi)

// 设置回调
service.setCallbacks({
	onSuccess: (response) => {
		console.log("授权成功", response)
	},
	onError: (error) => {
		console.error("授权失败", error)
	},
})

// 开始授权
await service.start(mcpId)

// 重启授权
service.restart(mcpId)

// 销毁服务
service.destroy()
```

**使用案例**:

-   第三方 MCP 授权配置
-   需要 OAuth 认证的 MCP 服务
-   长时间轮询的授权流程

### 2. AgentCommonModal - 通用模态框组件

**功能**: 提供可拖拽的模态框容器，用于承载各种设置组件。

**特性**:

-   支持拖拽移动
-   自动传递关闭回调
-   支持 Suspense 延迟加载

**使用方法**:

在内容组件被使用时需要继承 `AgentCommonModalChildrenProps` 类型，接收 Modal 层传递的业务方法。（比如弹窗关闭，在业务层渲染中可自定义编排视图与关闭弹窗逻辑）

```tsx
import { AgentCommonModal } from "./AgentCommonModal";


// 预想中的 dom 层级
<AgentCommonModal width={900} footer={null} closable={false} onClose={() => setOpen(false)}>
	<YourComponent />
</AgentCommonModal>

// 实际调用
// 1. 显示MCP按钮
<MCPButton />

// 2. 用户点击按钮，打开设置界面
const handleOpenSettings = () => {
	openAgentCommonModal({
		width: 900,
		footer: null,
		closable: false,
		children: <MCPButton onSuccessCallback={refresh} />,
	})
}
```

**使用案例**:

-   设置页面容器
-   复杂组件的模态框包装
-   需要拖拽功能的弹窗

## 🎯 完整使用示例

### 基础 MCP 配置流程

```tsx
// 1. 显示MCP按钮
<MCPButton />

// 2. 用户点击按钮，打开设置界面
const handleOpenSettings = () => {
	openAgentCommonModal({
		width: 900,
		footer: null,
		closable: false,
		children: <AgentSettings onSuccessCallback={refresh} />,
	})
}

// 3. 在设置界面中配置MCP
// 用户可以选择官方、组织或个人MCP
// 可以通过表单创建新的MCP
// 可以通过编辑器导入JSON配置
```

### 高级 OAuth 授权流程

```tsx
// 1. 用户选择需要授权的MCP
const handleMCPAuth = async (mcpId: string) => {
	// 2. 检查授权状态
	const data = await FlowApi.getMCPUserSettings(mcpId)

	// 3. 如果需要授权，打开OAuth组件
	if (!data?.auth_config?.is_authenticated) {
		openAgentCommonModal({
			width: 900,
			footer: null,
			closable: false,
			children: <MCPOAuth id={mcpId} />,
		})
	}
}
```

