# MagicCollapse 🪄 Componente Pannello a Fisarmonica Magico

`MagicCollapse` è una versione migliorata del componente Collapse di Ant Design, che offre stili più belli e una migliore esperienza utente.

## Proprietà

| Nome Proprietà   | Tipo | Valore Predefinito | Descrizione                          |
| ---------------- | ---- | ------------------ | ------------------------------------ |
| ...CollapseProps | -    | -                  | Supporta tutte le proprietà di Ant Design Collapse |

## Uso Base

```tsx
import { MagicCollapse } from '@/components/base/MagicCollapse';
import { Collapse } from 'antd';

const { Panel } = Collapse;

// Uso base
<MagicCollapse>
  <Panel header="Questo è il titolo del pannello 1" key="1">
    <p>Questo è il contenuto del pannello 1</p>
  </Panel>
  <Panel header="Questo è il titolo del pannello 2" key="2">
    <p>Questo è il contenuto del pannello 2</p>
  </Panel>
  <Panel header="Questo è il titolo del pannello 3" key="3">
    <p>Questo è il contenuto del pannello 3</p>
  </Panel>
</MagicCollapse>

// Espandi pannelli specifici per default
<MagicCollapse defaultActiveKey={['1']}>
  <Panel header="Pannello espanso per default" key="1">
    <p>Questo è il contenuto del pannello espanso per default</p>
  </Panel>
  <Panel header="Pannello chiuso per default" key="2">
    <p>Questo è il contenuto del pannello chiuso per default</p>
  </Panel>
</MagicCollapse>

// Modalità fisarmonica (solo un pannello espanso alla volta)
<MagicCollapse accordion>
  <Panel header="Pannello fisarmonica 1" key="1">
    <p>Contenuto pannello fisarmonica 1</p>
  </Panel>
  <Panel header="Pannello fisarmonica 2" key="2">
    <p>Contenuto pannello fisarmonica 2</p>
  </Panel>
</MagicCollapse>

// Ascolta eventi di espansione/collasso
<MagicCollapse onChange={(key) => console.log('Pannello attualmente espanso:', key)}>
  <Panel header="Pannello ascoltabile 1" key="1">
    <p>Contenuto pannello 1</p>
  </Panel>
  <Panel header="Pannello ascoltabile 2" key="2">
    <p>Contenuto pannello 2</p>
  </Panel>
</MagicCollapse>
```

## Caratteristiche ✨

1. **Stili Ottimizzati** 🎨: Usa la modalità ghost, rimuove i bordi per un aspetto più pulito e bello
2. **Icona di Espansione Personalizzata** 🔄: Usa il componente MagicIcon come icona di espansione per un effetto visivo più uniforme
3. **Animazione Fluida** 🌊: Effetto di rotazione fluida durante espansione/collasso
4. **Layout Flessibile** 📐: Icona di espansione sul lato destro, seguendo le tendenze di design moderne

## Quando Usare ❓

- Quando devi raggruppare contenuti complessi per la visualizzazione
- Quando devi risparmiare spazio sulla pagina, collassando i contenuti
- Quando devi creare un effetto fisarmonica (solo un pannello espanso alla volta)
- Quando devi mostrare informazioni categorizzate, permettendo all'utente di visualizzarle su richiesta

Il componente MagicCollapse rende i tuoi pannelli a fisarmonica più belli e user-friendly, mantenendo tutte le funzionalità di Ant Design Collapse.

---

## Testo Originale (Inglese) 📜

# MagicCollapse 魔法折叠面板组件

`MagicCollapse` 是一个基于 Ant Design Collapse 组件的增强版折叠面板，提供了更美观的样式和更好的用户体验。

## 属性

| 属性名           | 类型 | 默认值 | 说明                                |
| ---------------- | ---- | ------ | ----------------------------------- |
| ...CollapseProps | -    | -      | 支持所有 Ant Design Collapse 的属性 |

## 基础用法

```tsx
import { MagicCollapse } from '@/components/base/MagicCollapse';
import { Collapse } from 'antd';

const { Panel } = Collapse;

// 基础用法
<MagicCollapse>
  <Panel header="这是面板标题1" key="1">
    <p>这是面板内容1</p>
  </Panel>
  <Panel header="这是面板标题2" key="2">
    <p>这是面板内容2</p>
  </Panel>
  <Panel header="这是面板标题3" key="3">
    <p>这是面板内容3</p>
  </Panel>
</MagicCollapse>

// 默认展开指定面板
<MagicCollapse defaultActiveKey={['1']}>
  <Panel header="默认展开的面板" key="1">
    <p>这是默认展开的面板内容</p>
  </Panel>
  <Panel header="默认关闭的面板" key="2">
    <p>这是默认关闭的面板内容</p>
  </Panel>
</MagicCollapse>

// 手风琴模式（一次只能展开一个面板）
<MagicCollapse accordion>
  <Panel header="手风琴面板1" key="1">
    <p>手风琴面板内容1</p>
  </Panel>
  <Panel header="手风琴面板2" key="2">
    <p>手风琴面板内容2</p>
  </Panel>
</MagicCollapse>

// 监听展开/折叠事件
<MagicCollapse onChange={(key) => console.log('当前展开的面板:', key)}>
  <Panel header="可监听的面板1" key="1">
    <p>面板内容1</p>
  </Panel>
  <Panel header="可监听的面板2" key="2">
    <p>面板内容2</p>
  </Panel>
</MagicCollapse>
```

## 特点

1. **优化的样式**：使用 ghost 模式，去除了边框，更加简洁美观
2. **自定义展开图标**：使用 MagicIcon 组件作为展开图标，视觉效果更统一
3. **平滑的动画**：展开/折叠时有平滑的旋转动画效果
4. **灵活布局**：展开图标位于右侧，符合现代设计趋势

## 何时使用

-   需要将复杂内容分组展示时
-   需要节省页面空间，将内容折叠起来时
-   需要创建手风琴效果（一次只展开一个面板）时
-   需要分类展示信息，并允许用户按需查看时

MagicCollapse 组件让你的折叠面板更加美观和用户友好，同时保持了 Ant Design Collapse 的所有功能特性。
