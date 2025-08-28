<h1 align="center"> cloud-file ☁️</h1>

<p align="center"> .</p>

## 📖 Introduzione

Questo SDK è una versione avanzata dell'SDK per servizi file, fornisce più funzionalità e maggiore facilità d'uso.

Include chiamate semplificate integrate per Aliyun, Volcano Engine e servizi file, completando operazioni come upload, download, cancellazione file con poche righe di codice.

Supporta modalità di upload diretto backend, ottenendo credenziali temporanee per upload diretto dei file al cloud storage dal backend, riducendo il carico del server.

Configurazione `FilesystemAdapter` sostituibile, personalizzazione più potente.

Estrae funzionalità comuni del servizio file nel pacchetto, utilizzabile senza dipendere dal servizio file.

## 🌐 Cloud Supportati

 - Servizio file proxy per Aliyun, Volcano Engine
 - Aliyun
 - Volcano Engine

## ⚡ Funzionalità Importanti
- [x] Ottieni credenziali temporanee
- [x] Carica file - tramite upload diretto con credenziali temporanee
- [x] Copia file
- [x] Cancella file
- [x] Ottieni link accessibili in batch
- [x] Ottieni metadati file

## ⚠️ Note Importanti
Se vuoi utilizzare Aliyun o Volcano Engine diretti, devi prima installare i FilesystemAdapter corrispondenti, come

```composer
"suggest": {
    "hyperf/logger": "Required to use the Hyperf.",
    "hyperf/di": "Required to use the Hyperf.",
    "hyperf/config": "Required to use the Hyperf.",
    "hyperf/cache": "Required to use the Hyperf.",
    "alibabacloud/sts": "^1.8",
    "aliyuncs/oss-sdk-php": "^2.7",
    "league/flysystem": "^2.0",
    "xxtime/flysystem-aliyun-oss": "^1.6",
    "volcengine/ve-tos-php-sdk": "^2.1",
    "volcengine/volc-sdk-php": "^1.0"
},
```

Oppure nella configurazione config, aggiungere il parametro driver, cioè FilesystemAdapter, a causa di problemi di compatibilità delle dipendenze tra pacchetti, potrebbero esserci bug, ma attualmente l'opportunità di utilizzare il servizio file è maggiore, per ora ignoriamo questo, se ci sono problemi li sistemeremo

## 📦 Installazione

```shell
$ composer require dtyq/cloudfile -vvv
```

## ⚙️ Configurazione

```php
$configs = [
    'storages' => [
        // Esempio configurazione servizio file
        'file_service_test' => [
            'adapter' => 'file_service',
            'config' => [
                // Indirizzo servizio file
                'host' => 'xxx',
                // Platform servizio file
                'platform' => 'xxx',
                // Key servizio file
                'key' => 'xxx',
            ],
        ],
        // Esempio configurazione Aliyun
        'aliyun_test' => [
            'adapter' => 'aliyun',
            'config' => [
                'accessId' => 'xxx',
                'accessSecret' => 'xxx',
                'bucket' => 'xxx',
                'endpoint' => 'xxx',
                'role_arn' => 'xxx',
            ],
        ],
        // Esempio configurazione Volcano Engine
        'tos_test' => [
            'adapter' => 'tos',
            'config' => [
                'region' => 'xxx',
                'endpoint' => 'xxx',
                'ak' => 'xxx',
                'sk' => 'xxx',
                'bucket' => 'xxx',
                'trn' => 'xxx',
            ],
        ],
    ],
];

$container = new SdkContainer([
    // Configurazione base SDK
    'sdk_name' => 'easy_file_sdk',
    'exception_class' => CloudFileException::class,·
    // Configurazione cloudfile
    'cloudfile' => $configs,
]);

$cloudFile = new CloudFile($container);
```

## 🔧 Caratteristiche Speciali Servizio File
Poiché è necessario richiedere il servizio file, richiede token dinamico e organization-code, qui deve essere messo nel parametro options, **tutte** le richieste del servizio file devono includerlo, come segue

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
    'cache' => false, // Impostare secondo necessità, suggerito false per debug facile
];

```

## 🚀 Uso

### Ottieni Credenziali Temporanee

```php
$filesystem = $cloudFile->get('file_service_test');

$credentialPolicy = new CredentialPolicy([
    'sts' => false,
    'roleSessionName' => 'test',
]);
$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$data = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
```

### 上传文件 - 通过临时凭证直传
上传完成后，记得查看`$uploadFile->getKey()`，来获取上传后的文件实际路径（因为文件服务会拼接 组织/应用 前缀）

```php
$filesystem = $cloudFile->get('file_service_test');

$credentialPolicy = new CredentialPolicy([
    'sts' => false,
]);

