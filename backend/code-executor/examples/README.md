# Esempi di Utilizzo dell'Esecutore di Codice

Questa directory contiene esempi di utilizzo dell'esecutore di codice, che aiutano a comprendere come integrare e utilizzare la funzionalità di esecuzione del codice nei progetti reali.

## Spiegazione dei File di Esempio

- `aliyun_executor_config.example.php` - File di esempio di configurazione, prima dell'uso deve essere copiato come `aliyun_executor_config.php` e compilato con la configurazione effettiva
- `aliyun_executor_example.php` - Esempio di utilizzo dell'esecutore di codice di Alibaba Cloud Function Compute

## Passi di Utilizzo

### 1. Preparazione del File di Configurazione

```bash
# Copiare il file di esempio di configurazione
cp aliyun_executor_config.example.php aliyun_executor_config.php

# Modificare il file di configurazione, inserire le informazioni del proprio account Alibaba Cloud
vim aliyun_executor_config.php
```

### 2. Eseguire l'Esempio

```bash
# Eseguire l'esempio dell'esecutore di codice Alibaba Cloud
php aliyun_executor_example.php
```

## Spiegazione dell'Output di Esempio

Dopo l'esecuzione dell'esempio, si vedrà un output simile al seguente:

```
=== Esempio Esecutore Alibaba Cloud ===

Creazione del client runtime in corso...
Creazione dell'esecutore in corso...
Inizializzazione dell'ambiente di esecuzione in corso...
Inizializzazione dell'ambiente di esecuzione completata

Esecuzione del codice in corso...

Esecuzione completata!
------------------------------
Output di esecuzione:
Risultato del calcolo: 10 + 7 = 17

Tempo di esecuzione: 123ms
Tempo effettivo: 1034.56ms
Risultato di esecuzione:
```

```json
{
    "sum": 17,
    "a": 10,
    "b": 7,
    "timestamp": 1679876543
}
------------------------------

Eseguire test delle prestazioni? (y/n):
```

## Note Importanti

1. L'utilizzo del servizio Alibaba Cloud Function Compute richiede un account Alibaba Cloud valido e una configurazione corretta
2. L'esecuzione del codice potrebbe generare costi, si prega di controllare l'utilizzo delle risorse
3. Si consiglia di verificare prima in ambiente di test prima di utilizzare in produzione

## Risoluzione dei Problemi

In caso di problemi, verificare:

1. Se le informazioni nel file di configurazione sono corrette
2. Se l'account Alibaba Cloud ha autorizzazioni sufficienti
3. Se il servizio Function Compute è stato attivato
4. Se la connessione di rete è normale

---

# 代码执行器使用示例

本目录包含了代码执行器的使用示例，帮助您理解如何在实际项目中集成和使用代码执行功能。

## 示例文件说明

- `aliyun_executor_config.example.php` - 配置示例文件，使用前需复制为 `aliyun_executor_config.php` 并填入您的实际配置
- `aliyun_executor_example.php` - 阿里云函数计算代码执行器的使用示例

## 使用步骤

### 1. 准备配置文件

```bash
# 复制配置示例文件
cp aliyun_executor_config.example.php aliyun_executor_config.php

# 编辑配置文件，填入您的阿里云账号信息
vim aliyun_executor_config.php
```

### 2. 运行示例

```bash
# 运行阿里云代码执行器示例
php aliyun_executor_example.php
```

## 示例输出说明

运行示例后，您将看到类似以下输出：

```
=== 阿里云代码执行器示例 ===

正在创建运行时客户端...
正在创建执行器...
正在初始化执行环境...
执行环境初始化完成

正在执行代码...

执行完成!
------------------------------
执行输出:
计算结果: 10 + 7 = 17

执行耗时: 123ms
实际耗时: 1034.56ms
执行结果:
```

```json
{
    "sum": 17,
    "a": 10,
    "b": 7,
    "timestamp": 1679876543
}
------------------------------

是否进行性能测试? (y/n):
```

## 注意事项

1. 使用阿里云函数计算服务需要有有效的阿里云账号和正确的配置
2. 代码执行可能产生费用，请注意控制资源使用
3. 建议先在测试环境中进行验证后再用于生产环境

## 故障排除

如果遇到问题，请检查：

1. 配置文件中的信息是否正确
2. 阿里云账号是否有足够的权限
3. 函数计算服务是否已开通
4. 网络连接是否正常
