# @dtyq/magic-admin

Magic Admin 是一个面向企业管理后台的 React + Antd 组件库和路由管理方案，提供了完整的管理后台解决方案。

## 📦 安装

```bash
# 使用 pnpm
pnpm add @dtyq/magic-admin

# 使用 npm
npm install @dtyq/magic-admin

# 使用 yarn
yarn add @dtyq/magic-admin
```

## 本地开发

### 克隆项目

```bash
git clone <repository-url>
cd magic-admin
```

### 安装依赖

```bash
pnpm install
```

### 配置本地开发环境

本地开发需要配置测试环境的配置信息。配置分为两层：

1. **基础配置** (`src/apis/config.ts`) - 包含测试数据（Token、用户信息、组织信息、服务地址等）
2. **开发配置** (`src/main.tsx`) - 基于基础配置，添加应用级配置（语言、主题、API 客户端等）

#### 第一步：配置基础数据 (`src/apis/config.ts`)

**1. 用户 Token**

```typescript
// 默认用户 Token
const defaultUserToken = "your-test-token"
```

用于本地开发的测试用户身份令牌，需要从测试环境获取有效的 JWT Token。

**2. 组织代码**

```typescript
// Magic 默认组织 Code
const organizationCode = ""
// Teamshare 默认组织 Code
const teamshareOrganizationCode = ""
```

配置测试组织的代码标识。

**3. 服务地址**

```typescript
// Magic 基础 URL
const BASE_URL = ""
// Teamshare 基础 URL
const TeamshareBaseUrl = ""
// Teamshare 网页 URL
const TeamshareWebUrl = ""
// Keewood 基础 URL
const KeewoodBaseUrl = ""
```

各个服务的 API 地址，根据实际环境（测试/预发布/生产）进行配置。

**4. config 对象结构**

导出的 `config` 对象包含：

-   `user`: 用户信息（token、userInfo、teamshareUserInfo）
-   `organization`: 组织信息（代码、organizationInfo、teamshareOrganizationInfo）
-   `services`: 各服务的 URL 配置
-   `areaCodes`: 支持的国家/地区电话区号配置

#### 第二步：使用配置 (`src/main.tsx`)

在 `main.tsx` 中，基于 `config` 创建完整的 `localDevConfig`：

```typescript
import defaultConfig from "./apis/config"
import magicClient from "@/apis/clients/magic"
import teamshareClient from "@/apis/clients/teamshare"
import keewoodClient from "@/apis/clients/keewood"
import { LanguageType, ThemeType } from "components"
import { AppEnv } from "./provider/AdminProvider/types"

// 本地开发配置
export const localDevConfig = {
	language: LanguageType.ZH_CN, // 语言设置
	theme: ThemeType.LIGHT, // 主题设置
	apiClients: {
		// API 客户端实例
		magicClient,
		teamshareClient,
		keewoodClient,
	},
	clusterCode: "global", // 集群代码
	basePath: "/admin", // 基础路径
	isPersonalOrganization: false, // 是否个人组织
	isPrivateDeployment: false, // 是否私有化部署
	organization: defaultConfig.organization, // 复用基础配置的组织信息
	user: defaultConfig.user, // 复用基础配置的用户信息
	env: {
		// 环境变量配置
		MAGIC_APP_ENV: AppEnv.Test,
		MAGIC_BASE_URL: defaultConfig.services.base_url,
	},
	areaCodes: defaultConfig.areaCodes, // 复用基础配置的区号
}
```

#### 第三步：传递给 AdminProvider

```typescript
function AppWithNavigate() {
	const navigate = useNavigate()

	const config = useMemo(() => {
		return {
			navigate,
			...localDevConfig,
		}
	}, [navigate])

	return (
		<AdminProvider {...config}>
			<App />
		</AdminProvider>
	)
}
```

#### 配置说明总结

**配置层级：**

```
src/apis/config.ts (基础配置)
    ↓ 导出 defaultConfig
src/main.tsx (开发配置)
    ↓ 创建 localDevConfig
AdminProvider (应用配置)
    ↓ 注入 navigate，传递完整配置
```

**修改配置时：**

-   修改测试数据（Token、用户、组织）→ 编辑 `src/apis/config.ts`
-   修改应用设置（语言、主题、路径）→ 编辑 `src/main.tsx` 中的 `localDevConfig`

> ⚠️ **安全提示**:
>
> -   `src/apis/config.ts` 仅用于本地开发测试
> -   请勿将真实的 Token 和敏感信息提交到代码仓库
> -   生产环境应通过环境变量或配置中心动态获取配置
> -   建议将 `config.ts` 添加到 `.gitignore` 或使用 `.env` 文件管理敏感信息

