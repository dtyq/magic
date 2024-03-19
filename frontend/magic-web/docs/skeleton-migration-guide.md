# 骨架屏迁移指南

## 概述

本文档说明如何将路由骨架屏从 `FallbackManager` 系统迁移到 `routeSketchMap` 系统，并创建对应的 lazy 文件。

> **状态更新**：所有路由骨架屏已完成迁移，`FallbackManager` 系统已废弃。本文档保留作为历史参考和未来迁移的指南。

## 两种骨架屏系统对比

### 1. FallbackManager 系统（旧系统）

**用途**：路由懒加载时的 fallback，用于 Suspense 边界

**特点**：

- 使用同步导入的组件
- 直接渲染 JSX 元素
- 类型：`ReactNode`
- 文件位置：`src/routes/fallbackManager/components/`
- 命名规范：`{PageName}Skeleton.tsx`

**使用场景**：适用于需要快速响应的移动端页面骨架屏

**示例**：

```typescript
// src/routes/fallbackManager/index.tsx
FallbackManager.registerBatch({
  [RouteName.SuperMagicNavigate]: {
    mobile: <SuperMagicNavigateSkeleton />,
  },
})

// src/routes/routes.tsx
element: FallbackManager.wrap(
  <SuperMagicMobileNavigate />,
  RouteName.SuperMagicNavigate,
)
```

### 2. routeSketchMap 系统（新系统）

**用途**：BaseLayout 的 Sketch 组件，用于页面加载时的骨架屏展示

**特点**：

- 使用 `lazy()` 动态导入组件
- 支持桌面端和移动端分别配置
- 类型：`React.LazyExoticComponent<() => JSX.Element>`
- 文件位置：`src/opensource/pages/superMagic/lazy/skeleton/`
- 命名规范：`{PageName}{Desktop|Mobile}Skeleton.tsx`

**使用场景**：适用于需要统一管理的桌面端和移动端骨架屏

**示例**：

```typescript
// src/layouts/BaseLayout/components/Sketch/routeSketchMap.ts
export const routeSketchMap: RouteSketchMap = {
  [RouteName.SuperMagicNavigate]: {
    mobile: lazy(
      () =>
        import(
          "@/opensource/pages/superMagic/lazy/skeleton/SuperMagicNavigateMobileSkeleton"
        ),
    ),
  },
}
```

## 迁移步骤

### 步骤 1：创建骨架屏组件文件

在对应领域的 `lazy/skeleton/` 目录下创建新的骨架屏组件文件。

**文件位置**：根据页面所属领域确定，例如：

- `src/opensource/pages/superMagic/lazy/skeleton/` - 超级麦吉相关页面
- `src/opensource/pages/{domain}/lazy/skeleton/` - 其他领域页面

**文件命名**：

- 移动端：`{PageName}MobileSkeleton.tsx`
- 桌面端：`{PageName}DesktopSkeleton.tsx`

**示例**：`SuperMagicNavigateMobileSkeleton.tsx`

```typescript
import { Skeleton } from "@/routes/fallbackManager/components/common/Skeleton"
import { NavBarSkeleton } from "@/routes/fallbackManager/components/common/NavBarSkeleton"
import { SkeletonSafeAreaWrapper } from "@/routes/fallbackManager/components/common/SkeletonSafeAreaWrapper"

/**
 * SuperMagicNavigate 移动端骨架屏组件
 * 对应页面: src/opensource/pages/superMagicMobile/pages/navigate/index.tsx
 */
export default function SuperMagicNavigateMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper topStyle={{ backgroundColor: "#f5f5f5" }}>
			{/* 骨架屏内容 */}
		</SkeletonSafeAreaWrapper>
	)
}
```

**注意事项**：

- 使用 `export default` 导出，因为会被 `lazy()` 导入
- 可以复用 `fallbackManager/components/common/` 下的公共组件
- 保持与原骨架屏组件相同的结构和样式

### 步骤 2：创建 lazy 文件

在对应领域的 `lazy/` 目录下创建对应的 lazy 文件。

**文件位置**：根据页面所属领域确定，**重要：lazy 文件必须放在与页面文件相同的目录层级下**：

- `src/opensource/pages/{domain}/lazy/` - 如果页面在 `src/opensource/pages/{domain}/`
- `src/pages/{domain}/lazy/` - 如果页面在 `src/pages/{domain}/`（非 opensource 目录）

**示例**：
- 页面 `src/opensource/pages/contacts/index.tsx` → lazy 文件 `src/opensource/pages/contacts/lazy/Contacts.tsx`
- 页面 `src/pages/contacts/organization.tsx` → lazy 文件 `src/pages/contacts/lazy/ContactsOrganization.tsx`

