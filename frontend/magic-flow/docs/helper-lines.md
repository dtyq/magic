# Funzionalità Linee Guida di ReactFlow 🚀

Il componente delle linee guida di React Flow fornisce funzionalità di linee di riferimento per l'allineamento dei nodi, aiutando gli utenti a ottenere un allineamento preciso durante il trascinamento dei nodi.

## Caratteristiche Principali 📋

- Visualizza linee di riferimento durante il trascinamento dei nodi
- Supporta la funzionalità di snap dei nodi per un allineamento preciso
- Supporta l'allineamento in direzione orizzontale e verticale
- Supporta vari modi di allineamento: allineamento sinistro, destro, centrato, superiore, inferiore, ecc.
- Si adatta al zoom e alla panoramica del viewport
- Fornisce opzioni di configurazione personalizzate ricche
- Supporta l'attivazione/disattivazione tramite pulsante del pannello di controllo o scorciatoie da tastiera

## Metodo di Utilizzo 🛠️

### Utilizzo Base

```tsx
import { ReactFlow, useViewport } from 'reactflow';
import { HelperLines, useHelperLines } from '@/MagicFlow/components/HelperLines';

function FlowComponent() {
  const { x, y, zoom } = useViewport();
  const [helperLinesEnabled, setHelperLinesEnabled] = useState(false);
  
  const {
    horizontalLines,
    verticalLines,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    hasHelperLines
  } = useHelperLines({
    nodes,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onNodesChange, // Se necessario per la funzionalità di snap dei nodi, questo parametro deve essere fornito
    enabled: helperLinesEnabled, // Controlla l'interruttore della funzionalità delle linee guida
  });

  return (
    <>
      {/* Aggiungi un pulsante di controllo */}
      <button onClick={() => setHelperLinesEnabled(!helperLinesEnabled)}>
        {helperLinesEnabled ? 'Disabilita Linee Guida' : 'Abilita Linee Guida'}
      </button>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={onNodesChange} // Se necessario per la funzionalità di snap dei nodi, questo parametro deve essere fornito
        {...otherProps}
      >
        {/* Altri componenti */}
        
        {/* Renderizza le linee guida */}
        {hasHelperLines && (
          <HelperLines
            horizontalLines={horizontalLines}
            verticalLines={verticalLines}
            transform={{ x, y, zoom }}
          />
        )}
      </ReactFlow>
    </>
  );
}
```

### Configurazione Personalizzata 🎨

Puoi personalizzare il comportamento e lo stile delle linee guida tramite il parametro `options`:

```tsx
const {
  horizontalLines,
  verticalLines,
  // ...
} = useHelperLines({
  nodes,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onNodesChange,
  enabled: helperLinesEnabled, // Controlla abilitazione/disabilitazione tramite stato
  options: {
    threshold: 8,        // Soglia di allineamento
    color: '#0077ff',    // Colore delle linee guida
    lineWidth: 2,        // Larghezza delle linee guida
    zIndex: 10000,       // z-index
    enableSnap: true     // Se abilitare la funzionalità di snap dei nodi
  }
});
```

Quindi passa queste opzioni al componente `HelperLines`:

```tsx
<HelperLines
  horizontalLines={horizontalLines}
  verticalLines={verticalLines}
  transform={{ x, y, zoom }}
  color={options.color}
  lineWidth={options.lineWidth}
  zIndex={options.zIndex}
/>
```

## Riferimento API 📖

### Hook `useHelperLines`

#### Parametri

Il hook `useHelperLines` accetta un oggetto di configurazione con le seguenti proprietà:

| Proprietà | Tipo | Obbligatorio | Descrizione |
| --- | --- | --- | --- |
| nodes | Node[] | Sì | Array di nodi di React Flow |
| onNodeDragStart | Function | No | Callback originale per l'inizio del trascinamento del nodo |
| onNodeDrag | Function | No | Callback originale per il trascinamento del nodo |
| onNodeDragStop | Function | No | Callback originale per la fine del trascinamento del nodo |
| onNodesChange | Function | No | Callback per le modifiche dei nodi, utilizzato per implementare la funzionalità di snap dei nodi |
| options | HelperLinesOptions | No | Opzioni di configurazione delle linee guida |
| enabled | boolean | No | Se abilitare la funzionalità delle linee guida, predefinito false |

