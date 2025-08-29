# MagicEmptyFavor Componente Vuoto Preferiti Magico

MagicEmptyFavor è un componente utilizzato per visualizzare lo stato vuoto dei preferiti. Quando la lista dei preferiti dell'utente è vuota, questo componente mostra un messaggio amichevole e un'icona, migliorando l'esperienza utente. ❤️

## Proprietà

| Nome Proprietà | Tipo   | Valore Predefinito | Descrizione                                             |
| -------------- | ------ | ------------------ | ------------------------------------------------------- |
| text           | string | -                  | Testo personalizzato da visualizzare; se non fornito, usa il testo di internazionalizzazione predefinito |

## Uso Base

```tsx
import MagicEmptyFavor from '@/components/base/MagicEmptyFavor';

// Uso base - con testo predefinito
<MagicEmptyFavor />

// Testo personalizzato
<MagicEmptyFavor text="Non hai ancora aggiunto alcun elemento ai preferiti" />

// In rendering condizionale
{favoritesList.length === 0 && <MagicEmptyFavor />}
```

## Caratteristiche

-   **Prompt amichevole per stato vuoto** 💬: Fornisce feedback visivo, evitando pagine bianche
-   **Supporto internazionalizzazione** 🌍: Testo predefinito supporta più lingue
-   **Design semplice** ✨: Usa una combinazione semplice di icona e testo
-   **Testo personalizzabile** ✏️: Supporta testo di visualizzazione personalizzato
-   **Leggero** 🪶: Implementazione semplice del componente, senza dipendenze aggiuntive

## Scenari d'Uso

-   Visualizzazione dello stato quando la lista dei preferiti o dei favoriti è vuota
-   Prompt quando l'utente non ha ancora aggiunto alcun contenuto
-   Prompt amichevole quando i risultati di ricerca sono vuoti
-   Qualsiasi scenario che necessita di mostrare uno stato "nessun dato"

Il componente MagicEmptyFavor migliora l'esperienza utente quando si affronta una lista vuota fornendo un prompt di stato vuoto visivamente accattivante, incoraggiando al contempo gli utenti ad aggiungere contenuti ai preferiti. 📚

---

**Testo Originale (Inglese/Cinese):**

# MagicEmptyFavor 魔法空收藏组件

MagicEmptyFavor 是一个用于显示收藏夹为空状态的组件。当用户的收藏列表为空时，该组件会显示一个友好的提示信息和图标，提升用户体验。

## 属性

| 属性名 | 类型   | 默认值 | 描述                                             |
| ------ | ------ | ------ | ------------------------------------------------ |
| text   | string | -      | 自定义显示的文本，如不提供则使用默认的国际化文本 |

## 基本用法

```tsx
import MagicEmptyFavor from '@/components/base/MagicEmptyFavor';

// 基本用法 - 使用默认文本
<MagicEmptyFavor />

// 自定义文本
<MagicEmptyFavor text="您还没有添加任何收藏项" />

// 在条件渲染中使用
{favoritesList.length === 0 && <MagicEmptyFavor />}
```

## 特性

-   **友好的空状态提示**：提供视觉反馈，避免空白页面
-   **国际化支持**：默认文本支持多语言
-   **简洁的设计**：使用简单的图标和文字组合
-   **可定制文本**：支持自定义显示文本
-   **轻量级**：组件实现简单，不引入额外依赖

## 使用场景

-   收藏夹或喜爱列表为空时的状态展示
-   用户尚未添加任何内容时的提示
-   搜索结果为空时的友好提示
-   任何需要显示"无数据"状态的场景

MagicEmptyFavor 组件通过提供一个视觉上吸引人的空状态提示，改善了用户在面对空列表时的体验，同时鼓励用户添加内容到收藏夹中。
