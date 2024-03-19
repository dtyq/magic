# Mobile User Detail Page

## 组件结构

### UserInfoDetail
主页面组件，负责：
- 页面路由和导航逻辑
- 用户信息验证
- 页面布局结构

### useMemberCardConfig
配置 Hook，提供：
- 移动端特定的样式配置
- 固定定位和布局设置
- 预设的组件选项

## 设计说明

采用**配置对象模式**而非组件封装：

### ✅ 优势
1. **避免过度抽象**：不创建不必要的组件包装层
2. **配置复用**：配置逻辑可以轻松导出和复用
3. **代码简洁**：减少文件数量，逻辑更直观
4. **符合 YAGNI 原则**：不为假想的复用性增加复杂度

### 🔄 vs 组件封装方式
- ❌ 组件封装：创建额外组件文件，抽象价值有限
- ✅ 配置对象：通过 Hook 提供配置，保持灵活性

## 使用方式

```tsx
import MemberCard from "@/opensource/components/business/MemberCard"
import { useMemberCardConfig } from "./config"

function UserDetailPage() {
  const memberCardConfig = useMemberCardConfig()
  
  return <MemberCard {...memberCardConfig} />
}

// 如需自定义
function CustomUserDetailPage() {
  const baseConfig = useMemberCardConfig()
  
  return (
    <MemberCard 
      {...baseConfig} 
      style={{ ...baseConfig.style, zIndex: 100 }} 
    />
  )
}
``` 