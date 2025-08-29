# Spiegazione del Meccanismo di Sicurezza JWT

## Panoramica

Questo progetto ha implementato un meccanismo di sicurezza JWT avanzato, realizzando un'autenticazione completamente stateless, **rimuovendo completamente la dipendenza da Redis e cache in memoria**.

## Caratteristiche Principali

### 1. Gestione Unificata delle Chiavi
- La chiave JWT viene ottenuta dalla variabile d'ambiente `MAGIC_GATEWAY_API_KEY`
- Semplifica la gestione delle chiavi, richiede solo l'impostazione di una variabile d'ambiente
- Genera automaticamente un identificatore di versione della chiave per il rilevamento della rotazione delle chiavi

### 2. Claims JWT Avanzati
```go
type JWTClaims struct {
    jwt.RegisteredClaims
    ContainerID string `json:"container_id"`
    MagicUserID string `json:"magic_user_id,omitempty"`
    MagicOrganizationCode string `json:"magic_organization_code,omitempty"`
    TokenVersion int64 `json:"token_version"`        // Versione del token
    CreatedAt int64 `json:"created_at"`              // Ora di creazione
    KeyID string `json:"kid,omitempty"`              // Identificatore versione chiave
    Nonce string `json:"nonce,omitempty"`            // Protezione anti-replay
    Scope string `json:"scope,omitempty"`            // Ambito delle autorizzazioni
}
```

### 3. Meccanismo di Verifica della Sicurezza
- **Verifica della versione della chiave**: Garantisce che il token utilizzi la versione corretta della chiave
- **Verifica dell'ambito delle autorizzazioni**: Limita l'ambito di utilizzo del token
- **Meccanismo di revoca globale**: Supporta la revoca di tutti i token
- **Protezione anti-replay**: Ogni token contiene un numero casuale univoco

### 4. Autenticazione Completamente Stateless
- **Senza Redis**: Rimossa completamente la dipendenza da Redis
- **Senza cache in memoria**: Rimossa tutta la logica di storage in memoria
- **JWT self-contained**: Il JWT stesso contiene tutte le informazioni necessarie
- **Supporta scalabilità orizzontale**: Il servizio può essere distribuito completamente stateless

## Configurazione delle Variabili d'Ambiente

```bash
# Deve essere impostata, utilizzata per la firma JWT e la verifica della chiave API
export MAGIC_GATEWAY_API_KEY="your-strong-secret-key-at-least-32-characters"

# Opzionale: modalità debug
export MAGIC_GATEWAY_DEBUG="true"
```

## Endpoint API

### 1. Ottenere il Token
```bash
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-strong-secret-key-at-least-32-characters" \
  -H "X-USER-ID: user123" \
  -H "magic-user-id: magic123" \
  -H "magic-organization-code: org123"
```

Esempio di risposta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "header": "Magic-Authorization",
  "example": "Magic-Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "note": "Assicurati di aggiungere il prefisso Bearer quando utilizzi il token, altrimenti il gateway lo aggiungerà automaticamente",
  "security": "Il token include protezione anti-replay e controllo versione chiave"
}
```

### 2. Revocare Tutti i Token
```bash
curl -X POST http://localhost:8000/revoke-all \
  -H "Magic-Authorization: Bearer your-token-here"
```

### 3. Visualizzare lo Stato
```bash
curl http://localhost:8000/status
```

Esempio di risposta:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "auth_mode": "stateless_jwt",
  "token_validity": "30天",
  "env_vars_available": ["OPENAI_API_BASE_URL", "MAGIC_API_KEY", ...],
  "services_available": ["OPENAI", "MAGIC", "DEEPSEEK"],
  "current_token_version": 5,
  "global_revoke_timestamp": 0,
  "jwt_key_id": "a1b2c3d4",
  "jwt_algorithm": "HS256"
}
```

## Vantaggi di Sicurezza

1. **Gestione unificata delle chiavi**: Necessario gestire solo una chiave
2. **Controllo versione chiave**: Può rilevare se la chiave è stata modificata
3. **Protezione anti-replay**: Ogni token ha un numero casuale univoco
4. **Controllo ambito autorizzazioni**: Limita l'ambito di utilizzo del token
5. **Verifica algoritmo**: Garantisce l'uso dell'algoritmo di firma corretto
6. **Revoca globale**: Supporta la revoca una tantum di tutti i token
7. **Completamente stateless**: Nessuna dipendenza da storage esterno

## Utilizzo del Token

```bash
# Utilizzare il token per accedere all'API
curl http://localhost:8000/env \
  -H "Magic-Authorization: Bearer your-token-here"

# O utilizzare l'header Authorization standard
curl http://localhost:8000/env \
  -H "Authorization: Bearer your-token-here"
```

## Note di Attenzione

