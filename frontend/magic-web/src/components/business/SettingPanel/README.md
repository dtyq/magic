# SettingPanel 设置面板组件

通用的设置面板组件，支持左侧菜单导航和右侧内容区域的自定义渲染。

## 特性

- ✅ 左侧固定宽度菜单，右侧自适应内容区域
- ✅ 支持菜单分组展示
- ✅ 受控模式的状态管理
- ✅ 使用 token 系统管理颜色，支持主题切换
- ✅ 函数式调用，支持命令式打开
- ✅ 支持跳转到指定页面
- ✅ 移动端响应式适配

## 基础用法

### 作为组件使用

```tsx
import { useState } from "react"
import SettingPanel from "@/opensource/components/business/SettingPanel"
import type { MenuItem } from "@/opensource/components/business/SettingPanel"

function MySettings() {
  const [activeKey, setActiveKey] = useState("account")
  
  const menuItems: MenuItem[] = [
    {
      key: "account",
      label: "我的账户",
      icon: <IconUserCircle size={16} />,
      groupTitle: "账户",
    },
    {
      key: "security",
      label: "账户安全",
      icon: <IconShieldLock size={16} />,
    },
  ]
  
  return (
    <SettingPanel
      menuItems={menuItems}
      activeKey={activeKey}
      onActiveKeyChange={setActiveKey}
      renderContent={(key) => {
        switch(key) {
          case "account": return <MyAccountPage />
          case "security": return <SecurityPage />
          default: return null
        }
      }}
      onClose={() => console.log("关闭")}
    />
  )
}
```

### 函数式调用（推荐）

```tsx
import { openSettingPanel } from "@/opensource/components/business/SettingPanel"

function MyComponent() {
  const handleOpenSettings = () => {
    const instance = openSettingPanel({
      menuItems: [
        {
          key: "account",
          label: "我的账户",
          icon: <IconUserCircle size={16} />,
          groupTitle: "账户",
        },
        {
          key: "security",
          label: "账户安全",
          icon: <IconShieldLock size={16} />,
        },
      ],
      renderContent: (key) => {
        switch(key) {
          case "account": return <MyAccountPage />
          case "security": return <SecurityPage />
          default: return null
        }
      },
      defaultActiveKey: "account", // 可选：指定默认打开的页面
      onClose: () => console.log("关闭"),
    })
    
    // 可以通过返回的实例控制面板
    // instance.close() - 关闭面板
    // instance.setActiveKey("security") - 跳转到指定页面
  }
  
  return <button onClick={handleOpenSettings}>打开设置</button>
}
```

## API

### SettingPanel Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| menuItems | `MenuItem[]` | ✅ | 菜单项配置 |
| activeKey | `string` | ✅ | 当前选中的菜单 key |
| onActiveKeyChange | `(key: string) => void` | ✅ | 菜单切换回调 |
| renderContent | `(activeKey: string) => ReactNode` | ✅ | 内容渲染函数 |
| onClose | `() => void` | ❌ | 关闭回调 |
| className | `string` | ❌ | 自定义样式类名 |
| style | `CSSProperties` | ❌ | 自定义样式 |

### MenuItem

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | `string` | ✅ | 唯一标识 |
| label | `string` | ✅ | 菜单文本 |
| icon | `ReactNode` | ❌ | 菜单图标 |
| groupTitle | `string` | ❌ | 分组标题，设置后会创建新分组 |

### openSettingPanel Options

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| menuItems | `MenuItem[]` | ✅ | 菜单项配置 |
| renderContent | `(activeKey: string) => ReactNode` | ✅ | 内容渲染函数 |
| defaultActiveKey | `string` | ❌ | 默认选中的菜单 key |
| onClose | `() => void` | ❌ | 关闭回调 |
| width | `number \| string` | ❌ | 弹窗宽度，默认 900 |
| height | `number \| string` | ❌ | 内容高度，默认 600 |
| isResponsive | `boolean` | ❌ | 是否响应式适配移动端，默认 true |

### 返回值

```typescript
{
  close: () => void           // 关闭面板
  setActiveKey: (key: string) => void  // 跳转到指定页面
}
```

## AccountSetting 使用示例

项目中已经基于 SettingPanel 实现了 AccountSetting 业务组件，提供了更简便的调用方式：

```tsx
import { openAccountSetting, AccountSettingPage } from "@/opensource/components/business/AccountSetting"

// 打开默认页面（我的账户）
openAccountSetting()

// 跳转到指定页面
openAccountSetting({
  defaultActiveKey: AccountSettingPage.ACCOUNT_SECURITY
})

// 获取实例控制
const instance = openAccountSetting()
instance.setActiveKey(AccountSettingPage.LOGIN_DEVICES)
instance.close()
```

## 最佳实践

### 1. 菜单分组

使用 `groupTitle` 来创建菜单分组，相同 groupTitle 的项会被归为一组：

```tsx
const menuItems = [
  {
    key: "account",
    label: "我的账户",
    groupTitle: "账户",  // 创建"账户"分组
  },
  {
    key: "security",
    label: "账户安全",
    // 不设置 groupTitle，归入上一个分组
  },
  {
    key: "team",
    label: "我的团队",
    groupTitle: "团队",  // 创建新的"团队"分组
  },
]
```

### 2. 国际化支持

```tsx
import { useTranslation } from "react-i18next"

function MyComponent() {
  const { t } = useTranslation("accountSetting")
  
  const menuItems = [
    {
      key: "account",
      label: t("myAccount"),
      groupTitle: t("accountGroup"),
    },
  ]
  
  // ...
}
```

### 3. 响应式适配

组件会自动适配移动端，在移动端使用 Popup 而非 Modal：

```tsx
openSettingPanel({
  // ...
  isResponsive: true,  // 默认为 true，自动适配
})
```

### 4. 程序化控制

```tsx
const instance = openSettingPanel({...})

// 在某个操作完成后跳转到下一个页面
async function handleSubmit() {
  await saveData()
  instance.setActiveKey("nextPage")
}

// 在需要时关闭面板
function handleComplete() {
  instance.close()
}
```

## 样式定制

组件使用 antd-style 和 token 系统，颜色会自动跟随主题：

```typescript
// 主要使用的 token
- token.magicColorScales.grey[0]  // 侧边栏背景（浅色）
- token.magicColorScales.grey[1]  // 侧边栏背景（暗色）
- token.colorBorder               // 边框颜色
- token.magicColorUsages.fill[0]  // 选中/悬浮背景
- token.magicColorUsages.text[1]  // 主要文本
- token.magicColorUsages.text[2]  // 次要文本
- token.magicColorUsages.text[3]  // 辅助文本
```

## 注意事项

1. **受控模式**: 组件使用受控模式，需要传入 `activeKey` 和 `onActiveKeyChange`
2. **函数式调用**: 推荐使用 `openSettingPanel` 函数式调用，更加简洁
3. **自动清理**: 当用户切换组织或账户时，会自动关闭面板
4. **移动端**: 在移动端会自动切换为 Popup 展示方式

