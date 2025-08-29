# MagicButton Componente Pulsante Magico ✨

`MagicButton` è una versione migliorata del componente Button di Ant Design, che offre più opzioni di personalizzazione e ottimizzazioni stilistiche. 🔘

## Proprietà

| Nome Proprietà | Tipo                            | Valore Predefinito | Descrizione                          |
| -------------- | ------------------------------- | ------------------ | ------------------------------------ |
| justify        | CSSProperties["justifyContent"] | "center"           | Allineamento orizzontale del contenuto del pulsante |
| theme          | boolean                         | true               | Se applicare gli stili del tema      |
| tip            | ReactNode                       | -                  | Contenuto del suggerimento mostrato al passaggio del mouse |
| ...ButtonProps | -                               | -                  | Supporta tutte le proprietà del Button di Ant Design |

## Uso Base

```tsx
import { MagicButton } from '@/components/base/MagicButton';

// Pulsante base
<MagicButton>Cliccami</MagicButton>

// Pulsante con icona
<MagicButton icon={<IconStar />}>Preferiti</MagicButton>

// Pulsante con suggerimento
<MagicButton tip="Questo è un suggerimento">Passa il mouse per vedere il suggerimento</MagicButton>

// Allineamento personalizzato
<MagicButton justify="flex-start">Contenuto allineato a sinistra</MagicButton>

// Senza stili del tema
<MagicButton theme={false}>Senza stili del tema</MagicButton>

// Diversi tipi di pulsante
<MagicButton type="primary">Pulsante Principale</MagicButton>
<MagicButton type="default">Pulsante Predefinito</MagicButton>
<MagicButton type="dashed">Pulsante Tratteggiato</MagicButton>
<MagicButton type="link">Pulsante Link</MagicButton>
<MagicButton type="text">Pulsante Testo</MagicButton>
```

## Caratteristiche

1. **Controllo Stilistico Migliorato** 🎨: Offre più opzioni di personalizzazione stilistica, come l'allineamento del contenuto
2. **Funzione Suggerimento Integrata** 💡: Tramite la proprietà `tip` puoi facilmente aggiungere suggerimenti al passaggio del mouse
3. **Integrazione Tema** 🌟: Puoi controllare se applicare gli stili del tema con la proprietà `theme`
4. **Supporto Icone Flessibile** 🖼️: Completamente compatibile con il sistema di icone di Ant Design

## Quando Usare

- Quando devi posizionare un pulsante sulla pagina 📄
- Quando hai bisogno di un migliore controllo stilistico sul pulsante 🎯
- Quando il pulsante deve avere un suggerimento al passaggio del mouse 🖱️
- Quando il contenuto del pulsante necessita di un allineamento specifico 📐

Il componente MagicButton rende i tuoi pulsanti più flessibili e belli, mantenendo tutte le funzionalità del pulsante di Ant Design. 🚀

## Testo Originale
# MagicButton 魔法按钮组件

`MagicButton` 是一个基于 Ant Design Button 组件的增强版按钮，提供了更多的自定义选项和样式优化。

## 属性

| 属性名         | 类型                            | 默认值   | 说明                              |
| -------------- | ------------------------------- | -------- | --------------------------------- |
| justify        | CSSProperties["justifyContent"] | "center" | 按钮内容的水平对齐方式            |
| theme          | boolean                         | true     | 是否应用主题样式                  |
| tip            | ReactNode                       | -        | 鼠标悬停时显示的提示内容          |
| ...ButtonProps | -                               | -        | 支持所有 Ant Design Button 的属性 |

## 基础用法

```tsx
import { MagicButton } from '@/components/base/MagicButton';

// 基础按钮
<MagicButton>点击我</MagicButton>

// 带图标的按钮
<MagicButton icon={<IconStar />}>收藏</MagicButton>

// 带提示的按钮
<MagicButton tip="这是一个提示">悬停查看提示</MagicButton>

// 自定义对齐方式
<MagicButton justify="flex-start">左对齐内容</MagicButton>

// 不使用主题样式
<MagicButton theme={false}>无主题样式</MagicButton>

// 不同类型的按钮
<MagicButton type="primary">主要按钮</MagicButton>
<MagicButton type="default">默认按钮</MagicButton>
<MagicButton type="dashed">虚线按钮</MagicButton>
<MagicButton type="link">链接按钮</MagicButton>
<MagicButton type="text">文本按钮</MagicButton>
```

## 特点

1. **增强的样式控制**：提供了更多的样式自定义选项，如内容对齐方式
2. **内置提示功能**：通过 `tip` 属性可以轻松添加悬停提示
3. **主题集成**：可以通过 `theme` 属性控制是否应用主题样式
4. **灵活的图标支持**：完全兼容 Ant Design 的图标系统

## 何时使用

-   当你需要在页面上放置一个按钮时
-   当你需要按钮有更好的样式控制时
-   当你需要按钮带有悬停提示时
-   当你需要按钮内容有特定对齐方式时

MagicButton 组件让你的按钮更加灵活和美观，同时保持了 Ant Design 按钮的所有功能。
