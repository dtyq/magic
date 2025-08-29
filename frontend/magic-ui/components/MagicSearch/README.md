# MagicSearch 🔍 Componente di Ricerca Magica

`MagicSearch` è una versione semplificata del componente Input di Ant Design, che fornisce un'icona di ricerca integrata e stili ottimizzati.

## Proprietà

| Nome Proprietà | Tipo | Valore Predefinito | Descrizione                          |
| -------------- | ---- | ------------------ | ------------------------------------ |
| ...InputProps  | -    | -                  | Supporta tutte le proprietà di Input di Ant Design |

## Utilizzo Base

```tsx
import { MagicSearch } from '@/components/base/MagicSearch';

// Utilizzo base
<MagicSearch />

// Con valore predefinito
<MagicSearch defaultValue="Contenuto di ricerca predefinito" />

// Ascolta cambiamenti di input
<MagicSearch
  onChange={(e) => console.log('Input corrente:', e.target.value)}
/>

// Segnaposto personalizzato
<MagicSearch placeholder="Segnaposto personalizzato" />

// Stato disabilitato
<MagicSearch disabled />

// Stile personalizzato
<MagicSearch
  style={{ width: 300 }}
/>

// Utilizzo con riferimento
const searchRef = useRef<InputRef>(null);
<MagicSearch ref={searchRef} />
```

## Caratteristiche

1. **Icona di ricerca integrata** 🔍: Mostra per default un'icona di ricerca davanti all'input
2. **Supporto internazionalizzazione** 🌍: Utilizza automaticamente la traduzione i18n di "Ricerca" come segnaposto predefinito
3. **Design semplice** ✨: Fornisce uno stile semplice per l'input di ricerca
4. **Completamente personalizzabile** 🎨: Supporta tutte le proprietà del componente Input di Ant Design

## Quando Utilizzare

-   Quando hai bisogno di aggiungere un semplice input di ricerca alla pagina
-   Quando non hai bisogno di un pulsante di ricerca, solo dell'input e dell'icona di ricerca
-   Quando hai bisogno di un componente di ricerca leggero
-   Quando hai bisogno di utilizzarlo con altri componenti per ricerche

Il componente MagicSearch rende il tuo input di ricerca più semplice e facile da usare, adatto a vari scenari che richiedono funzionalità di ricerca. 🚀

---

**Testo Originale (Inglese):**

# MagicSearch 魔法搜索组件

`MagicSearch` 是一个基于 Ant Design Input 组件的简化版搜索输入框，提供了内置搜索图标和优化的样式。

## 属性

| 属性名        | 类型 | 默认值 | 说明                             |
| ------------- | ---- | ------ | -------------------------------- |
| ...InputProps | -    | -      | 支持所有 Ant Design Input 的属性 |

## 基础用法

```tsx
import { MagicSearch } from '@/components/base/MagicSearch';

// 基础用法
<MagicSearch />

// 带默认值
<MagicSearch defaultValue="默认搜索内容" />

// 监听输入变化
<MagicSearch
  onChange={(e) => console.log('当前输入:', e.target.value)}
/>

// 自定义占位符
<MagicSearch placeholder="自定义占位符" />

// 禁用状态
<MagicSearch disabled />

// 自定义样式
<MagicSearch
  style={{ width: 300 }}
/>

// 使用引用
const searchRef = useRef<InputRef>(null);
<MagicSearch ref={searchRef} />
```

## 特点

1. **内置搜索图标**：默认在输入框前方显示搜索图标
2. **国际化支持**：自动使用 i18n 翻译的"搜索"作为默认占位符
3. **简洁设计**：提供了简洁的搜索输入框样式
4. **完全可定制**：支持所有 Ant Design Input 组件的属性

## 何时使用

-   需要在页面上添加简单的搜索输入框时
-   不需要搜索按钮，只需要输入框和搜索图标时
-   需要一个轻量级的搜索组件时
-   需要与其他组件配合使用进行搜索时

MagicSearch 组件让你的搜索输入框更加简洁和易用，适合在各种需要搜索功能的场景下使用。