#### Valori di Ritorno

| Proprietà | Tipo | Descrizione |
| --- | --- | --- |
| horizontalLines | number[] | Array delle posizioni delle linee guida orizzontali |
| verticalLines | number[] | Array delle posizioni delle linee guida verticali |
| handleNodeDragStart | Function | Funzione di gestione dell'inizio del trascinamento del nodo |
| handleNodeDrag | Function | Funzione di gestione del trascinamento del nodo |
| handleNodeDragStop | Function | Funzione di gestione della fine del trascinamento del nodo |
| hasHelperLines | boolean | Se ci sono linee guida da visualizzare |
| options | Object | Opzioni di configurazione attualmente utilizzate |
| enabled | boolean | Se la funzionalità delle linee guida è attualmente abilitata |

### Componente `HelperLines`

#### Proprietà

| Proprietà | Tipo | Obbligatorio | Valore Predefinito | Descrizione |
| --- | --- | --- | --- | --- |
| horizontalLines | number[] | Sì | - | Array delle posizioni delle linee guida orizzontali |
| verticalLines | number[] | Sì | - | Array delle posizioni delle linee guida verticali |
| transform | ViewportTransform | Sì | - | Informazioni sulla trasformazione del viewport |
| color | string | No | '#ff0071' | Colore delle linee guida |
| lineWidth | number | No | 1 | Larghezza delle linee guida |
| zIndex | number | No | 9999 | z-index delle linee guida |

### Definizioni dei Tipi

```typescript
interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

interface HelperLinesOptions {
  threshold?: number;
  color?: string;
  lineWidth?: number;
  zIndex?: number;
  enableSnap?: boolean;
}
```

## Integrazione nel Pannello di Controllo ⚙️

Puoi aggiungere un pulsante interruttore nel pannello di controllo del diagramma di flusso per controllare l'abilitazione/disabilitazione della funzionalità delle linee guida:

```tsx
// Aggiungi il pulsante di controllo delle linee guida negli elementi di controllo del pannello
const controlItemGroups = [
  // ... altri gruppi di controllo
  [
    {
      icon: helperLinesEnabled ? (
        <IconRuler stroke={1} color="#FF7D00" />
      ) : (
        <IconRuler stroke={1} />
      ),
      callback: () => setHelperLinesEnabled(!helperLinesEnabled),
      tooltips: `${helperLinesEnabled ? 'Disabilita' : 'Abilita'} Linee Guida (Ctrl+H)`,
      helperLinesEnabled,
    },
  ],
];

// Aggiungi supporto per scorciatoie da tastiera
useEffect(() => {
  const handleKeyDown = (event) => {
    // Ctrl+H o Command+H per alternare la funzionalità delle linee guida
    if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
      event.preventDefault();
      setHelperLinesEnabled(!helperLinesEnabled);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [helperLinesEnabled, setHelperLinesEnabled]);
```

## Principio di Implementazione 🧠

Il principio di implementazione principale della funzionalità delle linee guida:

1. Ascolta gli eventi di trascinamento dei nodi
2. Durante il trascinamento, calcola la relazione di posizione tra il nodo attualmente trascinato e gli altri nodi
3. Quando i bordi o i centri dei nodi si avvicinano (inferiore alla soglia impostata), visualizza le linee di riferimento di allineamento
4. Utilizza elementi posizionati assolutamente per renderizzare le linee guida, calcolando la posizione corretta in base allo zoom e alla panoramica del viewport

Principio di implementazione della funzionalità di snap dei nodi:

1. Quando si rileva che il nodo si avvicina alla posizione di allineamento, calcola le coordinate di allineamento precise
2. Aggiorna la posizione del nodo tramite il callback `onNodesChange` per far "snap" il nodo alla posizione di allineamento
3. Tra più posizioni di allineamento possibili, priorita la linea di riferimento più vicina alla posizione attuale di trascinamento

Principio di implementazione del controllo di abilitazione/disabilitazione:

1. Utilizza la variabile di stato `helperLinesEnabled` per controllare l'interruttore della funzionalità delle linee guida
2. Quando la funzionalità è disabilitata, gli eventi di trascinamento vengono passati direttamente alle funzioni di gestione originali, senza calcoli delle linee guida
3. Alterna lo stato di abilitazione tramite pulsante del pannello di controllo o scorciatoia da tastiera
4. Renderizza il componente delle linee guida solo quando la funzionalità è abilitata e ci sono nodi allineati

Le linee guida controllano i seguenti modi di allineamento:

- Direzione orizzontale
  - Allineamento superiore: il bordo superiore del nodo si allinea con il bordo superiore di altri nodi
  - Allineamento inferiore: il bordo inferiore del nodo si allinea con il bordo inferiore di altri nodi
  - Allineamento centrale: la linea centrale verticale del nodo si allinea con la linea centrale verticale di altri nodi

- Direzione verticale
  - Allineamento sinistro: il bordo sinistro del nodo si allinea con il bordo sinistro di altri nodi
  - Allineamento destro: il bordo destro del nodo si allinea con il bordo destro di altri nodi
  - Allineamento centrale: la linea centrale orizzontale del nodo si allinea con la linea centrale orizzontale di altri nodi

## Esempio 💡

### Esempio Completo con Controllo Interruttore

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  useViewport 
} from 'reactflow';
import { HelperLines, useHelperLines } from '@/MagicFlow/components/HelperLines';
import { IconRuler } from '@tabler/icons-react';
import 'reactflow/dist/style.css';

const initialNodes = [
  {
    id: '1',
    type: 'default',
    data: { label: 'Nodo 1' },
    position: { x: 250, y: 5 },
  },
  // ... altri nodi
];

const initialEdges = [
  // ... definizioni dei bordi
];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { x, y, zoom } = useViewport();
  const [helperLinesEnabled, setHelperLinesEnabled] = useState(false);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Utilizza l'hook delle linee guida
  const {
    horizontalLines,
    verticalLines,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    hasHelperLines,
  } = useHelperLines({
    nodes,
    onNodesChange,
    enabled: helperLinesEnabled,
    options: {
      threshold: 8,
      color: '#ff0071',
      enableSnap: true
    }
  });
  
  // Aggiungi supporto per scorciatoie da tastiera
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+H o Command+H per alternare la funzionalità delle linee guida
      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        setHelperLinesEnabled(!helperLinesEnabled);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [helperLinesEnabled]);

  return (
    <div style={{ height: '100%' }}>
      {/* Pannello di controllo */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
        <button
          onClick={() => setHelperLinesEnabled(!helperLinesEnabled)}
          style={{
            background: helperLinesEnabled ? '#ff7d00' : '#ffffff',
            color: helperLinesEnabled ? '#ffffff' : '#000000',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
          }}
          title={`${helperLinesEnabled ? 'Disabilita' : 'Abilita'} Linee Guida (Ctrl+H)`}
        >
          <IconRuler size={20} stroke={1.5} />
        </button>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
        
        {/* Renderizza le linee guida */}
        {hasHelperLines && (
          <HelperLines
            horizontalLines={horizontalLines}
            verticalLines={verticalLines}
            transform={{ x, y, zoom }}
            color="#ff0071"
            lineWidth={1}
          />
        )}
      </ReactFlow>
    </div>
  );
}
```

---

## Testo Originale (Cinese) 📜

# ReactFlow 辅助线功能

React Flow 辅助线组件提供了节点对齐参考线功能，帮助用户在拖拽节点时实现精确对齐。

## 功能特点

- 在拖拽节点时显示对齐参考线
- 支持节点吸附功能，实现精确对齐
- 支持水平和垂直方向的对齐
- 支持多种对齐方式：左对齐、右对齐、居中对齐、顶对齐、底对齐等
- 适配视口的缩放和平移
- 提供丰富的自定义配置选项
- 支持通过控制面板按钮或快捷键开启/关闭功能

## 使用方法

### 基本使用

```tsx
import { ReactFlow, useViewport } from 'reactflow';
import { HelperLines, useHelperLines } from '@/MagicFlow/components/HelperLines';