1. **Robustezza della chiave**: Si consiglia di utilizzare una chiave forte di almeno 32 caratteri
2. **Rotazione delle chiavi**: Il sistema rileva il tempo di utilizzo della chiave, si consiglia la rotazione periodica
3. **Scadenza del token**: Il token ha validità di 30 giorni, scade automaticamente
4. **Meccanismo di revoca**: Utilizzare l'endpoint `/revoke-all` per revocare tutti i token
5. **Modalità debug**: Impostare `MAGIC_GATEWAY_DEBUG=true` per visualizzare i log dettagliati
6. **Distribuzione stateless**: Il servizio può essere distribuito completamente stateless, senza Redis

## Guida alla Migrazione

### Migrazione dalla Versione Precedente

1. **Impostare le variabili d'ambiente**:
   ```bash
   export MAGIC_GATEWAY_API_KEY="your-strong-secret-key"
   ```

2. **Rimuovere le vecchie configurazioni**:
   - Non più necessaria la variabile d'ambiente `JWT_SECRET`
   - Non più necessarie le configurazioni Redis
   - Non più necessarie le dipendenze Redis

3. **Aggiornare le dipendenze**:
   ```bash
   # Rimuovere le dipendenze Redis
   go mod tidy
   ```

4. **Aggiornare i client**:
   - Il formato del token rimane invariato
   - La logica di verifica rimane invariata
   - Aggiunte nuove informazioni di sicurezza nell'header

### Verifica della Migrazione

```bash
# 1. Ottenere un nuovo token
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-strong-secret-key-at-least-32-characters" \
  -H "X-USER-ID: test-user"

# 2. Utilizzare il token per accedere all'API
curl http://localhost:8000/status \
  -H "Magic-Authorization: Bearer your-token"

# 3. Verificare le informazioni di stato
curl http://localhost:8000/status
```

## Risoluzione dei Problemi

### Problemi Comuni

1. **Errore chiave**:
   ```
   Errore: È necessario impostare la variabile d'ambiente MAGIC_GATEWAY_API_KEY
   ```
   Soluzione: Impostare la variabile d'ambiente corretta

2. **Verifica token fallita**:
   ```
   La versione chiave del token non corrisponde
   ```
   Soluzione: Verificare se la chiave è stata modificata, riottenere il token

3. **Errore ambito autorizzazioni**:
   ```
   L'ambito delle autorizzazioni del token non è valido
   ```
   Soluzione: Utilizzare il token corretto, assicurarsi che Scope sia "api_gateway"

4. **Token revocato**:
   ```
   Il token è stato revocato globalmente
   ```
   Soluzione: Riottenere il token, o verificare se è stata eseguita un'operazione di revoca globale

## Vantaggi Architetturali

### Vantaggi dopo la Rimozione di Redis

1. **Semplificazione del deployment**: Non necessario server Redis
2. **Riduzione dei costi**: Ridotte le dipendenze infrastrutturali
3. **Maggiore affidabilità**: Ridotti i punti di guasto singolo
4. **Miglioramento delle prestazioni**: Nessuna chiamata di rete per verificare il token
5. **Semplificazione della manutenzione**: Ridotta la complessità di configurazione
6. **Supporto cloud-native**: Completamente stateless, adatto al deployment containerizzato

---

# JWT安全机制说明

## 概述

本项目已实施增强的JWT安全机制，实现了完全无状态认证，**完全移除了对Redis和内存缓存的依赖**。

## 主要特性

### 1. 统一密钥管理
- JWT密钥从 `MAGIC_GATEWAY_API_KEY` 环境变量获取
- 简化了密钥管理，只需要设置一个环境变量
- 自动生成密钥版本标识用于密钥轮换检测

### 2. 增强的JWT Claims
```go
type JWTClaims struct {
    jwt.RegisteredClaims
    ContainerID string `json:"container_id"`
    MagicUserID string `json:"magic_user_id,omitempty"`
    MagicOrganizationCode string `json:"magic_organization_code,omitempty"`
    TokenVersion int64 `json:"token_version"`        // 令牌版本
    CreatedAt int64 `json:"created_at"`              // 创建时间
    KeyID string `json:"kid,omitempty"`              // 密钥版本标识
    Nonce string `json:"nonce,omitempty"`            // 防重放攻击
    Scope string `json:"scope,omitempty"`            // 权限范围
}
```

### 3. 安全验证机制
- **密钥版本验证**: 确保令牌使用正确的密钥版本
- **权限范围验证**: 限制令牌的使用范围
- **全局吊销机制**: 支持吊销所有令牌
- **防重放攻击**: 每个令牌包含唯一的随机数

### 4. 完全无状态认证
- **无需Redis**: 完全移除了Redis依赖
- **无需内存缓存**: 移除了所有内存存储逻辑
- **JWT自包含**: JWT本身包含所有必要信息
- **支持水平扩展**: 服务可以完全无状态部署

