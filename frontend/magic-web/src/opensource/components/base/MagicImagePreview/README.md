# MagicImagePreview Componente di Anteprima Immagini Magiche 🖼️

`MagicImagePreview` è un componente di anteprima immagini ricco di funzionalità, che offre interazioni come zoom, rotazione, trascinamento e confronto, adatto a scenari in cui è necessario esaminare immagini in dettaglio.

## Proprietà

| Nome Proprietà    | Tipo                            | Valore Predefinito | Descrizione                     |
| ----------------- | ------------------------------- | ------------------ | ------------------------------- |
| src               | string                          | -                  | URL sorgente dell'immagine      |
| onNext            | () => void                      | -                  | Callback per l'immagine successiva |
| onPrev            | () => void                      | -                  | Callback per l'immagine precedente |
| nextDisabled      | boolean                         | false              | Disabilita il pulsante successivo |
| prevDisabled      | boolean                         | false              | Disabilita il pulsante precedente |
| rootClassName     | string                          | -                  | Classe personalizzata per il contenitore radice |
| hasCompare        | boolean                         | false              | Abilita la funzionalità di confronto immagini |
| viewType          | CompareViewType                 | -                  | Tipo di vista confronto         |
| onChangeViewType  | (type: CompareViewType) => void | -                  | Callback per cambio tipo vista confronto |
| onLongPressStart  | () => void                      | -                  | Callback inizio pressione lunga (per modalità confronto) |
| onLongPressEnd    | () => void                      | -                  | Callback fine pressione lunga (per modalità confronto) |
| ...HTMLAttributes | -                               | -                  | Supporta tutti gli attributi dell'elemento HTML img |

### Enumerazione CompareViewType

| Valore     | Descrizione         |
| ---------- | ------------------- |
| PULL       | Modalità confronto trascinamento 🔄 |
| LONG_PRESS | Modalità confronto pressione lunga ⏳ |

## Utilizzo Base

```tsx
import { MagicImagePreview } from '@/components/base/MagicImagePreview';

// Utilizzo base
<MagicImagePreview>
  <img src="/path/to/image.jpg" alt="Immagine anteprima" />
</MagicImagePreview>

// Anteprima immagine con pulsanti navigazione
<MagicImagePreview
  onNext={handleNextImage}
  onPrev={handlePrevImage}
  nextDisabled={isLastImage}
  prevDisabled={isFirstImage}
>
  <img src={currentImage} alt="Immagine anteprima" />
</MagicImagePreview>

// Con funzionalità confronto immagini
<MagicImagePreview
  hasCompare={true}
  viewType={CompareViewType.PULL}
  onChangeViewType={handleViewTypeChange}
  onLongPressStart={handleLongPressStart}
  onLongPressEnd={handleLongPressEnd}
>
  <div className="image-container">
    <img src="/path/to/original-image.jpg" alt="Immagine originale" />
    <img src="/path/to/compared-image.jpg" alt="Immagine confronto" />
  </div>
</MagicImagePreview>

// Stili personalizzati
<MagicImagePreview rootClassName="custom-preview-container">
  <img
    src="/path/to/image.jpg"
    alt="Immagine anteprima"
    className="custom-image"
  />
</MagicImagePreview>
```

## Caratteristiche

1. **Barra strumenti interattiva multifunzione** 🔧: Offre funzioni come zoom, rotazione, reset e altre operazioni sulle immagini
2. **Trascinamento** 🖱️: Supporta il movimento dell'immagine tramite trascinamento del mouse
3. **Zoom con rotella** 🔍: Permette lo zoom dell'immagine usando la rotella del mouse
4. **Confronto immagini** ⚖️: Supporta due modalità di confronto - trascinamento e pressione lunga
5. **Navigazione immagini** ⬅️➡️: Supporta navigazione avanti e indietro in collezioni di immagini
6. **Design responsivo** 📱: Si adatta a contenitori di dimensioni diverse
7. **Adattamento tema scuro** 🌙: La barra strumenti si adatta automaticamente al tema scuro
8. **Riconoscimento immagini lunghe** 📜: Riconosce automaticamente e gestisce adeguatamente la visualizzazione di immagini lunghe

## Quando Usare

