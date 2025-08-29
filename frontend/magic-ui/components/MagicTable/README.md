# MagicTable Componente Tabella Magica 📊

`MagicTable` è una versione migliorata del componente Table di Ant Design, che offre un migliore stato di caricamento, comportamento di scorrimento e ottimizzazioni di stile. ✨

## Proprietà

| Nome Proprietà | Tipo                                                   | Valore Predefinito     | Descrizione                         |
| -------------- | ------------------------------------------------------ | ---------------------- | ----------------------------------- |
| loading        | boolean \| SpinProps                                   | false                  | Stato di caricamento della tabella  |
| scroll         | { x?: number \| string \| true; y?: number \| string } | { x: 'max-content' }   | Configurazione scorrimento tabella  |
| ...TableProps  | -                                                      | -                      | Supporta tutte le proprietà di Ant Design Table |

## Uso Base

```tsx
import { MagicTable } from '@/components/base/MagicTable';
import type { ColumnsType } from 'antd/es/table';

// Definire il tipo di dati
interface DataType {
  key: string;
  name: string;
  age: number;
  address: string;
}

// Definire le colonne
const columns: ColumnsType<DataType> = [
  {
    title: 'Nome',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Età',
    dataIndex: 'age',
    key: 'age',
  },
  {
    title: 'Indirizzo',
    dataIndex: 'address',
    key: 'address',
  },
];

// Definire i dati
const data: DataType[] = [
  {
    key: '1',
    name: 'Mario Rossi',
    age: 32,
    address: 'Via Roma, Milano',
  },
  {
    key: '2',
    name: 'Luca Bianchi',
    age: 42,
    address: 'Via Garibaldi, Roma',
  },
];

// Uso base
<MagicTable columns={columns} dataSource={data} />

// Stato di caricamento
<MagicTable loading columns={columns} dataSource={data} />

// Scorrimento con altezza fissa
<MagicTable
  scroll={{ y: 300 }}
  columns={columns}
  dataSource={data}
/>

// Evento click sulla riga
<MagicTable
  columns={columns}
  dataSource={data}
  onRow={(record) => ({
    onClick: () => console.log('Cliccata la riga:', record),
  })}
/>
```

## Caratteristiche

1. **Stato di caricamento ottimizzato** 🔄: Utilizza il componente MagicSpin per un effetto di caricamento più elegante
2. **Gestione automatica dello scorrimento** 📜: Imposta per default lo scorrimento x su 'max-content' per evitare compressioni del contenuto
3. **Stile click sulle righe** 👆: Aggiunge uno stile cursore alle righe della tabella per indicare che sono cliccabili
4. **Ottimizzazione stato vuoto** 🚫: Nasconde il prompt di stato vuoto durante il caricamento per evitare sfarfallii
5. **Controllo flessibile dell'altezza** 📏: Puoi controllare l'altezza fissa della tabella tramite la proprietà scroll.y

## Quando Usare

- Quando devi mostrare grandi quantità di dati strutturati 📈
- Quando devi eseguire operazioni come ordinamento, filtraggio, paginazione 🔍
- Quando la tabella necessita di una migliore visualizzazione dello stato di caricamento ⏳
- Quando il contenuto della tabella deve essere scorrevole 📖
- Quando le righe devono essere cliccabili 🖱️

Il componente MagicTable rende la visualizzazione delle tue tabelle più elegante e user-friendly, mantenendo tutte le potenti funzionalità di Ant Design Table. 🎉

## Testo Originale (Cinese)
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
