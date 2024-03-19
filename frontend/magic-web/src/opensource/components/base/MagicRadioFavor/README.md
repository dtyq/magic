# MagicRadioFavor 魔法单选组件

MagicRadioFavor 是一个自定义样式的单选按钮组件，专为收藏夹和偏好设置等场景设计。该组件提供了一组可选项，用户可以从中选择一个选项，组件会以特殊的样式显示当前选中的选项。

## 属性

| 属性名        | 类型                               | 默认值 | 描述                                      |
| ------------- | ---------------------------------- | ------ | ----------------------------------------- |
| options       | { label: string; value: string }[] | []     | 可选项列表，每项包含标签和值              |
| onChange      | (value: string) => void            | -      | 选项变更时的回调函数                      |
| selectedValue | string                             | -      | 当前选中的值                              |
| value         | string                             | -      | 当前选中的值（与 selectedValue 作用相同） |

## 基本用法

```tsx
import MagicRadioFavor from '@/components/base/MagicRadioFavor';

// 基本用法
const options = [
  { label: '选项一', value: 'option1' },
  { label: '选项二', value: 'option2' },
  { label: '选项三', value: 'option3' },
];

const [selected, setSelected] = useState('option1');

<MagicRadioFavor
  options={options}
  selectedValue={selected}
  onChange={(value) => setSelected(value)}
/>

// 使用 value 属性
<MagicRadioFavor
  options={options}
  value={selected}
  onChange={(value) => setSelected(value)}
/>
```

## 特性

-   **自定义样式**：区别于传统的单选按钮，提供更现代化的外观
-   **简单易用**：API 设计简洁，使用方便
-   **灵活配置**：支持自定义选项列表
-   **状态管理**：内部维护选中状态，也可通过外部控制
-   **响应式设计**：适应不同尺寸的容器

## 使用场景

-   收藏夹中的分类选择
-   用户偏好设置中的选项选择
-   筛选条件的单选场景
-   任何需要用户从多个选项中选择一个的交互场景

MagicRadioFavor 组件提供了一种视觉上更吸引人的单选方式，特别适合在需要强调用户选择的界面中使用，如收藏夹、偏好设置等场景。