**文件命名**：`{PageName}.tsx`

**示例**：`SuperMagicNavigate.tsx`

```typescript
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import SuperMagicNavigateMobileSkeleton from "./skeleton/SuperMagicNavigateMobileSkeleton"

const SuperMagicNavigateMobile = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/navigate"),
)

function SuperMagicNavigate() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<SuperMagicNavigateMobileSkeleton />}>
				<SuperMagicNavigateMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return null
}

export default SuperMagicNavigate
```

**模板结构**：

```typescript
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import { PageName }MobileSkeleton from "./skeleton/{PageName}MobileSkeleton"
// 如果有桌面端，添加：
// import { PageName }DesktopSkeleton from "./skeleton/{PageName}DesktopSkeleton"

const {PageName}Mobile = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/{pagePath}"),
)
// 如果有桌面端，添加：
// const {PageName}Desktop = lazy(
// 	() => import("@/opensource/pages/superMagic/pages/{PageName}/index.desktop"),
// )

function {PageName}() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<{PageName}MobileSkeleton />}>
				<{PageName}Mobile />
			</Suspense>
		)
	}

	// 桌面端处理
	return (
		<Suspense fallback={<{PageName}DesktopSkeleton />}>
			<{PageName}Desktop />
		</Suspense>
	)
}

export default {PageName}
```

### 步骤 3：更新 routeSketchMap 配置

在 `src/layouts/BaseLayout/components/Sketch/routeSketchMap.ts` 中添加路由配置。

```typescript
import { lazy } from "react"
import { RouteName } from "@/routes/constants"

export const routeSketchMap: RouteSketchMap = {
	// ... 其他路由配置
	[RouteName.SuperMagicNavigate]: {
		mobile: lazy(
			() =>
				import(
					"@/opensource/pages/superMagic/lazy/skeleton/SuperMagicNavigateMobileSkeleton"
				),
		),
		// 如果有桌面端，添加：
		// desktop: lazy(
		// 	() =>
		// 		import(
		// 			"@/opensource/pages/superMagic/lazy/skeleton/SuperMagicNavigateDesktopSkeleton"
		// 		),
		// ),
	},
}
```

**注意事项**：

- 路径根据实际骨架屏文件位置调整，不同领域可能在不同目录
- 确保导入路径正确，使用 `@/` 别名
- **重要**：如果页面文件在非 opensource 目录（如 `src/pages/`），骨架屏和 lazy 文件也应该放在对应的非 opensource 目录下

### 步骤 4：更新路由配置

在 `src/routes/routes.tsx` 中更新路由配置。

**修改前**：

```typescript
const SuperMagicMobileNavigate = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/navigate"),
)

// ...

{
	name: RouteName.SuperMagicNavigate,
	path: `/:clusterCode${RoutePathMobile.SuperMagicNavigate}`,
	element: FallbackManager.wrap(
		<SuperMagicMobileNavigate />,
		RouteName.SuperMagicNavigate,
	),
}
```

**修改后**：

```typescript
// 使用 lazy() 导入 lazy 文件
const SuperMagicNavigate = lazy(
	() => import("@/opensource/pages/superMagic/lazy/SuperMagicNavigate"),
)

// ...

{
	name: RouteName.SuperMagicNavigate,
	path: `/:clusterCode${RoutePathMobile.SuperMagicNavigate}`,
	element: <SuperMagicNavigate />,
}
```

**注意事项**：

- 移除 `FallbackManager.wrap` 调用
- 移除 `Suspense` 导入（如果不再需要）
- **使用 `lazy()` 导入 lazy 文件**，确保路由级别的代码分割
- 导入路径改为指向对应领域的 lazy 文件
- **重要**：确保 lazy 文件的路径与页面文件所在目录层级一致（opensource 或非 opensource）

### 步骤 5：清理旧代码

1. **从 FallbackManager 中移除配置**

在 `src/routes/fallbackManager/index.tsx` 中移除相关配置：

```typescript
// 移除导入
// import { SuperMagicNavigateSkeleton } from "./components/SuperMagicNavigateSkeleton"

// 移除注册
FallbackManager.registerBatch({
	// 移除这一项
	// [RouteName.SuperMagicNavigate]: {
	// 	mobile: <SuperMagicNavigateSkeleton />,
	// },
	// ... 其他配置
})
```

2. **删除旧文件**（可选）

如果确认不再需要，可以删除：

- `src/routes/fallbackManager/components/SuperMagicNavigateSkeleton.tsx`

3. **更新文档**

如果存在相关文档（如 README），更新迁移说明。

## 完整迁移示例

### 示例：SuperMagicNavigate 迁移

