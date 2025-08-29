# ⏳ Nodo Attesa

Il nodo attesa è utilizzato per sospendere l'esecuzione del flusso fino al termine della durata specificata o al soddisfacimento di condizioni particolari.

## 📋 Panoramica

Il nodo attesa permette di controllare il tempo di esecuzione del flusso, utile per limitazione velocità, polling o coordinamento con sistemi esterni.

## ⚙️ Configurazione

### Impostazioni Base

- **Nome**: Identificatore univoco del nodo
- **Descrizione**: Descrizione opzionale dello scopo del nodo
- **Tipo**: Impostato su "attesa" (sola lettura)

### Impostazioni Attesa

1. **Tipo Attesa**
   - Durata fissa
   - Fino al soddisfacimento condizione
   - Fino all'ora specificata
   - Fino all'occorrenza evento

2. **Impostazioni Durata**
   - Valore tempo
   - Unità tempo (secondi, minuti, ore)
   - Intervallo casuale (opzionale)

3. **Impostazioni Condizione**
   - Espressione
   - Tempo timeout
   - Opzioni retry

## 💡 Esempi di Utilizzo

### Attesa Durata Fissa

```javascript
// Esempio configurazione nodo attesa per durata fissa
{
  "type": "wait",
  "config": {
    "waitType": "duration",
    "duration": 30,
    "unit": "seconds"
  }
}
```

### Attesa Condizione

```javascript
// Esempio configurazione nodo attesa per condizione
{
  "type": "wait",
  "config": {
    "waitType": "condition",
    "condition": "${context.data.status} === 'ready'",
    "timeout": 300,
    "retryInterval": 10
  }
}
```

## 🌟 Migliori Pratiche

1. **Gestione Timeout**
   - Impostare tempo timeout appropriato
   - Gestire scenari timeout
   - Registrare eventi timeout

2. **Gestione Risorse**
   - Evitare tempi attesa troppo lunghi
   - Utilizzare intervalli appropriati
   - Monitorare risorse sistema

3. **Gestione Errori**
   - Gestire errori valutazione condizione
   - Registrare eventi attesa
   - Fornire comportamento di fallback

## ❓ Problemi Comuni

1. **Problemi Timeout**
   - Controllare sintassi condizione
   - Validare valori timeout
   - Monitorare carico sistema

2. **Esaurimento Risorse**
   - Limitare attese concorrenti
   - Utilizzare intervalli appropriati
   - Monitorare risorse sistema

## 🔗 Nodi Correlati

- [Nodo Iniziale](./start-node.md)
- [Nodo Risposta](./reply-node.md)
- [Nodo Finale](./end-node.md)

---

# 等待节点

等待节点用于暂停流程的执行，直到指定的持续时间结束或满足特定条件。

## 概述

等待节点允许您控制流程执行的时间，这对于速率限制、轮询或与外部系统协调非常有用。

## 配置

### 基本设置

- **名称**：节点的唯一标识符
- **描述**：节点用途的可选描述
- **类型**：设置为"等待"（只读）

### 等待设置

1. **等待类型**
   - 固定持续时间
   - 直到条件满足
   - 直到指定时间
   - 直到事件发生

2. **持续时间设置**
   - 时间值
   - 时间单位（秒、分钟、小时）
   - 随机范围（可选）

3. **条件设置**
   - 表达式
   - 超时时间
   - 重试选项

## 使用示例

### 固定持续时间等待

```javascript
// 固定持续时间的等待节点配置示例
{
  "type": "wait",
  "config": {
    "waitType": "duration",
    "duration": 30,
    "unit": "seconds"
  }
}
```

### 条件等待

```javascript
// 条件等待的等待节点配置示例
{
  "type": "wait",
  "config": {
    "waitType": "condition",
    "condition": "${context.data.status} === 'ready'",
    "timeout": 300,
    "retryInterval": 10
  }
}
```

## 最佳实践

1. **超时处理**
   - 设置适当的超时时间
   - 处理超时场景
   - 记录超时事件

2. **资源管理**
   - 避免过长的等待时间
   - 使用适当的间隔
   - 监控系统资源

3. **错误处理**
   - 处理条件评估错误
   - 记录等待事件
   - 提供后备行为

## 常见问题

1. **超时问题**
   - 检查条件语法
   - 验证超时值
   - 监控系统负载

2. **资源耗尽**
   - 限制并发等待
   - 使用适当的间隔
   - 监控系统资源

## 相关节点

- [开始节点](./start-node.md)
- [回复节点](./reply-node.md)
- [结束节点](./end-node.md) 