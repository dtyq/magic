# MagicMindmap Componente Mappa Mentale Magica 🧠

MagicMindmap è un componente per il rendering e l'interazione operativa con mappe mentali. Questo componente è basato sulla libreria MindMap, supporta la visualizzazione delle mappe mentali, lo zoom e il layout adattivo, fornendo agli utenti un'esperienza di visualizzazione intuitiva delle mappe mentali.

## Proprietà

| Nome Proprietà | Tipo    | Valore Predefinito | Descrizione                                      |
| -------------- | ------- | ------------------ | ------------------------------------------------ |
| data           | object  | -                  | Struttura dati della mappa mentale, contenente nodi e informazioni di connessione |
| readonly       | boolean | false              | Se è in modalità sola lettura, quando true gli utenti non possono modificare la mappa mentale |

Inoltre, il componente supporta il passaggio di altre proprietà dell'elemento HTML div.

## Uso Base

```tsx
import MagicMindmap from '@/components/base/MagicMindmap';

// Uso base
const mindmapData = {
  id: 'root',
  topic: 'Tema Centrale',
  children: [
    {
      id: 'sub1',
      topic: 'Sottotema 1',
      children: [
        { id: 'sub1-1', topic: 'Sottotema 1-1' },
        { id: 'sub1-2', topic: 'Sottotema 1-2' }
      ]
    },
    {
      id: 'sub2',
      topic: 'Sottotema 2',
      children: [
        { id: 'sub2-1', topic: 'Sottotema 2-1' }
      ]
    }
  ]
};

<MagicMindmap data={mindmapData} />

// Modalità sola lettura
<MagicMindmap data={mindmapData} readonly={true} />

// Stile personalizzato
<MagicMindmap
  data={mindmapData}
  className="custom-mindmap"
  style={{ height: '500px', border: '1px solid #eee' }}
/>
```

## Struttura Dati

La struttura dati della mappa mentale segue il seguente formato:

```typescript
interface MindMapNode {
  id: string // Identificatore univoco del nodo
  topic: string // Testo visualizzato del nodo
  children?: MindMapNode[] // Array di nodi figli
  style?: object // Stile opzionale del nodo
  expanded?: boolean // Se espandere i nodi figli
  // Altri attributi opzionali...
}
```

## Caratteristiche

-   **Operazioni Interattive** 🔄: Supporta zoom, trascinamento e espansione/compressione dei nodi
-   **Layout Adattivo** 📐: Regola automaticamente la posizione dei nodi per il miglior effetto di visualizzazione
-   **Design Responsivo** 📱: Si adatta ai cambiamenti delle dimensioni del contenitore, regolando automaticamente il layout della mappa mentale
-   **Modalità Sola Lettura** 🔒: Supporta la modalità sola lettura, adatta per scenari di presentazione
-   **Stile Personalizzato** 🎨: È possibile personalizzare l'aspetto della mappa mentale tramite CSS

## Scenari di Uso

-   Visualizzazione della struttura della conoscenza 📚
-   Presentazione di piani di progetto e decomposizione delle attività 📋
-   Organizzazione e associazione di concetti e idee 💡
-   Presentazione strutturata dei contenuti di apprendimento 🧑‍🎓
-   Qualsiasi scenario che richieda la visualizzazione di relazioni gerarchiche e associazioni 🌐

Il componente MagicMindmap fornisce alle applicazioni un modo intuitivo e potente per visualizzare e operare mappe mentali, aiutando gli utenti a comprendere e organizzare meglio le strutture informative.

---

## Testo Originale (Inglese)

# MagicMindmap 魔法思维导图组件

MagicMindmap is a component for rendering and interactive operation of mind maps. This component is based on the MindMap library, supports mind map display, zooming, and adaptive layout, providing users with an intuitive mind map visualization experience.

## Properties

| Property Name | Type    | Default Value | Description                                      |
| ------------- | ------- | ------------- | ------------------------------------------------ |
| data          | object  | -             | Mind map data structure, containing nodes and connection information |
| readonly      | boolean | false         | Whether it is read-only mode, when true users cannot edit the mind map |

Additionally, the component supports passing other HTML div element properties.

## Basic Usage

```tsx
import MagicMindmap from '@/components/base/MagicMindmap';

// Basic usage
const mindmapData = {
  id: 'root',
  topic: 'Central Topic',
  children: [
    {
      id: 'sub1',
      topic: 'Subtopic 1',
      children: [
        { id: 'sub1-1', topic: 'Subtopic 1-1' },
        { id: 'sub1-2', topic: 'Subtopic 1-2' }
      ]
    },
    {
      id: 'sub2',
      topic: 'Subtopic 2',
      children: [
        { id: 'sub2-1', topic: 'Subtopic 2-1' }
      ]
    }
  ]
};

<MagicMindmap data={mindmapData} />

// Read-only mode
<MagicMindmap data={mindmapData} readonly={true} />

// Custom style
<MagicMindmap
  data={mindmapData}
  className="custom-mindmap"
  style={{ height: '500px', border: '1px solid #eee' }}
/>
```

## Data Structure

The mind map data structure follows the following format:

```typescript
interface MindMapNode {
  id: string // Node unique identifier
  topic: string // Node display text
  children?: MindMapNode[] // Child node array
  style?: object // Optional node style
  expanded?: boolean // Whether to expand child nodes
  // Other optional attributes...
}
```

## Features

-   **Interactive Operations**: Supports zooming, dragging, and node expansion/collapse
-   **Adaptive Layout**: Automatically adjusts node positions for optimal visualization
-   **Responsive Design**: Adapts to container size changes, automatically adjusting mind map layout
-   **Read-Only Mode**: Supports read-only mode, suitable for presentation scenarios
-   **Custom Styling**: Mind map appearance can be customized via CSS

## Use Cases

-   Visualization of knowledge structures
-   Presentation of project plans and task breakdowns
-   Organization and association of concepts and ideas
-   Structured presentation of learning content
-   Any scenario requiring display of hierarchical relationships and associations

The MagicMindmap component provides applications with an intuitive and powerful way to display and operate mind maps, helping users better understand and organize information structures.