function FlowComponent() {
  const { x, y, zoom } = useViewport();
  const [helperLinesEnabled, setHelperLinesEnabled] = useState(false);
  
  const {
    horizontalLines,
    verticalLines,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    hasHelperLines
  } = useHelperLines({
    nodes,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onNodesChange, // 如果需要节点吸附功能，必须提供此参数
    enabled: helperLinesEnabled, // 控制辅助线功能的开关
  });

  return (
    <>
      {/* 添加一个控制按钮 */}
      <button onClick={() => setHelperLinesEnabled(!helperLinesEnabled)}>
        {helperLinesEnabled ? '禁用辅助线' : '启用辅助线'}
      </button>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={onNodesChange} // 如果需要节点吸附功能，必须提供此参数
        {...otherProps}
      >
        {/* 其他组件 */}
        
        {/* 渲染辅助线 */}
        {hasHelperLines && (
          <HelperLines
            horizontalLines={horizontalLines}
            verticalLines={verticalLines}
            transform={{ x, y, zoom }}
          />
        )}
      </ReactFlow>
    </>
  );
}
```

### 自定义配置

可以通过 `options` 参数自定义辅助线的行为和样式：

```tsx
const {
  horizontalLines,
  verticalLines,
  // ...
} = useHelperLines({
  nodes,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onNodesChange,
  enabled: helperLinesEnabled, // 通过状态控制启用/禁用
  options: {
    threshold: 8,        // 对齐阈值
    color: '#0077ff',    // 辅助线颜色
    lineWidth: 2,        // 辅助线宽度
    zIndex: 10000,       // z-index
    enableSnap: true     // 是否启用节点吸附功能
  }
});
```

然后将这些选项传递给 `HelperLines` 组件：

```tsx
<HelperLines
  horizontalLines={horizontalLines}
  verticalLines={verticalLines}
  transform={{ x, y, zoom }}
  color={options.color}
  lineWidth={options.lineWidth}
  zIndex={options.zIndex}
/>
```

## API 参考

### `useHelperLines` Hook

#### 参数

`useHelperLines` 接受一个配置对象，包含以下属性：

| 属性 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| nodes | Node[] | 是 | React Flow 节点数组 |
| onNodeDragStart | Function | 否 | 原始的节点拖动开始回调 |
| onNodeDrag | Function | 否 | 原始的节点拖动回调 |
| onNodeDragStop | Function | 否 | 原始的节点拖动结束回调 |
| onNodesChange | Function | 否 | 节点变更回调函数，用于实现节点吸附功能 |
| options | HelperLinesOptions | 否 | 辅助线配置选项 |
| enabled | boolean | 否 | 是否启用辅助线功能，默认为 false |

#### 返回值

| 属性 | 类型 | 描述 |
| --- | --- | --- |
| horizontalLines | number[] | 水平辅助线的位置数组 |
| verticalLines | number[] | 垂直辅助线的位置数组 |
| handleNodeDragStart | Function | 节点拖动开始处理函数 |
| handleNodeDrag | Function | 节点拖动处理函数 |
| handleNodeDragStop | Function | 节点拖动结束处理函数 |
| hasHelperLines | boolean | 是否有辅助线需要显示 |
| options | Object | 当前使用的配置选项 |
| enabled | boolean | 当前辅助线功能是否启用 |

### `HelperLines` 组件

#### 属性

| 属性 | 类型 | 必填 | 默认值 | 描述 |
| --- | --- | --- | --- | --- |
| horizontalLines | number[] | 是 | - | 水平辅助线的位置数组 |
| verticalLines | number[] | 是 | - | 垂直辅助线的位置数组 |
| transform | ViewportTransform | 是 | - | 视口变换信息 |
| color | string | 否 | '#ff0071' | 辅助线颜色 |
| lineWidth | number | 否 | 1 | 辅助线宽度 |
| zIndex | number | 否 | 9999 | 辅助线的 z-index |

### 类型定义

```typescript
interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

interface HelperLinesOptions {
  threshold?: number;
  color?: string;
  lineWidth?: number;
  zIndex?: number;
  enableSnap?: boolean;
}
```

## 在控制面板中集成

可以在流程图的控制面板中添加一个开关按钮，用于控制辅助线功能的启用/禁用：

```tsx
// 在控制面板的控制项中添加辅助线控制按钮
const controlItemGroups = [
  // ...其他控制组
  [
    {
      icon: helperLinesEnabled ? (
        <IconRuler stroke={1} color="#FF7D00" />
      ) : (
        <IconRuler stroke={1} />
      ),
      callback: () => setHelperLinesEnabled(!helperLinesEnabled),
      tooltips: `${helperLinesEnabled ? '禁用' : '启用'}辅助线 (Ctrl+H)`,
      helperLinesEnabled,
    },
  ],
];