$realPath = __DIR__ . '/../test.txt';

$uploadFile = new UploadFile($realPath, 'easy-file');
$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$filesystem->uploadByCredential($uploadFile, $credentialPolicy, $options);
```

### 复制文件

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
// 复制文件成功后，要获取这个 path 结果才是真实地址，因为文件服务会有权限处理
$path = $filesystem->duplicate('easy-file/test.txt', 'easy-file/test-copy.txt', $options);
```

### 删除文件

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$filesystem->destroy('easy-file/test.txt', $options);
```

### 批量获取可访问链接
> 请求文件服务时，不检测是否存在，直接返回链接
```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getLinks([
    'easy-file/file-service.txt',
    'easy-file/test.txt',
], [], 7200, $options);
```

### 获取文件元数据

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getMetas([
    'easy-file/file-service.txt',
    'easy-file/test.txt'], $options);
```
## Hyperf 快捷使用

### 发布配置文件
```shell
$ php bin/hyperf.php vendor:publish dtyq/cloudfile
```

### 使用
```php
// 这里可以在构造中注入 CloudFileFactory
$cloudFile = \Hyperf\Support\make(CloudFileFactory::class)->create();

$filesystem = $cloudFile->get('file_service');

$options = [
    // 这里的动态 token 需要自行传入
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getLinks([
    'easy-file/file-service.txt',
    'easy-file/test.txt',
], [], 7200, $options);

$link = $list[0]->getUrl();
```

### Ottieni Credenziali Temporanee

```php
$filesystem = $cloudFile->get('file_service_test');

$credentialPolicy = new CredentialPolicy([
    'sts' => false,
    'roleSessionName' => 'test',
]);
$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$data = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
```

### Carica File - Tramite Upload Diretto con Credenziali Temporanee
Dopo il completamento dell'upload, ricordati di controllare `$uploadFile->getKey()` per ottenere il percorso file effettivo dopo l'upload (perché il servizio file concatenerà il prefisso organizzazione/applicazione)

```php
$filesystem = $cloudFile->get('file_service_test');

$credentialPolicy = new CredentialPolicy([
    'sts' => false,
    'roleSessionName' => 'test',
]);

$realPath = __DIR__ . '/../test.txt';

$uploadFile = new UploadFile($realPath, 'easy-file');
$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$filesystem->uploadByCredential($uploadFile, $credentialPolicy, $options);
```

### Copia File

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
// Dopo la copia riuscita del file, ottenere questo risultato path è l'indirizzo reale, perché il servizio file avrà elaborazione permessi
$path = $filesystem->duplicate('easy-file/test.txt', 'easy-file/test-copy.txt', $options);
```

### Cancella File

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$filesystem->destroy('easy-file/test.txt', $options);
```

### Ottieni Link Accessibili in Batch
> Quando richiedi il servizio file, non verifica l'esistenza, restituisce direttamente il link
```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getLinks([
    'easy-file/file-service.txt',
    'easy-file/test.txt',
], [], 7200, $options);
```

### Ottieni Metadati File

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getMetas([
    'easy-file/file-service.txt',
    'easy-file/test.txt'], $options);
```

## ⚡ Uso Rapido Hyperf

### Pubblica File di Configurazione
```shell
$ php bin/hyperf.php vendor:publish dtyq/cloudfile
```

### Uso
```php
// Qui puoi iniettare CloudFileFactory nel costruttore
$cloudFile = \Hyperf\Support\make(CloudFileFactory::class)->create();

$filesystem = $cloudFile->get('file_service');