#### 1. 创建骨架屏组件

**文件**：`src/opensource/pages/superMagic/lazy/skeleton/SuperMagicNavigateMobileSkeleton.tsx`

```typescript
import { Skeleton } from "@/routes/fallbackManager/components/common/Skeleton"
import { NavBarSkeleton } from "@/routes/fallbackManager/components/common/NavBarSkeleton"
import { SkeletonSafeAreaWrapper } from "@/routes/fallbackManager/components/common/SkeletonSafeAreaWrapper"

export default function SuperMagicNavigateMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper topStyle={{ backgroundColor: "#f5f5f5" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#f5f5f5",
				}}
			>
				<NavBarSkeleton titleWidth="35%" />
				{/* 其他骨架屏内容 */}
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
```

#### 2. 创建 lazy 文件

**文件**：`src/opensource/pages/superMagic/lazy/SuperMagicNavigate.tsx`

```typescript
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import SuperMagicNavigateMobileSkeleton from "./skeleton/SuperMagicNavigateMobileSkeleton"

const SuperMagicNavigateMobile = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/navigate"),
)

function SuperMagicNavigate() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<SuperMagicNavigateMobileSkeleton />}>
				<SuperMagicNavigateMobile />
			</Suspense>
		)
	}

	return null
}

export default SuperMagicNavigate
```

#### 3. 更新 routeSketchMap

**文件**：`src/layouts/BaseLayout/components/Sketch/routeSketchMap.ts`

```typescript
[RouteName.SuperMagicNavigate]: {
	mobile: lazy(
		() =>
			import(
				"@/opensource/pages/superMagic/lazy/skeleton/SuperMagicNavigateMobileSkeleton"
			),
	),
}
```

#### 4. 更新路由配置

**文件**：`src/routes/routes.tsx`

```typescript
// 修改导入 - 使用 lazy() 导入
const SuperMagicNavigate = lazy(
	() => import("@/opensource/pages/superMagic/lazy/SuperMagicNavigate"),
)

// 修改路由配置
{
	name: RouteName.SuperMagicNavigate,
	path: `/:clusterCode${RoutePathMobile.SuperMagicNavigate}`,
	element: <SuperMagicNavigate />,
}
```

#### 5. 清理旧代码

**文件**：`src/routes/fallbackManager/index.tsx`

```typescript
// 移除导入和注册配置
```

### 示例：ContactsOrganization 迁移（非 opensource 页面）

当页面文件位于非 opensource 目录时，需要注意目录层级的一致性。

#### 1. 创建骨架屏组件

**文件**：`src/pages/contacts/lazy/skeleton/ContactsOrganizationMobileSkeleton.tsx`

```typescript
import { NavBarSkeleton } from "@/routes/fallbackManager/components/common/NavBarSkeleton"
import { ListItemSkeleton } from "@/routes/fallbackManager/components/common/ListItemSkeleton"
import { SkeletonSafeAreaWrapper } from "@/routes/fallbackManager/components/common/SkeletonSafeAreaWrapper"

export default function ContactsOrganizationMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper topStyle={{ backgroundColor: "#ffffff" }}>
			{/* 骨架屏内容 */}
		</SkeletonSafeAreaWrapper>
	)
}
```

#### 2. 创建 lazy 文件

**文件**：`src/pages/contacts/lazy/ContactsOrganization.tsx`

**重要**：注意页面文件在 `src/pages/contacts/organization.tsx`（非 opensource），所以 lazy 文件应该在 `src/pages/contacts/lazy/` 目录下。

```typescript
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ContactsOrganizationMobileSkeleton from "./skeleton/ContactsOrganizationMobileSkeleton"

const ContactsOrganizationPage = lazy(() => import("@/pages/contacts/organization"))

function ContactsOrganization() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ContactsOrganizationMobileSkeleton />}>
				<ContactsOrganizationPage />
			</Suspense>
		)
	}

	// Desktop version handled by ContactsOrganizationPage itself
	return (
		<Suspense fallback={null}>
			<ContactsOrganizationPage />
		</Suspense>
	)
}

export default ContactsOrganization
```

#### 3. 更新 routeSketchMap

**文件**：`src/layouts/BaseLayout/components/Sketch/routeSketchMap.ts`

```typescript
[RouteName.ContactsOrganization]: {
	mobile: lazy(
		() =>
			import(
				"@/pages/contacts/lazy/skeleton/ContactsOrganizationMobileSkeleton"
			),
	),
}
```

**注意**：路径指向 `@/pages/contacts/lazy/skeleton/`（非 opensource 目录）

#### 4. 更新路由配置

**文件**：`src/routes/routes.tsx`

