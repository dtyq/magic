# Componente di Flusso 🚀

## Uso Base 📖

```jsx
import { BaseFlow } from '@/MagicFlow/examples';
import React,{ useState, useCallback } from "react"


export default () => {
    return <BaseFlow />
}
```

<!-- ### Parametri Personalizzati

```jsx
import { SecondFlow } from '@/MagicFlow/examples';
import React,{ useState, useCallback } from "react"


export default () => {
    return <SecondFlow />
}
``` -->

## Apertura Modale 🪟

```jsx
import { BaseFlowModal } from '@/MagicFlow/examples';
import React,{ useState, useCallback } from "react";
import { Button } from "antd";


export default () => {

    const [open, setOpen] = useState(false)

    return <>
        <Button onClick={() => setOpen(true)}>Apri</Button>
        <BaseFlowModal open={open} onClose={() => setOpen(false)}/>
    </>
}
```

## Testo Originale
# 流程组件

## 基本使用


```jsx
import { BaseFlow } from '@/MagicFlow/examples';
import React,{ useState, useCallback } from "react"


export default () => {
    return <BaseFlow />
}
```

<!-- ### 自定义参数


```jsx
import { SecondFlow } from '@/MagicFlow/examples';
import React,{ useState, useCallback } from "react"


export default () => {
    return <SecondFlow />
}
``` -->

## 弹窗打开


```jsx
import { BaseFlowModal } from '@/MagicFlow/examples';
import React,{ useState, useCallback } from "react";
import { Button } from "antd";


export default () => {

    const [open, setOpen] = useState(false)

    return <>
        <Button onClick={() => setOpen(true)}>打开</Button>
        <BaseFlowModal open={open} onClose={() => setOpen(false)}/>
    </>
}
```