$options = [
    // Il token dinamico qui deve essere passato autonomamente
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getLinks([
    'easy-file/file-service.txt',
    'easy-file/test.txt',
], [], 7200, $options);

$link = $list[0]->getUrl();
```

---

# cloud-file

## 介绍

本 sdk 为文件服务 sdk 增强版，提供了更多的功能，更加易用。

内置阿里云、火山云、文件服务的简单调用，只需几行代码即可完成文件的上传、下载、删除等操作。

支持后端直传模式，获取临时凭证后，后端直接上传文件到云存储，减少服务器压力。

可替换的`FilesystemAdapter`配置，自定义更强。

抽离文件服务通用功能到包中，可不依赖文件服务即可使用。

## 支持的云

 - 文件服务代理的 阿里云、火山云
 - 阿里云
 - 火山云

## 重要功能
- [x] 获取临时凭证
- [x] 上传文件 - 通过临时凭证直传
- [x] 复制文件
- [x] 删除文件
- [x] 批量获取可访问链接
- [x] 获取文件元数据

## 注意事项
如果要使用直连的阿里云、火山云，要先安装相应的FilesystemAdapter，如

```composer
"suggest": {
    "hyperf/logger": "Required to use the Hyperf.",
    "hyperf/di": "Required to use the Hyperf.",
    "hyperf/config": "Required to use the Hyperf.",
    "hyperf/cache": "Required to use the Hyperf.",
    "alibabacloud/sts": "^1.8",
    "aliyuncs/oss-sdk-php": "^2.7",
    "league/flysystem": "^2.0",
    "xxtime/flysystem-aliyun-oss": "^1.6",
    "volcengine/ve-tos-php-sdk": "^2.1",
    "volcengine/volc-sdk-php": "^1.0"
},
```

或者在 config 配置中，增加driver参数，即FilesystemAdapter，由于包之间依赖兼容性问题，可能会有bug，但目前使用文件服务服务的机会比较多，先不管这个了，有问题再改改

## 安装

```shell
$ composer require dtyq/cloudfile -vvv
```

## 配置

```php
$configs = [
    'storages' => [
        // 文件服务配置示例
        'file_service_test' => [
            'adapter' => 'file_service',
            'config' => [
                // 文件服务地址
                'host' => 'xxx',
                // 文件服务的 platform
                'platform' => 'xxx',
                // 文件服务的 key
                'key' => 'xxx',
            ],
        ],
        // 阿里云配置示例
        'aliyun_test' => [
            'adapter' => 'aliyun',
            'config' => [
                'accessId' => 'xxx',
                'accessSecret' => 'xxx',
                'bucket' => 'xxx',
                'endpoint' => 'xxx',
                'role_arn' => 'xxx',
            ],
        ],
        // 火山云配置示例
        'tos_test' => [
            'adapter' => 'tos',
            'config' => [
                'region' => 'xxx',
                'endpoint' => 'xxx',
                'ak' => 'xxx',
                'sk' => 'xxx',
                'bucket' => 'xxx',
                'trn' => 'xxx',
            ],
        ],
    ],
];

$container = new SdkContainer([
    // sdk 基本配置
    'sdk_name' => 'easy_file_sdk',
    'exception_class' => CloudFileException::class,·
    // cloudfile 配置
    'cloudfile' => $configs,
]);

$cloudFile = new CloudFile($container);
```

## 文件服务特殊性
因为要请求文件服务，是需要动态 token 和 organization-code 的，这里需要放到 options 参数中，**所有**文件服务的请求，都需要带上，如下

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
    'cache' => false, // 根据需要设置，建议 false，方便调试
];

```

## 使用

### 获取临时凭证

```php
$filesystem = $cloudFile->get('file_service_test');

$credentialPolicy = new CredentialPolicy([
    'sts' => false,
    'roleSessionName' => 'test',
]);
$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$data = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
```

### 上传文件 - 通过临时凭证直传
上传完成后，记得查看`$uploadFile->getKey()`，来获取上传后的文件实际路径（因为文件服务会拼接 组织/应用 前缀）

```php
$filesystem = $cloudFile->get('file_service_test');

$credentialPolicy = new CredentialPolicy([
    'sts' => false,
    'roleSessionName' => 'test',
]);

$realPath = __DIR__ . '/../test.txt';

$uploadFile = new UploadFile($realPath, 'easy-file');
$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$filesystem->uploadByCredential($uploadFile, $credentialPolicy, $options);
```

### 复制文件

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
// 复制文件成功后，要获取这个 path 结果才是真实地址，因为文件服务会有权限处理
$path = $filesystem->duplicate('easy-file/test.txt', 'easy-file/test-copy.txt', $options);
```

### 删除文件

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$filesystem->destroy('easy-file/test.txt', $options);
```

### 批量获取可访问链接
> 请求文件服务时，不检测是否存在，直接返回链接
```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getLinks([
    'easy-file/file-service.txt',
    'easy-file/test.txt',
], [], 7200, $options);
```

### 获取文件元数据

```php
$filesystem = $cloudFile->get('file_service_test');

$options = [
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getMetas([
    'easy-file/file-service.txt',
    'easy-file/test.txt'], $options);
```

## Hyperf 快捷使用

### 发布配置文件
```shell
$ php bin/hyperf.php vendor:publish dtyq/cloudfile
```

### 使用
```php
// 这里可以在构造中注入 CloudFileFactory
$cloudFile = \Hyperf\Support\make(CloudFileFactory::class)->create();

$filesystem = $cloudFile->get('file_service');

$options = [
    // 这里的动态 token 需要自行传入
    'token' => 'xxx',
    'organization-code' => 'xxx',
];
$list = $filesystem->getLinks([
    'easy-file/file-service.txt',
    'easy-file/test.txt',
], [], 7200, $options);

$link = $list[0]->getUrl();
```