```typescript
// 使用 lazy() 导入 lazy 文件
const ContactsOrganization = lazy(() => import("@/pages/contacts/lazy/ContactsOrganization"))

// 修改路由配置
{
	name: RouteName.ContactsOrganization,
	path: `/:clusterCode${RoutePath.ContactsOrganization}`,
	element: <ContactsOrganization />,
}
```

**关键点**：
- 页面文件：`src/pages/contacts/organization.tsx`（非 opensource）
- lazy 文件：`src/pages/contacts/lazy/ContactsOrganization.tsx`（与页面文件在同一目录层级）
- 骨架屏：`src/pages/contacts/lazy/skeleton/ContactsOrganizationMobileSkeleton.tsx`

## 迁移检查清单

- [ ] 创建骨架屏组件文件（`{PageName}{Mobile|Desktop}Skeleton.tsx`）
- [ ] 骨架屏组件使用 `export default` 导出
- [ ] 创建 lazy 文件（`{PageName}.tsx`）
- [ ] lazy 文件中处理移动端和桌面端的懒加载逻辑
- [ ] 在 `routeSketchMap.ts` 中添加路由配置
- [ ] 在 `routes.tsx` 中更新导入和路由配置
- [ ] 从 `FallbackManager` 中移除旧配置
- [ ] 删除旧的骨架屏文件（如果存在）
- [ ] 运行 `pnpm lint` 检查代码规范
- [ ] 运行 `pnpm test` 确保功能正常
- [ ] 测试移动端和桌面端的骨架屏显示

## 注意事项

1. **导出方式**：骨架屏组件必须使用 `export default`，因为会被 `lazy()` 导入
2. **文件路径**：确保导入路径正确，使用 `@/` 别名
3. **目录层级一致性**：**重要** - lazy 文件和骨架屏文件必须放在与页面文件相同的目录层级下：
   - 如果页面在 `src/opensource/pages/{domain}/`，lazy 文件应在 `src/opensource/pages/{domain}/lazy/`
   - 如果页面在 `src/pages/{domain}/`（非 opensource），lazy 文件应在 `src/pages/{domain}/lazy/`
   - 错误示例：页面在 `src/pages/contacts/organization.tsx`，但 lazy 文件放在 `src/opensource/pages/contacts/lazy/` ❌
   - 正确示例：页面在 `src/pages/contacts/organization.tsx`，lazy 文件放在 `src/pages/contacts/lazy/` ✅
4. **类型安全**：确保所有类型定义正确，TypeScript 编译通过
5. **代码复用**：可以复用 `fallbackManager/components/common/` 下的公共组件
6. **测试验证**：迁移后务必测试骨架屏的显示和页面加载流程
7. **向后兼容**：如果其他路由还在使用 `FallbackManager`，不要删除公共组件

## 参考文件

- `src/opensource/pages/superMagic/lazy/WorkspacePage.tsx` - lazy 文件示例
- `src/opensource/pages/superMagic/lazy/TopicPage.tsx` - lazy 文件示例
- `src/opensource/pages/superMagic/lazy/ProjectPage.tsx` - lazy 文件示例
- `src/layouts/BaseLayout/components/Sketch/routeSketchMap.ts` - 路由配置示例
- `src/routes/fallbackManager/index.tsx` - 旧系统示例

## 常见问题

### Q: 为什么需要创建 lazy 文件？

A: 为了将懒加载逻辑封装在对应的领域内，保持代码组织清晰，便于维护。

### Q: 骨架屏组件必须使用 export default 吗？

A: 是的，因为 `lazy()` 需要默认导出。

### Q: 可以同时使用两种系统吗？

A: 可以，但建议统一迁移到新系统，避免维护两套代码。

### Q: 桌面端骨架屏如何处理？

A: 如果页面有桌面端版本，在 lazy 文件中添加桌面端的懒加载逻辑，并在 `routeSketchMap` 中添加 `desktop` 配置。

### Q: 如果页面文件在非 opensource 目录（如 `src/pages/`），lazy 文件应该放在哪里？

A: lazy 文件必须放在与页面文件相同的目录层级下。例如：
- 页面 `src/pages/contacts/organization.tsx` → lazy 文件 `src/pages/contacts/lazy/ContactsOrganization.tsx`
- 页面 `src/opensource/pages/contacts/index.tsx` → lazy 文件 `src/opensource/pages/contacts/lazy/Contacts.tsx`

**重要**：不要将非 opensource 页面的 lazy 文件放在 opensource 目录下，这会导致路径不一致的问题。

## 相关文档

- [骨架屏生成器指南](./skeleton-generator-guide.md)
- [代码组织规则](../.cursor/rules/code-organization)
