# OrganizationSwitch Component

移动端组织切换组件，基于 Figma 设计稿完美实现。

## 设计参考

- Figma: https://www.figma.com/design/iohkRRCI9YoavG2gajV2ZO/Magic-Mobile?node-id=486-30541

## 功能特性

- ✅ 多账号支持，显示不同平台（SaaS 平台、灯塔引擎等）
- ✅ 组织列表展示，支持选中状态
- ✅ 合作伙伴标签显示
- ✅ 未读消息数量提醒
- ✅ 账号退出功能
- ✅ 完美支持深色模式
- ✅ 响应式滚动区域
- ✅ 遵循 antd-design-system 规范

## 基本使用

```tsx
import OrganizationSwitch from "@/opensource/layouts/BaseLayoutMobile/components/GlobalSidebar/components/OrganizationSwitch"

function MyComponent() {
  const handleClose = () => {
    console.log("Organization switch closed")
  }

  return (
    <OrganizationSwitch
      onClose={handleClose}
      showCurrentAccount={true}
      showAddAccount={false}
    />
  )
}
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `onClose` | `() => void` | - | 关闭回调函数 |
| `showCurrentAccount` | `boolean` | `true` | 是否显示当前账号 |
| `showAddAccount` | `boolean` | `false` | 是否显示添加账号按钮 |
| `className` | `string` | - | 自定义样式类名 |
| `style` | `CSSProperties` | - | 自定义样式 |

## 组件架构

```
OrganizationSwitch/
├── index.tsx                    # 主组件
├── types.ts                    # TypeScript 类型定义
├── styles.ts                   # 样式文件（antd-style）
├── styles.panel.ts             # 面板样式文件
└── README.md                  # 文档
```

## 设计系统规范

### 使用 Flex 组件
```tsx
// ✅ 正确：使用 Flex 组件
<Flex align="center" justify="space-between" gap={10}>
  <span>内容</span>
</Flex>

// ❌ 错误：使用 CSS flexbox
<div style={{ display: 'flex', alignItems: 'center' }}>
  <span>内容</span>
</div>
```

### 使用 Token 颜色变量
```tsx
// ✅ 正确：使用 token 变量
color: ${token.magicColorScales?.brand?.[5]}

// ❌ 错误：硬编码颜色
color: #315cec
```

### 使用 MagicIcon 包装
```tsx
// ✅ 正确：使用 MagicIcon
<MagicIcon component={IconCheck} size={20} />

// ❌ 错误：直接使用 Tabler Icons
<IconCheck size={20} stroke={1.5} />
```

## 业务逻辑

### 组织切换
- 支持跨账号组织切换
- 自动处理账号切换逻辑
- 错误处理和状态恢复

### 数据来源
- 使用 `useAccount` Hook 获取账号列表
- 使用 `useUserInfo` Hook 获取当前用户信息
- 使用 `useClusterConfig` Hook 获取集群配置
- 使用 `getPlatformName` 工具函数获取平台名称

### 状态管理
- 使用 MobX 进行状态管理
- 支持 `observer` HOC 自动更新
- 使用 `interfaceStore` 管理切换状态

## 样式定制

所有样式都通过 `useOrganizationSwitchStyles` Hook 提供，支持：
- 深色/浅色主题自动适配
- Token 变量响应式更新
- CSS-in-JS 样式管理

## 注意事项

1. **依赖项**：确保已安装所有必需的依赖包
2. **权限**：组织切换需要相应的用户权限
3. **错误处理**：组件内置错误处理，但建议在上层也添加错误边界
4. **性能**：使用 `memo` 和 `observer` 优化渲染性能

## 更新日志

- v1.0.0: 初始版本，基于 Figma 设计完整实现 