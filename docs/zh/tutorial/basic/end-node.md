# 🏁 Nodo Finale

Il nodo finale è utilizzato per terminare l'esecuzione del flusso. È l'ultimo nodo nel flusso, che segna il completamento del flusso.

## 📋 Panoramica

Il nodo finale è utilizzato per chiudere correttamente l'esecuzione del flusso, assicurando che tutte le risorse siano pulite e il flusso sia terminato correttamente.

## ⚙️ Configurazione

### Impostazioni Base

- **Nome**: Identificatore univoco del nodo
- **Descrizione**: Descrizione opzionale dello scopo del nodo
- **Tipo**: Impostato su "finale" (sola lettura)

### Impostazioni Finale

1. **Stato Completamento**
   - Successo
   - Fallimento
   - Stato personalizzato

2. **Opzioni Pulizia**
   - Pulizia risorse
   - Chiusura connessioni
   - Cancellazione cache

3. **Opzioni Log**
   - Sommario esecuzione
   - Metriche performance
   - Dettagli errore

## 💡 Esempi di Utilizzo

### Nodo Finale Base

```javascript
// Esempio configurazione nodo finale
{
  "type": "end",
  "config": {
    "status": "success",
    "cleanup": true,
    "logging": {
      "summary": true,
      "metrics": true
    }
  }
}
```

### Nodo Finale Errore

```javascript
// Esempio configurazione nodo finale per gestione errori
{
  "type": "end",
  "config": {
    "status": "failure",
    "errorCode": "${context.error.code}",
    "errorMessage": "${context.error.message}",
    "cleanup": true,
    "logging": {
      "summary": true,
      "errorDetails": true
    }
  }
}
```

## 🌟 Migliori Pratiche

1. **Gestione Risorse**
   - Pulire tutte le risorse
   - Chiudere tutte le connessioni
   - Cancellare dati temporanei

2. **Gestione Errori**
   - Registrare dettagli errore
   - Impostare stato appropriato
   - Includere contesto errore

3. **Monitoraggio Performance**
   - Registrare tempo esecuzione
   - Tracciare utilizzo risorse
   - Monitorare stato completamento

## ❓ Problemi Comuni

1. **Perdita Risorse**
   - Verificare esecuzione pulizia
   - Controllare chiusura connessioni
   - Monitorare utilizzo risorse

2. **Terminazione Incompleta**
   - Controllare processi in sospeso
   - Verificare completamento pulizia
   - Monitorare risorse sistema

## 🔗 Nodi Correlati

- [Nodo Iniziale](./start-node.md)
- [Nodo Risposta](./reply-node.md)
- [Nodo Attesa](./wait-node.md)

---

# 结束节点

结束节点用于终止流程执行。它是流程中的最后一个节点，标志着流程的完成。

## 概述

结束节点用于正确关闭流程执行，确保所有资源都被清理，并且流程被正确终止。

## 配置

### 基本设置

- **名称**：节点的唯一标识符
- **描述**：节点用途的可选描述
- **类型**：设置为"结束"（只读）

### 结束设置

1. **完成状态**
   - 成功
   - 失败
   - 自定义状态

2. **清理选项**
   - 资源清理
   - 连接关闭
   - 缓存清除

3. **日志选项**
   - 执行摘要
   - 性能指标
   - 错误详情

## 使用示例

### 基本结束节点

```javascript
// 结束节点配置示例
{
  "type": "end",
  "config": {
    "status": "success",
    "cleanup": true,
    "logging": {
      "summary": true,
      "metrics": true
    }
  }
}
```

### 错误结束节点

```javascript
// 错误处理的结束节点配置示例
{
  "type": "end",
  "config": {
    "status": "failure",
    "errorCode": "${context.error.code}",
    "errorMessage": "${context.error.message}",
    "cleanup": true,
    "logging": {
      "summary": true,
      "errorDetails": true
    }
  }
}
```

## 最佳实践

1. **资源管理**
   - 清理所有资源
   - 关闭所有连接
   - 清除临时数据

2. **错误处理**
   - 记录错误详情
   - 设置适当的状态
   - 包含错误上下文

3. **性能监控**
   - 记录执行时间
   - 跟踪资源使用情况
   - 监控完成状态

## 常见问题

1. **资源泄漏**
   - 验证清理执行
   - 检查连接关闭
   - 监控资源使用情况

2. **不完整终止**
   - 检查挂起的进程
   - 验证清理完成
   - 监控系统资源

## 相关节点

- [开始节点](./start-node.md)
- [回复节点](./reply-node.md)
- [等待节点](./wait-node.md) 