// 添加快捷键支持
useEffect(() => {
  const handleKeyDown = (event) => {
    // Ctrl+H 或 Command+H 切换辅助线功能
    if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
      event.preventDefault();
      setHelperLinesEnabled(!helperLinesEnabled);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [helperLinesEnabled, setHelperLinesEnabled]);
```

## 实现原理

辅助线功能的核心实现原理：

1. 监听节点拖拽事件
2. 在拖拽过程中，计算当前拖拽节点与其他节点的位置关系
3. 当节点之间的边缘或中心位置接近时（小于设定的阈值），显示对齐参考线
4. 使用绝对定位的元素渲染辅助线，根据视口的缩放和平移计算正确的位置

节点吸附功能的实现原理：

1. 检测到节点接近对齐位置时，计算出精确的对齐坐标
2. 通过`onNodesChange`回调更新节点位置，使节点"吸附"到对齐位置
3. 在多个可能的对齐位置中，优先选择最接近当前拖拽位置的参考线

启用/禁用控制的实现：

1. 使用状态变量`helperLinesEnabled`控制辅助线功能的开关
2. 当功能禁用时，拖拽事件直接传递给原始处理函数，不进行辅助线计算
3. 通过控制面板按钮或快捷键来切换功能的启用状态
4. 当功能启用且有节点对齐时，才渲染辅助线组件

辅助线检查以下对齐方式：

- 水平方向
  - 顶部对齐：节点的顶部边缘与其他节点顶部对齐
  - 底部对齐：节点的底部边缘与其他节点底部对齐
  - 中心对齐：节点的垂直中心线与其他节点的垂直中心线对齐

- 垂直方向
  - 左侧对齐：节点的左侧边缘与其他节点左侧对齐
  - 右侧对齐：节点的右侧边缘与其他节点右侧对齐
  - 中心对齐：节点的水平中心线与其他节点的水平中心线对齐 

## 示例

### 带开关控制的完整示例

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  useViewport 
} from 'reactflow';
import { HelperLines, useHelperLines } from '@/MagicFlow/components/HelperLines';
import { IconRuler } from '@tabler/icons-react';
import 'reactflow/dist/style.css';

const initialNodes = [
  {
    id: '1',
    type: 'default',
    data: { label: '节点 1' },
    position: { x: 250, y: 5 },
  },
  // ... 其他节点
];

const initialEdges = [
  // ... 边定义
];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { x, y, zoom } = useViewport();
  const [helperLinesEnabled, setHelperLinesEnabled] = useState(false);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // 使用辅助线hook
  const {
    horizontalLines,
    verticalLines,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    hasHelperLines,
  } = useHelperLines({
    nodes,
    onNodesChange,
    enabled: helperLinesEnabled,
    options: {
      threshold: 8,
      color: '#ff0071',
      enableSnap: true
    }
  });
  
  // 添加快捷键支持
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+H 或 Command+H 切换辅助线功能
      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        setHelperLinesEnabled(!helperLinesEnabled);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [helperLinesEnabled]);

  return (
    <div style={{ height: '100%' }}>
      {/* 控制面板 */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
        <button
          onClick={() => setHelperLinesEnabled(!helperLinesEnabled)}
          style={{
            background: helperLinesEnabled ? '#ff7d00' : '#ffffff',
            color: helperLinesEnabled ? '#ffffff' : '#000000',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
          }}
          title={`${helperLinesEnabled ? '禁用' : '启用'}辅助线 (Ctrl+H)`}
        >
          <IconRuler size={20} stroke={1.5} />
        </button>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
        
        {/* 渲染辅助线 */}
        {hasHelperLines && (
          <HelperLines
            horizontalLines={horizontalLines}
            verticalLines={verticalLines}
            transform={{ x, y, zoom }}
            color="#ff0071"
            lineWidth={1}
          />
        )}
      </ReactFlow>
    </div>
  );
}
```