# 多集群登录上下文

## 概述

`ClusterProvider` 是一个React上下文提供者，用于管理多集群环境下的登录状态和集群配置。它提供了在不同集群环境之间切换的能力，确保应用程序能够无缝连接到正确的服务后端。

## 功能特性

-   管理当前活跃的集群代码（`clusterCode`）
-   在集群变更时提供回调机制
-   自动同步集群配置信息
-   支持集群环境之间的切换
-   在用户登录后自动获取并设置相应的集群配置

## 组件结构

```
ClusterProvider/
├── ClusterProvider.tsx       # 主要Provider组件
├── ClusterConfigSyncProvider.tsx  # 集群配置同步组件
├── cluster.context.store.ts  # Mobx状态管理
├── hooks/
│   └── useClusterCode.ts     # 自定义Hook，用于组件访问集群代码
└── index.ts                  # 导出文件
```

## 使用方法

### 1. 在应用程序根组件中包装

```tsx
import { ClusterProvider } from "@/opensource/providers/ClusterProvider"

function App() {
	const handleClusterChange = (clusterCode: string) => {
		// 当集群变更时执行必要的操作，例如切换API基础URL
		apiClient.setBaseURL(env("API_BASE_URL", false, clusterCode))
	}

	return (
		<ClusterProvider onClusterChange={handleClusterChange}>
			{/* 应用程序其他组件 */}
		</ClusterProvider>
	)
}
```

### 2. 在组件中使用集群代码

```tsx
import { useClusterCode } from "@/opensource/providers/ClusterProvider"

function MyComponent() {
  const { clusterCode, setClusterCode } = useClusterCode()

  // 使用当前集群代码
  useEffect(() => {
    if (clusterCode) {
      // 执行依赖集群的操作
    }
  }, [clusterCode])

  // 切换到另一个集群
  const switchCluster = (newClusterCode: string) => {
    setClusterCode(newClusterCode)
  }

  return (/* 组件内容 */)
}
```

## 工作原理

1. `ClusterProvider` 创建一个Mobx状态存储，用于管理集群代码
2. 提供 `onClusterChange` 回调，当集群代码变更时触发
3. `ClusterConfigSyncProvider` 在用户登录后自动同步集群配置
4. 使用 `useClusterCode` Hook获取和设置当前集群代码

## 与登录流程的集成

在用户成功登录后，`ClusterConfigSyncProvider` 组件会自动：

1. 从后端API获取用户的集群配置信息
2. 设置当前活跃的集群代码
3. 触发 `onClusterChange` 回调，使应用程序可以响应集群变化

## 多集群切换

当用户需要在不同集群之间切换时，可以通过 `setClusterCode` 函数更改当前集群。这会触发以下流程：

1. 更新内部状态存储中的集群代码
2. 通知所有使用 `useClusterCode` 的组件
3. 触发 `onClusterChange` 回调，允许应用程序响应变化（例如切换API端点）

## 注意事项

-   确保在正确的位置初始化 `ClusterProvider`，通常是在应用程序的根组件
-   提供适当的 `onClusterChange` 处理函数以响应集群变化
-   集群代码状态在应用程序重启后会丢失，除非手动实现持久化
