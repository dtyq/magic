# MagicSplitter 🪄 Componente Pannello di Divisione Magico

`MagicSplitter` è una versione migliorata del componente Splitter di Ant Design, che offre uno stile più pulito e una migliore esperienza utente.

## Proprietà

| Nome Proprietà   | Tipo | Valore Predefinito | Descrizione                          |
| ---------------- | ---- | ------------------ | ------------------------------------ |
| ...SplitterProps | -    | -                  | Supporta tutte le proprietà di Ant Design Splitter |

## Sottocomponenti

-   `MagicSplitter.Panel` - Sottocomponente pannello di divisione, utilizzato per definire ciascuna area ridimensionabile

## Uso Base

```tsx
import { MagicSplitter } from '@/components/base/MagicSplitter';

// Uso base - divisione orizzontale
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>Contenuto pannello sinistro</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>Contenuto pannello destro</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// Divisione verticale
<MagicSplitter split="horizontal">
  <MagicSplitter.Panel>
    <div>Contenuto pannello superiore</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>Contenuto pannello inferiore</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// Impostare dimensioni predefinite
<MagicSplitter defaultSizes={[30, 70]}>
  <MagicSplitter.Panel>
    <div>Contenuto pannello sinistro (30%)</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>Contenuto pannello destro (70%)</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// Pannelli multipli
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>Primo pannello</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>Secondo pannello</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>Terzo pannello</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// Uso annidato
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>Pannello sinistro</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <MagicSplitter split="horizontal">
      <MagicSplitter.Panel>
        <div>Pannello destro superiore</div>
      </MagicSplitter.Panel>
      <MagicSplitter.Panel>
        <div>Pannello destro inferiore</div>
      </MagicSplitter.Panel>
    </MagicSplitter>
  </MagicSplitter.Panel>
</MagicSplitter>
```

## Caratteristiche ✨

1. **Design Pulito** 🧹: Rimossi gli stili predefiniti della barra di trascinamento, per un effetto visivo più pulito
2. **Trascinamento Senza Interruzioni** 🔄: Nessuna interferenza visiva durante il trascinamento della linea di divisione
3. **Layout Flessibile** 🏗️: Supporta divisione orizzontale e verticale, oltre all'uso annidato
4. **Margini Zero** 📏: I pannelli non hanno margini interni predefiniti, permettendo al contenuto di utilizzare pienamente lo spazio

## Quando Usare

-   Quando è necessario creare layout ridimensionabili 📐
-   Quando è necessario dividere lo schermo in più aree interattive 🖥️
-   Quando si implementano interfacce come editor di codice, browser di file, ecc., che richiedono regolazioni flessibili dello spazio 💻
-   Quando gli utenti devono personalizzare le dimensioni di ciascuna area 🎛️

Il componente MagicSplitter rende i tuoi pannelli di divisione più puliti e user-friendly, mantenendo tutte le funzionalità di Ant Design Splitter. 🪄

---

## Testo Originale (Inglese e Cinese)

# MagicSplitter 魔法分割面板组件

`MagicSplitter` 是一个基于 Ant Design Splitter 组件的增强版分割面板，提供了更简洁的样式和更好的用户体验。

## 属性

| 属性名           | 类型 | 默认值 | 说明                                |
| ---------------- | ---- | ------ | ----------------------------------- |
| ...SplitterProps | -    | -      | 支持所有 Ant Design Splitter 的属性 |

## 子组件

-   `MagicSplitter.Panel` - 分割面板的子面板组件，用于定义每个可调整大小的区域

## 基础用法

```tsx
import { MagicSplitter } from '@/components/base/MagicSplitter';

// 基础用法 - 水平分割
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>左侧面板内容</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>右侧面板内容</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 垂直分割
<MagicSplitter split="horizontal">
  <MagicSplitter.Panel>
    <div>上方面板内容</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>下方面板内容</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 设置默认尺寸
<MagicSplitter defaultSizes={[30, 70]}>
  <MagicSplitter.Panel>
    <div>左侧面板内容 (30%)</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>右侧面板内容 (70%)</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 多个面板
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>第一个面板</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>第二个面板</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <div>第三个面板</div>
  </MagicSplitter.Panel>
</MagicSplitter>

// 嵌套使用
<MagicSplitter>
  <MagicSplitter.Panel>
    <div>左侧面板</div>
  </MagicSplitter.Panel>
  <MagicSplitter.Panel>
    <MagicSplitter split="horizontal">
      <MagicSplitter.Panel>
        <div>右上面板</div>
      </MagicSplitter.Panel>
      <MagicSplitter.Panel>
        <div>右下面板</div>
      </MagicSplitter.Panel>
    </MagicSplitter>
  </MagicSplitter.Panel>
</MagicSplitter>
```

## 特点

1. **简洁设计**：移除了默认的拖动条样式，提供更干净的视觉效果
2. **无缝拖动**：拖动分割线时没有明显的视觉干扰
3. **灵活布局**：支持水平和垂直分割，以及嵌套使用
4. **零内边距**：面板默认没有内边距，让内容可以充分利用空间

## 何时使用

-   需要创建可调整大小的布局时
-   需要分割屏幕为多个可交互区域时
-   需要实现代码编辑器、文件浏览器等需要灵活调整空间的界面时
-   需要用户能够自定义各个区域的大小时

MagicSplitter 组件让你的分割面板更加简洁和用户友好，同时保持了 Ant Design Splitter 的所有功能特性。
