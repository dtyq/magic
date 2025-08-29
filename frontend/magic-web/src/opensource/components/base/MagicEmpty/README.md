# MagicEmpty Componente Stato Vuoto Magico 📄

`MagicEmpty` è una versione semplificata del componente Empty di Ant Design, che offre supporto per l'internazionalizzazione e uno stile predefinito pulito. 🌍

## Proprietà

| Nome Proprietà | Tipo | Valore Predefinito | Descrizione                          |
| -------------- | ---- | ------------------ | ------------------------------------ |
| ...EmptyProps  | -    | -                  | Supporta tutte le proprietà di Empty di Ant Design |

## Utilizzo Base

```tsx
import { MagicEmpty } from '@/components/base/MagicEmpty';

// Utilizzo base
<MagicEmpty />

// Descrizione personalizzata (sovrascrive il testo internazionalizzato)
<MagicEmpty description="Nessun dato trovato" />

// Immagine personalizzata
<MagicEmpty image="/path/to/custom-image.png" />

// Utilizzo in liste o tabelle
<div style={{ textAlign: 'center', padding: '20px 0' }}>
  <MagicEmpty />
</div>

// Con pulsante di azione
<MagicEmpty>
  <button>Crea nuovo contenuto</button>
</MagicEmpty>
```

## Caratteristiche ✨

1. **Supporto Internazionalizzazione** 🌐: Utilizza automaticamente il testo tradotto i18n per "Nessun dato"
2. **Stile Pulito** 🎨: Utilizza Empty.PRESENTED_IMAGE_SIMPLE come immagine predefinita per maggiore semplicità
3. **Facilità d'Uso** 🚀: Pronto all'uso senza configurazioni aggiuntive
4. **Completamente Personalizzabile** 🔧: Supporta tutte le proprietà del componente Empty di Ant Design

## Quando Utilizzare

- Quando una pagina o contenitore non ha dati 📭
- Quando i risultati di ricerca o filtro sono vuoti 🔍
- Quando liste, tabelle o insiemi di risultati sono vuoti 📊
- Quando è necessario suggerire all'utente di creare il primo contenuto ➕

Il componente MagicEmpty rende la visualizzazione dello stato vuoto più pulita e internazionalizzata, adatto a vari scenari. 👍

## Testo Originale
# MagicEmpty 魔法空状态组件

`MagicEmpty` 是一个基于 Ant Design Empty 组件的简化版空状态组件，提供了国际化支持和简洁的默认样式。

## 属性

| 属性名        | 类型 | 默认值 | 说明                             |
| ------------- | ---- | ------ | -------------------------------- |
| ...EmptyProps | -    | -      | 支持所有 Ant Design Empty 的属性 |

## 基础用法

```tsx
import { MagicEmpty } from '@/components/base/MagicEmpty';

// 基础用法
<MagicEmpty />

// 自定义描述文本（会覆盖国际化文本）
<MagicEmpty description="没有找到数据" />

// 自定义图片
<MagicEmpty image="/path/to/custom-image.png" />

// 在列表或表格中使用
<div style={{ textAlign: 'center', padding: '20px 0' }}>
  <MagicEmpty />
</div>

// 带操作按钮
<MagicEmpty>
  <button>创建新内容</button>
</MagicEmpty>
```

## 特点

1. **国际化支持**：自动使用 i18n 翻译的"无数据"文本
2. **简洁样式**：默认使用 Empty.PRESENTED_IMAGE_SIMPLE 作为图片，更加简洁
3. **易于使用**：无需额外配置，开箱即用
4. **完全可定制**：支持所有 Ant Design Empty 组件的属性

## 何时使用

-   当页面或容器中没有数据时
-   当搜索或筛选结果为空时
-   当列表、表格或结果集为空时
-   当需要提示用户创建首个内容时

MagicEmpty 组件让你的空状态展示更加简洁和国际化，适合在各种场景下使用。
