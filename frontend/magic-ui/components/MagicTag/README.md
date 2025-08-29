# MagicTag Componente Etichetta Magica ✨

`MagicTag` è una versione migliorata del componente Tag di Ant Design, che offre stili più belli e una migliore esperienza utente.

## Proprietà

| Nome Proprietà | Tipo | Valore Predefinito | Descrizione                          |
| -------------- | ---- | ------------------ | ------------------------------------ |
| ...TagProps    | -    | -                  | Supporta tutte le proprietà di Ant Design Tag |

## Uso Base

```tsx
import { MagicTag } from '@/components/base/MagicTag';

// Etichetta base
<MagicTag>Contenuto Etichetta</MagicTag>

// Etichetta chiudibile
<MagicTag closable>Etichetta Chiudibile</MagicTag>

// Etichetta con colore
<MagicTag color="blue">Etichetta Blu</MagicTag>
<MagicTag color="red">Etichetta Rossa</MagicTag>
<MagicTag color="green">Etichetta Verde</MagicTag>
<MagicTag color="orange">Etichetta Arancione</MagicTag>

// Etichetta con icona
<MagicTag icon={<IconStar />}>Etichetta con Icona</MagicTag>

// Gestire evento di chiusura
<MagicTag closable onClose={() => console.log('Etichetta chiusa')}>
  Clicca per Chiudere
</MagicTag>
```

## Caratteristiche

1. **Stili Ottimizzati** ✨: Angoli più arrotondati, colori di riempimento più morbidi, aspetto generale più bello
2. **Icona di Chiusura Personalizzata** 🔄: Utilizza il componente MagicIcon come icona di chiusura, per un effetto visivo più uniforme
3. **Layout Flessibile** 📐: Utilizza layout flex interno, assicurando l'allineamento centrato del contenuto
4. **Design Senza Bordi** 🎨: Utilizza bordi trasparenti per default, rendendo le etichette più moderne

## Quando Usare

- Quando devi mostrare dati etichettati 📋
- Quando devi classificare dati 🏷️
- Quando devi mostrare stati o attributi 📊
- Quando gli utenti devono aggiungere o rimuovere etichette ✏️

Il componente MagicTag rende la presentazione delle tue etichette più bella e uniforme, mantenendo tutte le funzionalità di Ant Design Tag.

## Testo Originale
# MagicTag 魔法标签组件

`MagicTag` 是一个基于 Ant Design Tag 组件的增强版标签，提供了更美观的样式和更好的用户体验。

## 属性

| 属性名      | 类型 | 默认值 | 说明                           |
| ----------- | ---- | ------ | ------------------------------ |
| ...TagProps | -    | -      | 支持所有 Ant Design Tag 的属性 |

## 基础用法

```tsx
import { MagicTag } from '@/components/base/MagicTag';

// 基础标签
<MagicTag>标签内容</MagicTag>

// 可关闭的标签
<MagicTag closable>可关闭标签</MagicTag>

// 带颜色的标签
<MagicTag color="blue">蓝色标签</MagicTag>
<MagicTag color="red">红色标签</MagicTag>
<MagicTag color="green">绿色标签</MagicTag>
<MagicTag color="orange">橙色标签</MagicTag>

// 带图标的标签
<MagicTag icon={<IconStar />}>带图标的标签</MagicTag>

// 处理关闭事件
<MagicTag closable onClose={() => console.log('标签被关闭')}>
  点击关闭
</MagicTag>
```

## 特点

1. **优化的样式**：圆角更大，填充色更柔和，整体更美观
2. **自定义关闭图标**：使用了 MagicIcon 组件作为关闭图标，视觉效果更统一
3. **灵活布局**：内部使用 flex 布局，确保内容居中对齐
4. **无边框设计**：默认使用透明边框，让标签看起来更现代

## 何时使用

-   需要展示标签化数据时
-   需要对数据进行分类时
-   需要展示状态或属性时
-   需要用户可以添加或删除标签时

MagicTag 组件让你的标签展示更加美观和统一，同时保持了 Ant Design Tag 的所有功能特性。
