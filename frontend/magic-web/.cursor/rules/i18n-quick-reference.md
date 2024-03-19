# 国际化快速参考卡片

## 🚀 快速开始

```typescript
// 1. 导入 hook
import { useTranslation } from "react-i18next"

// 2. 在组件中使用
const Component = () => {
  const { t } = useTranslation("interface")
  return <div>{t("key.path")}</div>
}
```

## 📝 翻译键添加流程

1. **中文语言包** (`src/opensource/assets/locales/zh_CN/interface.json`)
```json
{
  "componentName": {
    "title": "标题",
    "button": {
      "save": "保存"
    }
  }
}
```

2. **英文语言包** (`src/opensource/assets/locales/en_US/interface.json`)
```json
{
  "componentName": {
    "title": "Title", 
    "button": {
      "save": "Save"
    }
  }
}
```

## 🎯 常用翻译键

```typescript
// 通用按钮
t("button.save")        // 保存
t("button.cancel")      // 取消  
t("button.confirm")     // 确认
t("button.delete")      // 删除
t("sider.logout")       // 退出登录

// 状态文本
t("spin.loading")       // 加载中...
t("button.send")        // 发送
t("button.edit")        // 编辑
```

## 🌐 语言切换支持

```typescript
import { useGlobalLanguage, useSupportLanguageOptions } from "@/opensource/models/config/hooks"

const Component = () => {
  const currentLanguage = useGlobalLanguage(true)
  const languageOptions = useSupportLanguageOptions()
  
  const currentLanguageDisplay = useMemo(() => {
    const langOption = languageOptions.find(option => option.value === currentLanguage)
    return langOption?.label || currentLanguage
  }, [currentLanguage, languageOptions])
}
```

## ✅ 检查清单

- [ ] 导入 `useTranslation("interface")`
- [ ] 替换所有硬编码文本为 `t("key")`
- [ ] 在中文语言包添加翻译
- [ ] 在英文语言包添加对应翻译
- [ ] 确保翻译键结构一致
- [ ] 测试语言切换功能

## ❌ 常见错误

```typescript
// ❌ 硬编码文本
<button>保存</button>

// ❌ 在渲染循环中调用
{items.map(item => <div>{useTranslation().t("key")}</div>)}

// ❌ 翻译键不一致
// zh_CN: "button.save"
// en_US: "btn.save"  // 错误！
```

## ✅ 正确做法

```typescript
// ✅ 使用翻译键
const { t } = useTranslation("interface")
<button>{t("button.save")}</button>

// ✅ 在组件顶层获取翻译
const Component = () => {
  const { t } = useTranslation("interface")
  const items = useMemo(() => [
    { label: t("menu.home"), key: "home" }
  ], [t])
}

// ✅ 翻译键保持一致
// zh_CN: "button.save": "保存"
// en_US: "button.save": "Save"
```

## 🔧 实用工具

```typescript
// 数字本地化
const formattedNumber = number.toLocaleString()

// 日期本地化  
const formattedDate = date.toLocaleDateString()

// 缺失翻译检测
const text = t("key", { defaultValue: "Missing translation" })
```

## 📚 参考案例

查看 `GlobalSidebar` 组件的完整国际化实现：
- 位置：`src/opensource/layouts/BaseLayoutMobile/components/GlobalSidebar/`
- 翻译键：`sider.globalSidebar.*`

---

**记住**: 任何用户可见的文本都必须使用翻译键！ 