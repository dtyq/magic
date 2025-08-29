# Componente MagicSegmented 🎨

Il componente MagicSegmented è un controller segmentato migliorato basato su Ant Design Segmented, che offre stili e effetti interattivi più belli. ✨

## Caratteristiche Funzionali 🚀

-   **Design Arrotondato** 🔄: Fornisce di default uno stile con angoli arrotondati, più moderno e accattivante
-   **Stili Personalizzati** 🌙: Adattato alla modalità scura, per un'esperienza visiva unificata
-   **Facilità d'Uso** 🛠️: Mantiene la stessa API di Ant Design Segmented
-   **Compatibilità Completa** ✅: Supporta tutte le proprietà e funzionalità di Ant Design Segmented

## Installazione 📦

```bash
# Già incluso in @dtyq/magic-ui, non richiede installazione separata
```

## Uso Base 📖

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["Giornaliero", "Settimanale", "Mensile"]} defaultValue="Giornaliero" />
}
```

## Gestione dei Cambiamenti di Opzione 🔄

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"
import { useState } from "react"

const App = () => {
	const [value, setValue] = useState("Giornaliero")

	const handleChange = (newValue) => {
		setValue(newValue)
		console.log("Selezionato corrente:", newValue)
	}

	return (
		<MagicSegmented options={["Giornaliero", "Settimanale", "Mensile"]} value={value} onChange={handleChange} />
	)
}
```

## Opzioni di Tipo Oggetto 📋

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return (
		<MagicSegmented
			options={[
				{ label: "Opzione Uno", value: "option1" },
				{ label: "Opzione Due", value: "option2" },
				{ label: "Opzione Tre", value: "option3" },
			]}
			defaultValue="option1"
		/>
	)
}
```

## Opzioni con Icone 🖼️

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"
import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons"

const App = () => {
	return (
		<MagicSegmented
			options={[
				{
					value: "list",
					icon: <BarsOutlined />,
					label: "Lista",
				},
				{
					value: "grid",
					icon: <AppstoreOutlined />,
					label: "Griglia",
				},
			]}
		/>
	)
}
```

## Design Non Arrotondato 🔲

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["Opzione Uno", "Opzione Due", "Opzione Tre"]} circle={false} />
}
```

## Stato Disabilitato 🚫

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["Opzione Uno", "Opzione Due", "Opzione Tre"]} disabled={true} />
}
```

## Descrizione delle Proprietà 📋

Il componente MagicSegmented eredita tutte le proprietà del componente Ant Design Segmented e aggiunge le seguenti proprietà:

| Nome Proprietà | Tipo    | Valore Predefinito | Descrizione         |
| -------------- | ------- | ------------------ | ------------------- |
| circle         | boolean | true               | Se usare il design arrotondato |

Proprietà principali ereditate:

| Nome Proprietà | Tipo                                                                                                               | Valore Predefinito | Descrizione                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------- |
| options        | string[] \| number[] \| Array<{ label: ReactNode; value: string \| number; icon?: ReactNode; disabled?: boolean }> | []                 | Configura ogni Segmented Item |
| defaultValue   | string \| number                                                                                                   | -                  | Valore selezionato di default |
| value          | string \| number                                                                                                   | -                  | Valore attualmente selezionato |
| onChange       | (value: string \| number) => void                                                                                  | -                  | Funzione di callback per i cambiamenti di opzione |
| disabled       | boolean                                                                                                            | false              | Se disabilitare              |
| block          | boolean                                                                                                            | false              | Regola la larghezza alla larghezza dell'elemento padre |
| size           | 'large' \| 'middle' \| 'small'                                                                                     | 'middle'           | Dimensione del controllo     |

Per più proprietà, consulta la [documentazione di Ant Design Segmented](https://ant.design/components/segmented-cn/).

## Note Importanti ⚠️

1. MagicSegmented usa di default il design arrotondato, può essere impostato a angoli squadrati tramite la proprietà `circle`
2. Questo componente ha ottimizzazioni di stile speciali in modalità scura, senza bisogno di configurazioni aggiuntive
3. Quando necessario combinare con altri componenti, si raccomanda di usare opzioni di tipo oggetto per una gestione più facile dello stato

## Testo Originale (Cinese) 📜

# MagicSegmented 组件

MagicSegmented 是一个基于 Ant Design Segmented 的增强分段控制器组件，提供了更美观的样式和交互效果。

## 功能特性

-   **圆角设计**：默认提供圆形边角样式，更现代美观
-   **自定义样式**：适配暗色模式，提供统一的视觉体验
-   **简单易用**：保持与 Ant Design Segmented 相同的 API
-   **完全兼容**：支持所有 Ant Design Segmented 的属性和功能

## 安装

```bash
# 已包含在 @dtyq/magic-ui 中，无需单独安装
```

## 基本用法

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["每日", "每周", "每月"]} defaultValue="每日" />
}
```

## 处理选项变化

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"
import { useState } from "react"

const App = () => {
	const [value, setValue] = useState("每日")

	const handleChange = (newValue) => {
		setValue(newValue)
		console.log("当前选中:", newValue)
	}

	return (
		<MagicSegmented options={["每日", "每周", "每月"]} value={value} onChange={handleChange} />
	)
}
```

## 对象类型选项

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return (
		<MagicSegmented
			options={[
				{ label: "选项一", value: "option1" },
				{ label: "选项二", value: "option2" },
				{ label: "选项三", value: "option3" },
			]}
			defaultValue="option1"
		/>
	)
}
```

## 带图标的选项

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"
import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons"

const App = () => {
	return (
		<MagicSegmented
			options={[
				{
					value: "list",
					icon: <BarsOutlined />,
					label: "列表",
				},
				{
					value: "grid",
					icon: <AppstoreOutlined />,
					label: "网格",
				},
			]}
		/>
	)
}
```

## 非圆角设计

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["选项一", "选项二", "选项三"]} circle={false} />
}
```

## 禁用状态

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["选项一", "选项二", "选项三"]} disabled={true} />
}
```

## 属性说明

MagicSegmented 组件继承了 Ant Design Segmented 组件的所有属性，并添加了以下属性：

| 属性名称 | 类型    | 默认值 | 描述             |
| -------- | ------- | ------ | ---------------- |
| circle   | boolean | true   | 是否使用圆角设计 |

继承的主要属性包括：

| 属性名称     | 类型                                                                                                               | 默认值   | 描述                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------- |
| options      | string[] \| number[] \| Array<{ label: ReactNode; value: string \| number; icon?: ReactNode; disabled?: boolean }> | []       | 配置每一个 Segmented Item |
| defaultValue | string \| number                                                                                                   | -        | 默认选中的值              |
| value        | string \| number                                                                                                   | -        | 当前选中的值              |
| onChange     | (value: string \| number) => void                                                                                  | -        | 选项变化时的回调函数      |
| disabled     | boolean                                                                                                            | false    | 是否禁用                  |
| block        | boolean                                                                                                            | false    | 将宽度调整为父元素宽度    |
| size         | 'large' \| 'middle' \| 'small'                                                                                     | 'middle' | 控件大小                  |

更多属性请参考 [Ant Design Segmented 文档](https://ant.design/components/segmented-cn/)。

## 注意事项

1. MagicSegmented 默认使用圆角设计，可以通过 `circle` 属性设置为方角
2. 该组件在暗黑模式下有特殊的样式优化，无需额外配置
3. 当需要与其他组件配合使用时，推荐使用对象类型的选项，便于管理状态
