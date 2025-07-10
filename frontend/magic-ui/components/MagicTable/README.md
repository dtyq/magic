# MagicTable 魔法表格组件

`MagicTable` 是一个基于 Ant Design Table 组件的增强版表格，提供了更好的加载状态、滚动行为和样式优化。

## 属性

| 属性名        | 类型                                                   | 默认值               | 说明                             |
| ------------- | ------------------------------------------------------ | -------------------- | -------------------------------- |
| loading       | boolean \| SpinProps                                   | false                | 表格加载状态                     |
| scroll        | { x?: number \| string \| true; y?: number \| string } | { x: 'max-content' } | 表格滚动配置                     |
| ...TableProps | -                                                      | -                    | 支持所有 Ant Design Table 的属性 |

## 基础用法

```tsx
import { MagicTable } from '@/components/base/MagicTable';
import type { ColumnsType } from 'antd/es/table';

// 定义数据类型
interface DataType {
  key: string;
  name: string;
  age: number;
  address: string;
}

// 定义列
const columns: ColumnsType<DataType> = [
  {
    title: '姓名',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '年龄',
    dataIndex: 'age',
    key: 'age',
  },
  {
    title: '地址',
    dataIndex: 'address',
    key: 'address',
  },
];

// 定义数据
const data: DataType[] = [
  {
    key: '1',
    name: '张三',
    age: 32,
    address: '北京市朝阳区',
  },
  {
    key: '2',
    name: '李四',
    age: 42,
    address: '上海市浦东新区',
  },
];

// 基础用法
<MagicTable columns={columns} dataSource={data} />

// 加载状态
<MagicTable loading columns={columns} dataSource={data} />

// 固定高度滚动
<MagicTable
  scroll={{ y: 300 }}
  columns={columns}
  dataSource={data}
/>

// 行点击事件
<MagicTable
  columns={columns}
  dataSource={data}
  onRow={(record) => ({
    onClick: () => console.log('点击了行:', record),
  })}
/>
```

## 特点

1. **优化的加载状态**：使用 MagicSpin 组件提供更美观的加载效果
2. **自动处理滚动**：默认设置 x 滚动为 'max-content'，避免表格内容挤压
3. **行点击样式**：为表格行添加了指针样式，提示用户可点击
4. **空状态优化**：在加载状态下隐藏空状态提示，避免闪烁
5. **灵活的高度控制**：可以通过 scroll.y 属性控制表格的固定高度

## 何时使用

-   需要展示大量结构化数据时
-   需要对数据进行排序、筛选、分页等操作时
-   需要表格有更好的加载状态展示时
-   需要表格内容可滚动时
-   需要行可点击时

MagicTable 组件让你的表格展示更加美观和易用，同时保持了 Ant Design Table 的所有强大功能。