## 环境变量配置

```bash
# 必须设置，用于JWT签名和API密钥验证
export MAGIC_GATEWAY_API_KEY="your-strong-secret-key-at-least-32-characters"

# 可选：调试模式
export MAGIC_GATEWAY_DEBUG="true"
```

## API端点

### 1. 获取令牌
```bash
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-strong-secret-key-at-least-32-characters" \
  -H "X-USER-ID: user123" \
  -H "magic-user-id: magic123" \
  -H "magic-organization-code: org123"
```

响应示例：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "header": "Magic-Authorization",
  "example": "Magic-Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "note": "请确保在使用令牌时添加Bearer前缀，否则网关将自动添加",
  "security": "令牌包含防重放保护和密钥版本控制"
}
```

### 2. 吊销所有令牌
```bash
curl -X POST http://localhost:8000/revoke-all \
  -H "Magic-Authorization: Bearer your-token-here"
```

### 3. 查看状态
```bash
curl http://localhost:8000/status
```

响应示例：
```json
{
  "status": "ok",
  "version": "1.0.0",
  "auth_mode": "stateless_jwt",
  "token_validity": "30天",
  "env_vars_available": ["OPENAI_API_BASE_URL", "MAGIC_API_KEY", ...],
  "services_available": ["OPENAI", "MAGIC", "DEEPSEEK"],
  "current_token_version": 5,
  "global_revoke_timestamp": 0,
  "jwt_key_id": "a1b2c3d4",
  "jwt_algorithm": "HS256"
}
```

## 安全优势

1. **统一密钥管理**: 只需要管理一个密钥
2. **密钥版本控制**: 可以检测密钥是否被更改
3. **防重放攻击**: 每个令牌都有唯一的随机数
4. **权限范围控制**: 限制令牌的使用范围
5. **算法验证**: 确保使用正确的签名算法
6. **全局吊销**: 支持一次性吊销所有令牌
7. **完全无状态**: 无需任何外部存储依赖

## 使用令牌

```bash
# 使用令牌访问API
curl http://localhost:8000/env \
  -H "Magic-Authorization: Bearer your-token-here"

# 或者使用标准Authorization头
curl http://localhost:8000/env \
  -H "Authorization: Bearer your-token-here"
```

## 注意事项

1. **密钥强度**: 建议使用至少32字符的强密钥
2. **密钥轮换**: 系统会检测密钥使用时间，建议定期轮换
3. **令牌过期**: 令牌有效期为30天，会自动过期
4. **吊销机制**: 使用 `/revoke-all` 端点可以吊销所有令牌
5. **调试模式**: 设置 `MAGIC_GATEWAY_DEBUG=true` 可以查看详细日志
6. **无状态部署**: 服务可以完全无状态部署，无需Redis

## 迁移指南

### 从旧版本迁移

1. **设置环境变量**:
   ```bash
   export MAGIC_GATEWAY_API_KEY="your-strong-secret-key"
   ```

2. **移除旧配置**:
   - 不再需要 `JWT_SECRET` 环境变量
   - 不再需要Redis配置
   - 不再需要Redis依赖

3. **更新依赖**:
   ```bash
   # 移除Redis依赖
   go mod tidy
   ```

4. **更新客户端**:
   - 令牌格式保持不变
   - 验证逻辑保持不变
   - 新增了安全头部信息

### 验证迁移

```bash
# 1. 获取新令牌
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-strong-secret-key-at-least-32-characters" \
  -H "X-USER-ID: test-user"

# 2. 使用令牌访问API
curl http://localhost:8000/status \
  -H "Magic-Authorization: Bearer your-token"

# 3. 检查状态信息
curl http://localhost:8000/status
```

## 故障排除

### 常见问题

1. **密钥错误**:
   ```
   错误: 必须设置MAGIC_GATEWAY_API_KEY环境变量
   ```
   解决: 设置正确的环境变量

2. **令牌验证失败**:
   ```
   令牌密钥版本不匹配
   ```
   解决: 检查密钥是否被更改，重新获取令牌

3. **权限范围错误**:
   ```
   令牌权限范围无效
   ```
   解决: 使用正确的令牌，确保Scope为"api_gateway"

4. **令牌已吊销**:
   ```
   令牌已被全局吊销
   ```
   解决: 重新获取令牌，或检查是否执行了全局吊销操作

## 架构优势

### 移除Redis后的优势

1. **简化部署**: 无需Redis服务器
2. **降低成本**: 减少基础设施依赖
3. **提高可靠性**: 减少单点故障
4. **增强性能**: 无需网络调用验证令牌
5. **简化维护**: 减少配置复杂性
6. **支持云原生**: 完全无状态，适合容器化部署
