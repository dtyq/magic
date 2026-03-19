# AssistantPopup 助理详情弹窗组件

基于 Figma 设计实现的移动端助理详情弹窗组件，完美还原设计稿的视觉效果和交互体验。

## 功能特性

- 🎨 **完美还原设计**：严格按照 Figma 设计稿实现，包括颜色、字体、间距等细节
- 📱 **移动端优化**：基于 MagicPopup 组件，提供流畅的移动端弹窗体验
- 🏷️ **标签展示**：支持多个标签的展示，自动换行布局
- 📊 **统计信息**：展示好评数和使用量统计
- 🎯 **智能按钮状态**：根据助理是否已添加显示不同的按钮状态和文案
- 🔄 **状态适配**：支持"仅添加助理"/"已添加助理"和"添加并发起会话"/"发起会话"的状态切换
- ♿ **无障碍支持**：提供完整的键盘导航和屏幕阅读器支持

## 属性接口

```typescript
interface AssistantData {
  id: string
  name: string
  description: string
  avatar: string
  tags: string[]
  stats: {
    likes: number
    usage: number
  }
}

interface AssistantPopupProps {
  visible: boolean
  onClose: () => void
  assistant?: AssistantData
  isAdded?: boolean // 是否已添加助理
  onAddAssistant?: (assistantId: string) => void
  onStartConversation?: (assistantId: string) => void
}
```

## 基础用法

```tsx
import AssistantPopup from '@/opensource/pages/exploreMobile/components/AssistantPopup'

const ExamplePage = () => {
  const [visible, setVisible] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  
  const assistantData = {
    id: 'amazon-copywriter',
    name: '亚马逊清单文案撰稿员',
    description: '一位经验丰富的亚马逊清单文案撰稿员，擅长为产品撰写具有优化关键词的、富有说服力的亚马逊清单。作为一名专家，我深知亚马逊清单对于产品销售的重要性。因此，我致力于使用关键词优化技巧，精心编写引人注目的文案，以吸引潜在买家的注意力。',
    avatar: '/path/to/avatar.jpg',
    tags: ['撰稿', '搜索引擎优化', '关键词'],
    stats: {
      likes: 1008,
      usage: 9999
    }
  }

  const handleAddAssistant = (assistantId: string) => {
    console.log('添加助理:', assistantId)
    setIsAdded(true)
    // 处理添加助理逻辑
  }

  const handleStartConversation = (assistantId: string) => {
    console.log('发起会话:', assistantId)
    // 处理发起会话逻辑
  }

  return (
    <>
      <button onClick={() => setVisible(true)}>
        显示助理详情
      </button>
      
      <AssistantPopup
        visible={visible}
        onClose={() => setVisible(false)}
        assistant={assistantData}
        isAdded={isAdded}
        onAddAssistant={handleAddAssistant}
        onStartConversation={handleStartConversation}
      />
    </>
  )
}
```

## 设计规范

### 颜色规范
- 主背景：`#FFFFFF`
- 头像背景：`#FFECCC`
- 标签背景：`rgba(240, 177, 20, 0.15)`
- 标签文字：`#803F00`
- 统计背景：`#F9F9F9`
- 主按钮：`#315CEC`

### 字体规范
- 标题：PingFang SC, 600, 16px
- 描述：PingFang SC, 400, 12px
- 标签：PingFang SC, 400, 10px
- 统计：PingFang SC, 600, 12px
- 按钮：PingFang SC, 400, 14px

### 间距规范
- 容器内边距：20px
- 元素间距：12px
- 标签间距：4px
- 按钮间距：8px

## 按钮状态说明

### 未添加状态 (isAdded = false)
- **第一个按钮**：显示"仅添加 AI助理"，白色背景，可点击
- **第二个按钮**：显示"添加并发起会话"，蓝色背景，可点击

### 已添加状态 (isAdded = true)  
- **第一个按钮**：显示"已添加 AI助理"，灰色背景，禁用状态
- **第二个按钮**：显示"发起会话"，白色背景，可点击

## 注意事项

1. **数据格式**：确保传入的 assistant 数据格式正确
2. **图片资源**：avatar 字段应提供有效的图片 URL
3. **数字格式化**：组件会自动格式化大数字（如 1000+ 显示为 1K+）
4. **回调处理**：onAddAssistant 和 onStartConversation 为可选回调
5. **状态管理**：isAdded 状态需要父组件管理，用于控制按钮显示
6. **移动端适配**：组件已针对移动端进行优化，无需额外适配

## 依赖组件

- `MagicPopup` - 基础弹窗组件
- `MagicTag` - 标签组件  
- `MagicButton` - 按钮组件
- `MagicIcon` - 图标组件
- `Flex` - Antd 布局组件 