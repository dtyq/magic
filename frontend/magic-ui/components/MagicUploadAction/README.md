# UploadAction Componente Azione di Caricamento 📤

UploadAction è un componente di basso livello per gestire le interazioni di caricamento file. Incapsula la logica principale per la selezione dei file, fornendo un input file nascosto e un metodo per attivare la selezione, che può essere utilizzato con vari pulsanti personalizzati o aree di trascinamento.

## Proprietà

| Nome Proprietà | Tipo                                     | Valore Predefinito | Descrizione                                             |
| -------------- | ---------------------------------------- | ------------------ | ------------------------------------------------------- |
| multiple       | boolean                                  | false              | Se supportare la selezione di più file 📁               |
| handler        | (trigger: () => void) => React.ReactNode | -                  | Per rendere l'elemento che attiva il caricamento, riceve una funzione trigger come parametro 🔄 |
| onFileChange   | (files: File[]) => void                  | -                  | Funzione di callback dopo la selezione dei file, riceve l'array dei file selezionati 📂 |

## Uso Base

```tsx
import UploadAction from '@/opensource/components/base/UploadAction';

// Uso base - pulsante personalizzato per attivare il caricamento
const handleFileChange = (files: File[]) => {
  console.log('File selezionati:', files);
  // Gestisci la logica di caricamento file
};

<UploadAction
  onFileChange={handleFileChange}
  handler={(trigger) => (
    <button onClick={trigger}>Seleziona File</button>
  )}
/>

// Supporto per caricamento multi-file
<UploadAction
  multiple
  onFileChange={handleFileChange}
  handler={(trigger) => (
    <button onClick={trigger}>Seleziona Più File</button>
  )}
/>

// Combinazione con altri componenti
import { Button } from 'antd';

<UploadAction
  onFileChange={handleFileChange}
  handler={(trigger) => (
    <Button type="primary" onClick={trigger}>
      Carica File
    </Button>
  )}
/>
```

## Caratteristiche

-   **Modalità di Attivazione Flessibile** 🔄: Personalizza l'elemento che attiva il caricamento tramite la proprietà handler
-   **Input File Nascosto** 👁️‍🗨️: Nasconde l'input file nativo poco attraente
-   **Supporto Multi-File** 📁: Abilita la selezione di più file con la proprietà multiple
-   **Gestione File Semplificata** 📋: Gestisce automaticamente l'evento di selezione file e fornisce i file selezionati tramite callback
-   **Riutilizzabilità** 🔄: Riutilizzabile in diversi scenari di caricamento

## Scenari di Uso

-   Implementazione di pulsanti di caricamento personalizzati 🎨
-   Funzionalità di selezione file per aree di trascinamento 🖱️
-   Interfacce di caricamento che necessitano di nascondere l'input file nativo
-   Come blocco di costruzione per componenti di caricamento più complessi 🏗️
-   Qualsiasi scenario interattivo che richieda la selezione di file 📂

Il componente UploadAction si concentra sulla logica principale della selezione file, senza includere stili o elementi visivi, rendendolo flessibile per combinarsi con vari elementi di interfaccia personalizzati, fornendo un'esperienza di caricamento file coerente per l'applicazione.

## Testo Originale
# UploadAction 上传动作组件

UploadAction 是一个用于处理文件上传交互的底层组件。它封装了文件选择的核心逻辑，提供了一个隐藏的文件输入框和触发文件选择的方法，可以与各种自定义上传按钮或拖拽区域配合使用。

## 属性

| 属性名       | 类型                                     | 默认值 | 描述                                             |
| ------------ | ---------------------------------------- | ------ | ------------------------------------------------ |
| multiple     | boolean                                  | false  | 是否支持多文件选择                               |
| handler      | (trigger: () => void) => React.ReactNode | -      | 用于渲染触发上传的元素，接收一个触发函数作为参数 |
| onFileChange | (files: File[]) => void                  | -      | 文件选择后的回调函数，接收选中的文件数组         |

## 基本用法

```tsx
import UploadAction from '@/opensource/components/base/UploadAction';

// 基本用法 - 自定义按钮触发上传
const handleFileChange = (files: File[]) => {
  console.log('选择的文件:', files);
  // 处理文件上传逻辑
};

<UploadAction
  onFileChange={handleFileChange}
  handler={(trigger) => (
    <button onClick={trigger}>选择文件</button>
  )}
/>

// 支持多文件上传
<UploadAction
  multiple
  onFileChange={handleFileChange}
  handler={(trigger) => (
    <button onClick={trigger}>选择多个文件</button>
  )}
/>

// 与其他组件结合使用
import { Button } from 'antd';

<UploadAction
  onFileChange={handleFileChange}
  handler={(trigger) => (
    <Button type="primary" onClick={trigger}>
      上传文件
    </Button>
  )}
/>
```

## 特性

-   **灵活的触发方式**：通过 handler 属性自定义触发上传的元素
-   **隐藏原生文件输入**：隐藏了不美观的原生文件输入框
-   **多文件支持**：可以通过 multiple 属性启用多文件选择
-   **简化的文件处理**：自动处理文件选择事件，并通过回调函数提供选中的文件
-   **可重用性**：可以在不同的上传场景中重复使用

## 使用场景

-   自定义上传按钮的实现
-   拖拽上传区域的文件选择功能
-   需要隐藏原生文件输入框的上传界面
-   作为更复杂上传组件的基础构建块
-   任何需要文件选择功能的交互场景

UploadAction 组件专注于文件选择的核心逻辑，不包含样式和视觉元素，这使得它可以灵活地与各种自定义界面元素结合使用，为应用提供一致的文件上传体验。
