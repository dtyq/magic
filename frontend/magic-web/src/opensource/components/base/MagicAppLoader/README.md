# MagicAppLoader 魔法应用加载器组件

`MagicAppLoader` 是一个用于加载和显示微前端应用的组件，提供了应用加载状态管理、错误处理和加载动画等功能。

## 属性

| 属性名    | 类型                 | 默认值 | 说明                              |
| --------- | -------------------- | ------ | --------------------------------- |
| appMeta   | AppMeta              | -      | 微应用元数据，包含名称、入口URL等 |
| onLoad    | () => void           | -      | 应用加载成功的回调函数            |
| onError   | (error: any) => void | -      | 应用加载失败的回调函数            |
| fallback  | ReactNode            | -      | 加载中显示的内容，默认为加载动画  |
| errorView | ReactNode            | -      | 加载失败显示的内容                |

## 基础用法

```tsx
import { MagicAppLoader } from '@/components/base/MagicAppLoader';

// 基础用法
const appMeta = {
  name: 'my-micro-app',
  entry: 'https://example.com/micro-app/',
  basename: '/my-app'
};

<MagicAppLoader
  appMeta={appMeta}
  onLoad={() => console.log('应用加载成功')}
  onError={(error) => console.error('应用加载失败', error)}
/>

// 自定义加载中和错误状态
<MagicAppLoader
  appMeta={appMeta}
  fallback={<div>正在加载应用...</div>}
  errorView={<div>应用加载失败，请刷新重试</div>}
/>

// 在布局中使用
<div style={{ width: '100%', height: '100vh' }}>
  <MagicAppLoader appMeta={appMeta} />
</div>
```

## 特点

1. **微前端支持**：专为加载微前端应用设计，支持应用间通信
2. **状态管理**：内置应用加载状态管理，自动处理加载中和错误状态
3. **优雅降级**：提供加载失败时的错误视图，增强用户体验
4. **加载动画**：内置加载动画，提供视觉反馈
5. **沙箱隔离**：支持微应用的沙箱隔离，防止应用间样式和全局变量冲突

## 何时使用

-   需要在主应用中加载微前端应用时
-   需要管理微应用的加载状态和错误处理时
-   需要在应用加载过程中提供良好的用户体验时
-   需要集成第三方应用到现有系统时
-   需要构建可扩展的微前端架构时

MagicAppLoader 组件简化了微前端应用的加载和管理过程，提供了完善的状态处理和用户体验，是构建微前端架构的理想选择。
