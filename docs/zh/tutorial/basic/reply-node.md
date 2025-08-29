# 💬 Nodo Risposta

Il nodo risposta è utilizzato per inviare risposte a utenti o sistemi esterni. È solitamente utilizzato alla fine del flusso o prima del nodo finale.

## 📋 Panoramica

Il nodo risposta gestisce l'output del flusso, formattando e inviando i dati al destinatario in formato appropriato.

## ⚙️ Configurazione

### Impostazioni Base

- **Nome**: Identificatore univoco del nodo
- **Descrizione**: Descrizione opzionale dello scopo del nodo
- **Tipo**: Impostato su "risposta" (sola lettura)

### Impostazioni Risposta

1. **Formato Risposta**
   - JSON
   - XML
   - Testo semplice
   - HTML
   - Formato personalizzato

2. **Intestazioni Risposta**
   - Content-Type
   - Codice stato
   - Intestazioni personalizzate

3. **Corpo Risposta**
   - Contenuto statico
   - Contenuto dinamico (utilizzando espressioni)
   - Contenuto basato su template

## 💡 Esempi di Utilizzo

### Risposta JSON

```javascript
// Esempio configurazione nodo risposta per risposta JSON
{
  "type": "reply",
  "config": {
    "format": "json",
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "status": "success",
      "data": "${context.processedData}"
    }
  }
}
```

### Risposta HTML

```javascript
// Esempio configurazione nodo risposta per risposta HTML
{
  "type": "reply",
  "config": {
    "format": "html",
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/html"
    },
    "body": "<html><body><h1>${context.title}</h1><p>${context.message}</p></body></html>"
  }
}
```

## 🌟 Migliori Pratiche

1. **Formattazione Risposta**
   - Utilizzare tipo contenuto appropriato
   - Mantenere consistenza formato dati
   - Includere dettagli errore quando necessario

2. **Gestione Errori**
   - Impostare codice stato appropriato
   - Includere messaggio errore
   - Registrare dettagli errore

3. **Performance**
   - Minimizzare dimensione risposta
   - Utilizzare compressione quando appropriato
   - Memorizzare risposta quando possibile

## ❓ Problemi Comuni

1. **Errori Formato**
   - Controllare sintassi JSON/XML
   - Verificare espressioni template
   - Confermare intestazione tipo contenuto

2. **Ritardo Risposta**
   - Ottimizzare elaborazione dati
   - Controllare ritardo rete
   - Monitorare tempo risposta

## 🔗 Nodi Correlati

- [Nodo Iniziale](./start-node.md)
- [Nodo Attesa](./wait-node.md)
- [Nodo Finale](./end-node.md)

---

# 回复节点

回复节点用于向用户或外部系统发送响应。它通常用于流程的末尾或在结束节点之前。

## 概述

回复节点处理流程的输出，以适当的格式格式化并发送数据给接收者。

## 配置

### 基本设置

- **名称**：节点的唯一标识符
- **描述**：节点用途的可选描述
- **类型**：设置为"回复"（只读）

### 响应设置

1. **响应格式**
   - JSON
   - XML
   - 纯文本
   - HTML
   - 自定义格式

2. **响应头**
   - Content-Type
   - 状态码
   - 自定义头

3. **响应体**
   - 静态内容
   - 动态内容（使用表达式）
   - 基于模板的内容

## 使用示例

### JSON 响应

```javascript
// JSON 响应的回复节点配置示例
{
  "type": "reply",
  "config": {
    "format": "json",
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "status": "success",
      "data": "${context.processedData}"
    }
  }
}
```

### HTML 响应

```javascript
// HTML 响应的回复节点配置示例
{
  "type": "reply",
  "config": {
    "format": "html",
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/html"
    },
    "body": "<html><body><h1>${context.title}</h1><p>${context.message}</p></body></html>"
  }
}
```

## 最佳实践

1. **响应格式化**
   - 使用适当的内容类型
   - 保持数据格式一致
   - 需要时包含错误详情

2. **错误处理**
   - 设置适当的状态码
   - 包含错误消息
   - 记录错误详情

3. **性能**
   - 最小化响应大小
   - 适当时使用压缩
   - 可能时缓存响应

## 常见问题

1. **格式错误**
   - 检查 JSON/XML 语法
   - 验证模板表达式
   - 确认内容类型头

2. **响应延迟**
   - 优化数据处理
   - 检查网络延迟
   - 监控响应时间

## 相关节点

- [开始节点](./start-node.md)
- [等待节点](./wait-node.md)
- [结束节点](./end-node.md) 