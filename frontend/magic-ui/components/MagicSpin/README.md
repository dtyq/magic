# MagicSpin Componente di Caricamento Magico ⏳

`MagicSpin` è una versione migliorata del componente Spin di Ant Design, che offre animazioni di caricamento brandizzate e un migliore controllo degli stili. 🔄

## Proprietà

| Nome Proprietà | Tipo    | Valore Predefinito | Descrizione                          |
| -------------- | ------- | ------------------ | ------------------------------------ |
| section        | boolean | false              | Se utilizzare l'animazione di caricamento segmentata |
| ...SpinProps   | -       | -                  | Supporta tutte le proprietà di Ant Design Spin |

## Uso Base

```tsx
import { MagicSpin } from '@/components/base/MagicSpin';

// Uso base
<MagicSpin spinning />

// Avvolgere contenuto
<MagicSpin spinning>
  <div>Contenuto in caricamento</div>
</MagicSpin>

// Dimensioni diverse
<MagicSpin size="small" spinning />
<MagicSpin spinning /> {/* Dimensione predefinita */}
<MagicSpin size="large" spinning />

// Animazione di caricamento segmentata
<MagicSpin section={true} spinning />

// Centrare in un contenitore
<div style={{ height: '200px', position: 'relative' }}>
  <MagicSpin spinning />
</div>

// Con testo di suggerimento
<MagicSpin tip="Caricamento in corso..." spinning />
```

## Caratteristiche ✨

1. **Animazione Brandizzata**: Utilizza l'animazione Lottie del brand Magic come indicatore di caricamento 🎨
2. **Dimensioni Adattive**: Fornisce tre dimensioni preimpostate: piccola, media e grande 📏
3. **Layout Centrato**: Si centra automaticamente nel contenitore 🔍
4. **Animazione Segmentata**: Puoi alternare stili di animazione diversi tramite la proprietà `section` 🎭
5. **Adattamento Tema**: Si adatta automaticamente ai temi chiaro/scuro 🌙

## Quando Usare

- Quando carichi una pagina o un componente per mostrare lo stato di caricamento 📄
- Durante richieste di dati per fornire feedback visivo 📊
- Per operazioni di lunga durata per fornire un suggerimento di attesa ⏱️
- Quando è necessario impedire all'utente di interagire con il contenuto in caricamento 🚫
- Quando è necessaria un'esperienza di caricamento brandizzata 🏷️

Il componente MagicSpin rende la visualizzazione dello stato di caricamento più bella e brandizzata, adatto per vari scenari che richiedono suggerimenti di caricamento. 👍

---

**Testo Originale (Cinese e Inglese):**

# MagicSpin 魔法加载组件

`MagicSpin` 是一个基于 Ant Design Spin 组件的增强版加载组件，提供了品牌化的加载动画和更好的样式控制。

## 属性

| 属性名       | 类型    | 默认值 | 说明                            |
| ------------ | ------- | ------ | ------------------------------- |
| section      | boolean | false  | 是否使用节段式加载动画          |
| ...SpinProps | -       | -      | 支持所有 Ant Design Spin 的属性 |

## 基础用法

```tsx
import { MagicSpin } from '@/components/base/MagicSpin';

// 基础用法
<MagicSpin spinning />

// 包裹内容
<MagicSpin spinning>
  <div>加载中的内容</div>
</MagicSpin>

// 不同尺寸
<MagicSpin size="small" spinning />
<MagicSpin spinning /> {/* 默认尺寸 */}
<MagicSpin size="large" spinning />

// 节段式加载动画
<MagicSpin section={true} spinning />

// 在容器中居中显示
<div style={{ height: '200px', position: 'relative' }}>
  <MagicSpin spinning />
</div>

// 带提示文本
<MagicSpin tip="加载中..." spinning />
```

## 特点

1. **品牌化动画**：使用 Magic 品牌的 Lottie 动画作为加载指示器
2. **自适应尺寸**：提供小、中、大三种预设尺寸
3. **居中布局**：自动在容器中居中显示
4. **节段式动画**：可以通过 `section` 属性切换不同的动画风格
5. **主题适配**：自动适应亮色/暗色主题

## 何时使用

-   页面或组件加载时显示加载状态
-   数据请求过程中提供视觉反馈
-   长时间操作时提供等待提示
-   需要阻止用户与正在加载的内容交互时
-   需要品牌化加载体验时

MagicSpin 组件让你的加载状态展示更加美观和品牌化，适合在各种需要加载提示的场景下使用。
