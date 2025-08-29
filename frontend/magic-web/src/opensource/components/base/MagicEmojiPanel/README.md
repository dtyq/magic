# MagicEmojiPanel Componente Pannello Emoji Magico 😀

MagicEmojiPanel è un componente pannello di selezione emoji ricco di funzionalità, utilizzato per fornire funzionalità di selezione emoji nelle applicazioni. Questo componente mostra una serie di emoji cliccabili e supporta il passaggio tra diversi tipi di pannelli emoji (come emoji normali e emoji preferiti). 📱

## Proprietà

| Nome Proprietà | Tipo                       | Valore Predefinito | Descrizione                                       |
| -------------- | -------------------------- | ------------------ | ------------------------------------------------- |
| onClick        | (emoji: EmojiInfo) => void | -                  | Funzione di callback quando si clicca su un emoji, con parametro le informazioni dell'emoji selezionato |

Dove la definizione del tipo EmojiInfo è la seguente:

```typescript
export type EmojiInfo = {
	/** Codice emoji */
	code: string
	/** Namespace emoji */
	ns: string
	/** Suffisso emoji */
	suffix?: string
	/** Tonalità della pelle */
	tone?: string
	/** Dimensione emoji */
	size?: number
}
```

## Uso Base

```tsx
import MagicEmojiPanel from "@/components/base/MagicEmojiPanel"
import type { EmojiInfo } from "@/components/base/MagicEmojiPanel/types"

// Uso base
const handleEmojiClick = (emoji: EmojiInfo) => {
	console.log("Emoji selezionato:", emoji)
	// Gestisci la logica di selezione emoji
}

;<MagicEmojiPanel onClick={handleEmojiClick} />

// Utilizzo in un popover
import { Popover } from "antd"
;<Popover
	content={<MagicEmojiPanel onClick={handleEmojiClick} />}
	trigger="click"
	styles={{
		body: {
			padding: 0,
		},
	}}
>
	<Button>Apri pannello emoji</Button>
</Popover>
```

## Caratteristiche

-   **Raccolta ricca di emoji** 🎉: Emoji integrati vari per la scelta degli utenti
-   **Passaggio tra categorie** 🔄: Supporta il passaggio tra diversi tipi di pannelli emoji
-   **Interfaccia accattivante** ✨: Interfaccia progettata con cura, inclusa area di scorrimento e barra di passaggio in basso
-   **Callback personalizzato** ⚙️: Personalizza il comportamento dopo la selezione emoji tramite la proprietà onClick
-   **Layout responsivo** 📐: Emoji disposti in griglia, adattabili a contenitori di dimensioni diverse

## Scenari d'Uso

-   Selettore emoji in app di chat 💬
-   Input emoji nell'area commenti dei social media 📱
-   Funzione di inserimento emoji in editor di testo ricchi ✏️
-   Qualsiasi scenario interattivo che richieda la selezione di emoji da parte degli utenti

Il componente MagicEmojiPanel fornisce una soluzione completa per la selezione di emoji, facilmente integrabile in varie applicazioni che necessitano di funzionalità di input emoji, migliorando l'esperienza utente e il divertimento interattivo. 🚀

## Testo Originale
# MagicEmojiPanel 魔法表情面板组件

MagicEmojiPanel 是一个功能丰富的表情选择面板组件，用于在应用中提供表情选择功能。该组件展示了一系列可点击的表情，并支持切换不同类型的表情面板（如普通表情和喜欢表情）。

## 属性

| 属性名  | 类型                       | 默认值 | 描述                                       |
| ------- | -------------------------- | ------ | ------------------------------------------ |
| onClick | (emoji: EmojiInfo) => void | -      | 点击表情时的回调函数，参数为所选表情的信息 |

其中 EmojiInfo 的类型定义如下：

```typescript
export type EmojiInfo = {
	/** 表情 code */
	code: string
	/** 表情命名空间 */
	ns: string
	/** 表情后缀 */
	suffix?: string
	/** 肤色 */
	tone?: string
	/** 表情大小 */
	size?: number
}
```

## 基本用法

```tsx
import MagicEmojiPanel from "@/components/base/MagicEmojiPanel"
import type { EmojiInfo } from "@/components/base/MagicEmojiPanel/types"

// 基本用法
const handleEmojiClick = (emoji: EmojiInfo) => {
	console.log("选择了表情:", emoji)
	// 处理表情选择逻辑
}

;<MagicEmojiPanel onClick={handleEmojiClick} />

// 在弹出框中使用
import { Popover } from "antd"
;<Popover
	content={<MagicEmojiPanel onClick={handleEmojiClick} />}
	trigger="click"
	styles={{
		body: {
			padding: 0,
		},
	}}
>
	<Button>打开表情面板</Button>
</Popover>
```

## 特性

-   **丰富的表情集合**：内置多种表情供用户选择
-   **分类切换**：支持在不同类型的表情面板之间切换
-   **美观的界面**：精心设计的界面，包括滚动区域和底部切换栏
-   **自定义回调**：通过 onClick 属性自定义表情选择后的行为
-   **响应式布局**：表情以网格形式排列，适应不同尺寸的容器

## 使用场景

-   聊天应用中的表情选择器
-   社交媒体评论区的表情输入
-   富文本编辑器中的表情插入功能
-   任何需要用户选择表情的交互场景

MagicEmojiPanel 组件提供了一个完整的表情选择解决方案，可以轻松集成到各种需要表情输入功能的应用中，提升用户体验和交互乐趣。
