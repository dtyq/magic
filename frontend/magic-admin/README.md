# @dtyq/magic-admin

Magic Admin Open 是一个面向企业管理后台的 React 组件库和路由管理方案，提供了完整的管理后台解决方案。

## 📦 安装

```bash
# 使用 pnpm
pnpm add @dtyq/magic-admin

# 使用 npm
npm install @dtyq/magic-admin

# 使用 yarn
yarn add @dtyq/magic-admin
```

## 💻 本地开发

### 克隆项目

```bash
git clone <repository-url>
cd magic-admin-open
```

### 安装依赖

```bash
pnpm install
```

### 配置本地开发环境

本地开发配置主要分为两层：

1. **代理配置**（`.env.*`） - 用于 Vite 开发代理
2. **运行时配置**（`src/apis/config.ts` + `src/main.tsx`） - 用于组件库运行数据

#### 第一步：配置开发代理（`.env.local`）

先基于示例文件创建本地环境变量：

```bash
cp .env.example .env.local
```

在 `.env.local` 中配置代理目标地址：

```dotenv
VITE_PROXY_API_URL=https://api.example.com
```

`vite.config.ts` 会将 `/server/*` 请求代理到 `VITE_PROXY_API_URL`。

#### 第二步：配置基础数据（`src/apis/config.ts`）

填写本地调试所需的 Token 与服务地址（使用你自己的测试环境地址）：

```typescript
const defaultToken = "<YOUR_TEST_TOKEN>"

const SassTestEnv = {
  base_url: "https://api.example.com",
  teamshare_base_url: "",
  teamshare_web_url: "",
  keewood_base_url: "",
}
```

> 建议只在本地填写必要字段，避免把真实凭证写入仓库。

#### 第三步：在入口中挂载配置（`src/main.tsx`）

当前项目中 `localDevConfig` 的核心用法如下：

```typescript
import defaultConfig from "./apis/config"
import magicClient from "@/apis/clients/magic"
import { LanguageType, ThemeType } from "components"
import { AppEnv } from "./provider/AdminProvider/types"

export const localDevConfig = {
  language: LanguageType.zh_CN,
  theme: ThemeType.LIGHT,
  apiClients: { magicClient },
  clusterCode: "global",
  basePath: "/admin",
  isPersonalOrganization: false,
  isPrivateDeployment: false,
  organization: defaultConfig.organization,
  user: defaultConfig.user,
  env: {
    MAGIC_APP_ENV: AppEnv.Test,
    MAGIC_BASE_URL: defaultConfig.services.base_url,
  },
  areaCodes: defaultConfig.areaCodes,
}
```

#### 第四步：传递给 AdminProvider

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

```text
`.env.local` (开发代理配置)
    ↓ 提供 VITE_PROXY_API_URL
vite.config.ts (开发代理)
    ↓
src/apis/config.ts (基础运行时配置)
    ↓ 导出 defaultConfig
src/main.tsx (开发配置)
    ↓ 创建 localDevConfig
AdminProvider (应用配置)
    ↓ 注入 navigate，传递完整配置
```

**修改配置时：**

-   修改代理目标地址 → 编辑 `.env.local`
-   修改测试数据（Token、用户、组织）→ 编辑 `src/apis/config.ts`
-   修改应用设置（语言、主题、路径）→ 编辑 `src/main.tsx` 中的 `localDevConfig`

> ⚠️ **安全提示**:
>
> -   `.env.local` 与 `src/apis/config.ts` 仅用于本地开发测试
> -   请勿将真实的 Token 和敏感信息提交到代码仓库
> -   生产环境应通过环境变量或配置中心动态获取配置
> -   建议使用 `.env.local` 管理本地敏感配置

### 启动开发服务器

```bash
# 启动开发模式
pnpm dev
```

开发服务器默认使用 `https://localhost:443`（端口可按需调整）。

### 构建项目

```bash

# 构建 npm 包
pnpm build

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
magic-admin-open/
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

当前仓库使用自定义商业限制许可证（`SEE LICENSE IN LICENSE`），不属于 OSI 标准开源许可证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题，请联系 Teamshare 团队。