- Quando è necessario esaminare in dettaglio il contenuto delle immagini 👀
- Quando è necessario eseguire operazioni come zoom e rotazione sulle immagini 🔄
- Quando è necessario confrontare le differenze tra due immagini (es. immagine originale vs. elaborata) ⚖️
- Quando è necessario sfogliare più immagini in una collezione ⬅️➡️
- Quando è necessario fornire una funzionalità professionale di anteprima immagini in un'applicazione 🖼️
- Quando è necessario visualizzare dettagli di immagini ad alta risoluzione 📸

Il componente MagicImagePreview offre un'esperienza professionale di anteprima immagini, ideale per scenari che richiedono un esame dettagliato del contenuto, come gallerie di immagini, app di editing foto, presentazioni di prodotti, ecc.

## Testo Originale
# MagicImagePreview 魔法图片预览组件

`MagicImagePreview` 是一个功能丰富的图片预览组件，提供缩放、旋转、拖拽、对比等多种交互功能，适用于需要详细查看图片的场景。

## 属性

| 属性名            | 类型                            | 默认值 | 说明                         |
| ----------------- | ------------------------------- | ------ | ---------------------------- |
| src               | string                          | -      | 图片源地址                   |
| onNext            | () => void                      | -      | 下一张图片回调函数           |
| onPrev            | () => void                      | -      | 上一张图片回调函数           |
| nextDisabled      | boolean                         | false  | 是否禁用下一张按钮           |
| prevDisabled      | boolean                         | false  | 是否禁用上一张按钮           |
| rootClassName     | string                          | -      | 根容器的自定义类名           |
| hasCompare        | boolean                         | false  | 是否启用图片对比功能         |
| viewType          | CompareViewType                 | -      | 对比视图类型                 |
| onChangeViewType  | (type: CompareViewType) => void | -      | 对比视图类型变更回调         |
| onLongPressStart  | () => void                      | -      | 长按开始回调（用于对比模式） |
| onLongPressEnd    | () => void                      | -      | 长按结束回调（用于对比模式） |
| ...HTMLAttributes | -                               | -      | 支持所有 HTML 图片元素的属性 |

### CompareViewType 枚举

| 值         | 说明         |
| ---------- | ------------ |
| PULL       | 拖拽对比模式 |
| LONG_PRESS | 长按对比模式 |

## 基础用法

```tsx
import { MagicImagePreview } from '@/components/base/MagicImagePreview';

// 基础用法
<MagicImagePreview>
  <img src="/path/to/image.jpg" alt="预览图片" />
</MagicImagePreview>

// 带导航按钮的图片预览
<MagicImagePreview
  onNext={handleNextImage}
  onPrev={handlePrevImage}
  nextDisabled={isLastImage}
  prevDisabled={isFirstImage}
>
  <img src={currentImage} alt="预览图片" />
</MagicImagePreview>

// 带图片对比功能
<MagicImagePreview
  hasCompare={true}
  viewType={CompareViewType.PULL}
  onChangeViewType={handleViewTypeChange}
  onLongPressStart={handleLongPressStart}
  onLongPressEnd={handleLongPressEnd}
>
  <div className="image-container">
    <img src="/path/to/original-image.jpg" alt="原图" />
    <img src="/path/to/compared-image.jpg" alt="对比图" />
  </div>
</MagicImagePreview>

// 自定义样式
<MagicImagePreview rootClassName="custom-preview-container">
  <img
    src="/path/to/image.jpg"
    alt="预览图片"
    className="custom-image"
  />
</MagicImagePreview>
```

## 特点

1. **多功能交互工具栏**：提供缩放、旋转、重置等多种图片操作功能
2. **拖拽移动**：支持通过鼠标拖拽移动图片位置
3. **滚轮缩放**：支持使用鼠标滚轮进行图片缩放
4. **图片对比**：支持两种对比模式 - 拖拽对比和长按对比
5. **图片导航**：支持多图片场景下的前后导航
6. **响应式设计**：自适应不同尺寸的容器
7. **暗色主题适配**：工具栏自动适配暗色主题
8. **长图识别**：自动识别并适当处理长图显示

## 何时使用

-   需要详细查看图片内容时
-   需要对图片进行缩放、旋转等操作时
-   需要比较两张图片的差异时（如原图与处理后的图片）
-   需要在图片集合中浏览多张图片时
-   需要在应用中提供专业的图片预览功能时
-   需要查看高清图片细节时

MagicImagePreview 组件提供了专业的图片预览体验，适合在需要详细查看图片内容的场景中使用，如图片库、照片编辑应用、产品展示等。