### 启动开发服务器

```bash
# 启动开发模式
pnpm dev
```

开发服务器将在 `http://localhost:5173` 启动（端口可能会有所不同）。

### 构建项目

```bash

# 构建 npm 包
pnpm build:npm

# 生成类型定义
pnpm types
```

### 本地测试包（使用 yalc）

```bash
# 构建并推送到本地 yalc 仓库
pnpm yalc
```

然后在需要测试的项目中：

```bash
# 安装本地包
yalc add @dtyq/magic-admin

# 更新本地包
yalc update @dtyq/magic-admin

# 移除本地包
yalc remove @dtyq/magic-admin
```

## 📁 项目目录结构

```
magic-admin/
├── components/              # 组件库
│   ├── AdminComponentsProvider/  # 组件配置提供者
│   ├── BaseLayout/              # 基础布局
│   ├── ButtonGroup/             # 按钮组
│   ├── ConfigCard/              # 配置卡片
│   ├── DetailDrawer/            # 详情抽屉
│   ├── Magic*/                  # Magic 系列组件（表单、表格、模态框等）
│   ├── MobileList/              # 移动端列表
│   ├── TableWithFilters/        # 带筛选的表格
│   ├── ThemeProvider/           # 主题提供者
│   └── ...                      # 更多组件
├── src/                     # 源代码
│   ├── apis/                # API 接口
│   ├── hooks/               # React Hooks
│   ├── layouts/             # 布局组件
│   ├── pages/               # 页面模块
│   │   ├── AiManage/        # AI 管理
│   │   ├── CapabilityManage/    # 能力管理
│   │   ├── EnterpriseManage/    # 企业管理
│   │   ├── PlatformPackage/     # 平台套餐
│   │   └── SecurityControl/     # 安全控制
│   ├── provider/            # Provider 配置
│   ├── routes/              # 路由配置
│   ├── stores/              # 状态管理
│   ├── utils/               # 工具函数
│   └── index.ts             # 入口文件
└── types/                   # TypeScript 类型定义
```

## 🚀 快速开始

### 1. 配置 Provider

在你的应用根组件中配置 `AdminProvider`：

```tsx
import { AdminProvider, type AdminProviderProps } from "@dtyq/magic-admin"
import { useNavigate } from "react-router-dom"

function MagicAdminProvider({ children }) {
	const config: AdminProviderProps = {
		// 语言配置
		language: "zh_CN", // 或 'en_US'

		// 主题配置
		theme: "light", // 或 'dark'

		// API 客户端配置
		apiClients: {
			magicClient: magicClient as any,
			teamshareClient: teamshareClient as any,
			keewoodClient: keewoodClient as any,
		},

		// 集群代码
		clusterCode: "your-cluster-code",

		// 基础路径
		basePath: "/admin",

		// 组织信息
		isPersonalOrganization: false,
		isPrivateDeployment: isPrivateDeployment(),

		organization: {
			organizationCode: "your-org-code",
			teamshareOrganizationCode: "your-ts-org-code",
			organizationInfo: organizationInfo,
			teamshareOrganizationInfo: teamshareOrganizationInfo ?? null,
		},

		// 用户信息
		user: {
			token: "your-authorization-token",
			userInfo: userInfo
				? {
						id: currentTsUserId,
						...userInfo,
				  }
				: null,
			teamshareUserInfo: teamshareUserInfo ?? null,
		},

		// 环境配置
		env: {
			MAGIC_APP_ENV: "production", // 'development' | 'staging' | 'production'
			MAGIC_BASE_URL: "https://your-api.com",
			TEAMSHARE_SERVICE_URL: "https://teamshare-api.com",
			KEEWOOD_SERVICE_URL: "https://keewood-api.com",
		},

		// 区号配置
		areaCodes: ["+86", "+1", "+44"],

		// 路由导航
		navigate: useNavigate(),

		// 安全区域配置（移动端）
		safeAreaInset: {
			top: 0,
			bottom: 0,
		},
	}

	return <AdminProvider {...config}>{children}</AdminProvider>
}
```

### 2. 配置路由

在你的路由配置中引入并使用 magic-admin 的路由：

```tsx
import { lazy } from "react"
import type { RouteObject } from "react-router"
import {
	CapabilityManageRoutes,
	PlatformPackageRoutes,
	SecurityControlRoutes,
	EnterpriseManageRoutes,
	otherRoutes,
	RouteName,
} from "@dtyq/magic-admin"

const BaseLayout = lazy(() => import("@/pages/magicAdmin/layouts/BaseLayout"))
const RouteGuard = lazy(() => import("@/pages/magicAdmin/RouteGuard"))

const routes: RouteObject[] = [
	{
		name: RouteName.Admin,
		path: "/admin",
		element: <BaseLayout />,
		children: [
			{
				index: true,
				name: RouteName.AdminEnterpriseOrganization,
				element: <Navigate name={RouteName.AdminEnterpriseOrganization} replace />,
			},
			// 引入 magic-admin 的路由模块
			CapabilityManageRoutes, // 能力管理路由
			PlatformPackageRoutes, // 平台套餐路由
			SecurityControlRoutes, // 安全控制路由
			EnterpriseManageRoutes, // 企业管理路由
			...otherRoutes, // 其他路由
		],
	},
]

export default routes
```

### 3. 创建 BaseLayout

将 `AdminProvider` 包裹在你的布局组件外层：

```tsx
import { memo } from "react"
import { MagicAdminProvider } from "./index"

const BaseLayout = memo(() => {
	useRegister()
	const isMobile = useIsMobile()

	return isMobile ? <BaseLayoutMobile /> : <BaseLayoutPcObserver />
})

const BaseLayoutWithProvider = () => {
	return (
		<MagicAdminProvider>
			<BaseLayout />
		</MagicAdminProvider>
	)
}

export default BaseLayoutWithProvider
```

## 📚 主要功能模块

### 路由模块

-   **CapabilityManageRoutes** - 能力管理（应用管理、审批流程、表单配置等）
-   **PlatformPackageRoutes** - 平台套餐管理
-   **SecurityControlRoutes** - 安全控制（权限管理、日志审计等）
-   **EnterpriseManageRoutes** - 企业管理（组织架构、成员管理等）
-   **otherRoutes** - 其他通用路由

### 核心组件

#### Magic 系列组件

-   `MagicButton` - 按钮组件
-   `MagicForm` - 表单组件
-   `MagicTable` - 表格组件
-   `MagicModal` - 模态框组件
-   `MagicInput` - 输入框组件
-   `MagicSelect` - 选择器组件
-   `MagicDatePicker` - 日期选择器
-   更多组件...

#### 业务组件

-   `TableWithFilters` - 带筛选功能的表格
-   `MemberDepartmentSelector` - 成员部门选择器
-   `UserSelect` - 用户选择器
-   `StatusTag` - 状态标签
-   `WarningModal` - 警告弹窗

### Hooks

```tsx
import { useAdmin, useRegister } from "@dtyq/magic-admin"

// 获取全局配置
const { language, theme, user, organization, env } = useAdmin()

// 注册逻辑
useRegister()
```

### 工具函数

```tsx
import { findRouteByPathname, checkItemPermission } from "@dtyq/magic-admin"

// 根据路径名查找路由
const route = findRouteByPathname("/admin/capability")

// 检查权限
const hasPermission = checkItemPermission(permissions, isSuperAdmin)
```

## 🎨 主题定制

magic-admin 支持亮色和暗色主题，通过 `AdminProvider` 的 `theme` 属性配置：

```tsx
<AdminProvider theme="dark" {...otherProps}>
	{children}
</AdminProvider>
```

## 🌍 国际化

支持中文和英文两种语言：

```tsx
<AdminProvider language="zh_CN" {...otherProps}>
  {children}
</AdminProvider>

// 或
<AdminProvider language="en_US" {...otherProps}>
  {children}
</AdminProvider>
```

## 📱 移动端支持

magic-admin 提供了完整的移动端组件支持：

-   `MobileList` - 移动端列表
-   `MobileCard` - 移动端卡片
-   `MobileFilter` - 移动端筛选器
-   响应式布局自适应

## 🔧 依赖要求

### 必需依赖（peerDependencies）

-   `react` >= 17.0.0
-   `react-dom` >= 17.0.0
-   `react-router` >= 6.0.0
-   `react-router-dom` >= 6.0.0
-   `i18next` >= 23.0.0
-   `react-i18next` >= 13.0.0
-   `axios` >= 1.0.0
-   `@tabler/icons-react` >= 3.19.0
-   `@dtyq/upload-sdk` >= 0.0.9
-   `libphonenumber-js` >= 1.12.7
-   `nanoid` >= 5.1.5

## 📄 License

请查看 LICENSE 文件了解详细信息。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题，请联系 Teamshare 团队。
