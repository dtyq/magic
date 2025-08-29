# 📁 Guida all'Uso del File Driver

Questo documento fornisce informazioni dettagliate sui driver di archiviazione file supportati nel progetto Magic Service, metodi di configurazione e scenari d'uso.

## ☁️ Panoramica

Magic Service supporta molteplici driver di archiviazione file che possono essere configurati in modo flessibile secondo diversi ambienti e requisiti. Attualmente, supporta i seguenti tre tipi di driver:

1. File System Locale (Local)
2. Archiviazione Oggetto Cloud Alibaba (OSS)
3. Archiviazione Oggetto Cloud ByteDance (TOS)

Tutti gli archivi file seguono due modalità di accesso:
- **Archiviazione Privata**: File che richiedono autorizzazione per l'accesso
- **Archiviazione Pubblica**: File che possono essere accessibili senza autorizzazione

## ⚙️ Metodi di Configurazione

### Configurazione Base

Prima, imposta il tipo di driver file nel file `.env`:

```
# File Driver
FILE_DRIVER=local   # Opzioni: local, oss, tos
```

### Driver File System Locale (local)

Quando `FILE_DRIVER=local`, viene utilizzato il file system locale per l'archiviazione file.

Configurazione richiesta:
```
# Configurazione Driver File Locale
FILE_LOCAL_ROOT=    # Directory radice archiviazione locale, es.: /app/storage/files
FILE_LOCAL_READ_HOST=     # Dominio accesso file, es.: https://example.com
FILE_LOCAL_WRITE_HOST=    # Dominio caricamento file, es.: https://upload.example.com
```

Note:
- `FILE_LOCAL_ROOT`: Specifica il percorso assoluto per l'archiviazione file. Se non configurato, predefinito a `storage/files` sotto la directory radice del progetto
- `FILE_LOCAL_READ_HOST`: URL base per l'accesso ai file
- `FILE_LOCAL_WRITE_HOST`: URL base per il caricamento file. Il sistema aggiunge automaticamente `/api/v1/file/upload` come percorso di caricamento

### Driver Archiviazione Oggetto Cloud Alibaba (oss)

Quando `FILE_DRIVER=oss`, viene utilizzato Alibaba Cloud OSS per l'archiviazione file.

Configurazione richiesta:
```
# Configurazione Driver File Alibaba Cloud - Privata
FILE_PRIVATE_ALIYUN_ACCESS_ID=      # Alibaba Cloud AccessKey ID
FILE_PRIVATE_ALIYUN_ACCESS_SECRET=  # Alibaba Cloud AccessKey Secret
FILE_PRIVATE_ALIYUN_BUCKET=         # Nome Bucket OSS
FILE_PRIVATE_ALIYUN_ENDPOINT=       # Dominio Accesso OSS, es.: oss-cn-hangzhou.aliyuncs.com
FILE_PRIVATE_ALIYUN_ROLE_ARN=       # Opzionale, Role ARN per autorizzazione temporanea STS

# Configurazione Driver File Alibaba Cloud - Pubblica
FILE_PUBLIC_ALIYUN_ACCESS_ID=       # Alibaba Cloud AccessKey ID
FILE_PUBLIC_ALIYUN_ACCESS_SECRET=   # Alibaba Cloud AccessKey Secret
FILE_PUBLIC_ALIYUN_BUCKET=          # Nome Bucket OSS
FILE_PUBLIC_ALIYUN_ENDPOINT=        # Dominio Accesso OSS
FILE_PUBLIC_ALIYUN_ROLE_ARN=        # Opzionale, Role ARN per autorizzazione temporanea STS
```

### Driver Archiviazione Oggetto Cloud ByteDance (tos)

Quando `FILE_DRIVER=tos`, viene utilizzato ByteDance Cloud TOS per l'archiviazione file.

Configurazione richiesta:
```
# Configurazione Driver File ByteDance Cloud - Privata
FILE_PRIVATE_TOS_REGION=     # Regione TOS, es.: cn-beijing
FILE_PRIVATE_TOS_ENDPOINT=   # Dominio Accesso TOS
FILE_PRIVATE_TOS_AK=         # ByteDance Cloud AccessKey
FILE_PRIVATE_TOS_SK=         # ByteDance Cloud SecretKey
FILE_PRIVATE_TOS_BUCKET=     # Nome Bucket TOS
FILE_PRIVATE_TOS_TRN=        # Opzionale, Role ARN per autorizzazione temporanea STS

# Configurazione Driver File ByteDance Cloud - Pubblica
FILE_PUBLIC_TOS_REGION=      # Regione TOS
FILE_PUBLIC_TOS_ENDPOINT=    # Dominio Accesso TOS
FILE_PUBLIC_TOS_AK=          # ByteDance Cloud AccessKey
FILE_PUBLIC_TOS_SK=         # ByteDance Cloud SecretKey
FILE_PUBLIC_TOS_BUCKET=      # Nome Bucket TOS
FILE_PUBLIC_TOS_TRN=         # Opzionale, Role ARN per autorizzazione temporanea STS
```

## 🚀 Inizializzazione Sistema

### File Icona Predefiniti

Il sistema include una serie di file icona predefiniti situati nella directory `storage/files/MAGIC/open/default/`. Queste icone verranno caricate nel servizio di archiviazione configurato durante l'inizializzazione del sistema (richiesto solo quando si utilizzano servizi di archiviazione cloud).

### Comando di Inizializzazione

Magic Service fornisce uno strumento a riga di comando per inizializzare il file system, specialmente quando si utilizzano servizi di archiviazione cloud per caricare file icona predefiniti nel cloud:

```bash
php bin/hyperf.php file:init
```

Processo di esecuzione del comando:
1. Legge la configurazione corrente del bucket di archiviazione
2. Se si utilizza il file system locale (local), non è necessaria ulteriore inizializzazione
3. Se si utilizza archiviazione cloud (oss o tos), carica file icona predefiniti da locale a archiviazione cloud

### Caratteristiche di Inizializzazione per Driver

- **File System Locale (local)**: Non richiesta inizializzazione speciale, il sistema utilizza file di progetto per default
- **Archiviazione Oggetto Cloud Alibaba (oss)**: Richiede comando di inizializzazione per caricare icone predefinite nel bucket OSS
- **Archiviazione Oggetto Cloud ByteDance (tos)**: Richiede comando di inizializzazione per caricare icone predefinite nel bucket TOS

Esempio output:
```
Configurazione bucket pubblico: {"adapter":"tos","config":{"region":"cn-beijing","endpoint":"tos-cn-beijing.volces.com","ak":"YOUR_AK","sk":"YOUR_SK","bucket":"magic-public","trn":"YOUR_TRN"},"public_read":true}
Percorso file locale: /path/to/project/storage/files/MAGIC/open/default/icon1.png
Percorso file locale: /path/to/project/storage/files/MAGIC/open/default/icon2.png
...
Inizializzazione file system completata
```

## 💡 Scenari d'Uso e Raccomandazioni

### File System Locale (local)
- Adatto per ambienti di sviluppo o applicazioni piccole
- Non raccomandato per ambienti di produzione a meno di requisiti speciali
- Vantaggi: Configurazione semplice, nessuna dipendenza da terze parti
- Svantaggi: Nessun supporto per deployment distribuito, affidabilità e scalabilità limitate

### Archiviazione Oggetto Cloud Alibaba (oss)
- Adatto per ambienti di produzione che utilizzano servizi Alibaba Cloud
- Vantaggi: Stabile e affidabile, supporta accelerazione CDN, backup dati e disaster recovery
- Svantaggi: Richiesti costi aggiuntivi

### Archiviazione Oggetto Cloud ByteDance (tos)
- Adatto per ambienti di produzione che utilizzano servizi ByteDance Cloud
- Vantaggi: Alta integrazione con altri servizi ByteDance Cloud
- Svantaggi: Richiesti costi aggiuntivi

## 🔒 Raccomandazioni d'Uso Archiviazione Pubblica e Privata

- **Archiviazione Pubblica**: Adatta per contenuti non sensibili, come immagini sito web, documenti pubblici, ecc.
- **Archiviazione Privata**: Adatta per contenuti protetti, come file privati caricati da utenti, file configurazione sistema, ecc.

## 📝 Note di Configurazione

1. Assicurati che tutti gli elementi di configurazione necessari siano riempiti correttamente, altrimenti il sistema non si inizializzerà correttamente
2. Per servizi di archiviazione cloud, assicurati che l'AK/SK configurato abbia permessi sufficienti per operazioni di caricamento file
3. Il comando di inizializzazione dovrebbe essere eseguito una volta durante il primo deployment del sistema, e necessita di essere eseguito nuovamente solo quando si cambia tipo di driver di archiviazione
4. Assicurati che il bucket di archiviazione (Bucket) sia creato in anticipo con policy di accesso corrette

## ⚠️ Altre Note

1. Quando si cambia tipo di driver file, assicurati di avere un piano di migrazione per file esistenti
2. I driver Alibaba Cloud OSS e ByteDance Cloud TOS richiedono l'installazione dei rispettivi SDK
3. Utilizza file system locale per ambiente di sviluppo, servizi di archiviazione cloud per ambiente di produzione
4. Configurazioni errate possono causare fallimenti nell'accesso o caricamento file, testa accuratamente prima dell'uso

## 🛡️ Raccomandazioni di Sicurezza

1. Ruota regolarmente AccessKey e Secret
2. Utilizza bucket di archiviazione diversi per ambienti diversi
3. Per archiviazione privata, utilizza URL firmati per limitare tempo di accesso (validità firma predefinita sistema è 259200 secondi, circa 3 giorni)
4. Configura policy di accesso cross-origin appropriate (CORS)
5. Non archiviare credenziali di accesso sensibili in repository di codice, utilizza variabili d'ambiente o sistemi di gestione chiavi

## 🔧 Guida all'Uso API File System

Magic Service fornisce un set completo di API per operazioni file, principalmente attraverso la classe `FileDomainService`. Ecco API comuni e loro utilizzo:

### Classi Servizio Core

- **FileDomainService**: Servizio dominio file, fornisce API di alto livello per tutte le operazioni file
- **CloudFileRepository**: Implementazione repository archiviazione file, responsabile dell'interazione con driver di archiviazione specifici

### Metodi Comuni

#### Ottieni Link File

```php
// Inietta servizio
public function __construct(
    private readonly FileDomainService $fileDomainService
) {}

// Ottieni link singolo file
$fileLink = $this->fileDomainService->getLink(
    $organizationCode,  // Codice organizzazione
    $filePath,          // Percorso file
    StorageBucketType::Public  // Tipo bucket archiviazione (opzionale)
);

// Accedi informazioni link
if ($fileLink) {
    $url = $fileLink->getUrl();  // URL file
    $path = $fileLink->getPath(); // Percorso file
}

// Ottieni link file in batch
$links = $this->fileDomainService->getLinks(
    $organizationCode,   // Codice organizzazione
    [$filePath1, $filePath2],  // Array percorsi file
    StorageBucketType::Private, // Tipo bucket archiviazione (opzionale)
    [$downloadName1, $downloadName2] // Nomi file download (opzionale)
);
```

#### Carica File

```php
// Carica tramite credenziali temporanee (raccomandato per file grandi o caricamento diretto frontend)
$this->fileDomainService->uploadByCredential(
    $organizationCode,  // Codice organizzazione
    new UploadFile(
        $localFilePath,  // Percorso file locale
        $remoteDir,      // Directory remota
        $fileName,       // Nome file
        $isStream        // Se è dato stream
    ),
    StorageBucketType::Private,  // Tipo bucket archiviazione
    true                // Se generare automaticamente directory (default true)
);

// Caricamento diretto (file piccoli)
$this->fileDomainService->upload(
    $organizationCode,  // Codice organizzazione
    new UploadFile(
        $localFilePath,  // Percorso file locale
        $remoteDir,      // Directory remota
        $fileName,       // Nome file
        $isStream        // Se è dato stream
    ),
    StorageBucketType::Public   // Tipo bucket archiviazione
);
```

#### Ottieni URL Pre-firmati

```php
// Ottieni URL pre-firmati (per accesso temporaneo a file privati)
$preSignedUrls = $this->fileDomainService->getPreSignedUrls(
    $organizationCode,  // Codice organizzazione
    [$fileName1, $fileName2],  // Array nomi file
    3600,  // Periodo validità (secondi)
    StorageBucketType::Private  // Tipo bucket archiviazione
);

// Utilizza URL pre-firmati
foreach ($preSignedUrls as $fileName => $preSignedUrl) {
    // Utilizza l'URL pre-firmato
} 
```

---

## Testo Originale in Inglese

# File Driver Usage Guide

This document provides detailed information about the file storage drivers supported in the Magic Service project, configuration methods, and usage scenarios.

## Overview

Magic Service supports multiple file storage drivers that can be flexibly configured according to different environments and requirements. Currently, it supports the following three driver types:

1. Local File System (Local)
2. Alibaba Cloud Object Storage (OSS)
3. ByteDance Cloud Object Storage (TOS)

All file storage follows two access modes:
- **Private Storage**: Files that require authorization to access
- **Public Storage**: Files that can be accessed without authorization

## Configuration Methods

### Basic Configuration

First, set the file driver type in the `.env` file:

```
# File Driver
FILE_DRIVER=local   # Options: local, oss, tos
```

### Local File System Driver (local)

When `FILE_DRIVER=local`, the local file system is used for file storage.

Required configuration:
```
# Local File Driver Configuration
FILE_LOCAL_ROOT=    # Local storage root directory, e.g.: /app/storage/files
FILE_LOCAL_READ_HOST=     # File access domain, e.g.: https://example.com
FILE_LOCAL_WRITE_HOST=    # File upload domain, e.g.: https://upload.example.com
```

Notes:
- `FILE_LOCAL_ROOT`: Specifies the absolute path for file storage. If not configured, defaults to `storage/files` under the project root directory
- `FILE_LOCAL_READ_HOST`: Base URL for file access
- `FILE_LOCAL_WRITE_HOST`: Base URL for file upload. The system automatically appends `/api/v1/file/upload` as the upload path

### Alibaba Cloud Object Storage Driver (oss)

When `FILE_DRIVER=oss`, Alibaba Cloud OSS is used for file storage.

Required configuration:
```
# Alibaba Cloud File Driver Configuration - Private
FILE_PRIVATE_ALIYUN_ACCESS_ID=      # Alibaba Cloud AccessKey ID
FILE_PRIVATE_ALIYUN_ACCESS_SECRET=  # Alibaba Cloud AccessKey Secret
FILE_PRIVATE_ALIYUN_BUCKET=         # OSS Bucket Name
FILE_PRIVATE_ALIYUN_ENDPOINT=       # OSS Access Domain, e.g.: oss-cn-hangzhou.aliyuncs.com
FILE_PRIVATE_ALIYUN_ROLE_ARN=       # Optional, Role ARN for STS temporary authorization

# Alibaba Cloud File Driver Configuration - Public
FILE_PUBLIC_ALIYUN_ACCESS_ID=       # Alibaba Cloud AccessKey ID
FILE_PUBLIC_ALIYUN_ACCESS_SECRET=   # Alibaba Cloud AccessKey Secret
FILE_PUBLIC_ALIYUN_BUCKET=          # OSS Bucket Name
FILE_PUBLIC_ALIYUN_ENDPOINT=        # OSS Access Domain
FILE_PUBLIC_ALIYUN_ROLE_ARN=        # Optional, Role ARN for STS temporary authorization
```

### ByteDance Cloud Object Storage Driver (tos)

When `FILE_DRIVER=tos`, ByteDance Cloud TOS is used for file storage.

Required configuration:
```
# ByteDance Cloud File Driver Configuration - Private
FILE_PRIVATE_TOS_REGION=     # TOS Region, e.g.: cn-beijing
FILE_PRIVATE_TOS_ENDPOINT=   # TOS Access Domain
FILE_PRIVATE_TOS_AK=         # ByteDance Cloud AccessKey
FILE_PRIVATE_TOS_SK=         # ByteDance Cloud SecretKey
FILE_PRIVATE_TOS_BUCKET=     # TOS Bucket Name
FILE_PRIVATE_TOS_TRN=        # Optional, Role ARN for STS temporary authorization

# ByteDance Cloud File Driver Configuration - Public
FILE_PUBLIC_TOS_REGION=      # TOS Region
FILE_PUBLIC_TOS_ENDPOINT=    # TOS Access Domain
FILE_PUBLIC_TOS_AK=          # ByteDance Cloud AccessKey
FILE_PUBLIC_TOS_SK=          # ByteDance Cloud SecretKey
FILE_PUBLIC_TOS_BUCKET=      # TOS Bucket Name
FILE_PUBLIC_TOS_TRN=         # Optional, Role ARN for STS temporary authorization
```

## System Initialization

### Default Icon Files

The system includes a set of default icon files located in the `storage/files/MAGIC/open/default/` directory. These icons will be uploaded to the configured storage service during system initialization (only required when using cloud storage services).

### Initialization Command

Magic Service provides a command-line tool for initializing the file system, especially when using cloud storage services to upload default icon files to the cloud:

```bash
php bin/hyperf.php file:init
```

Command execution process:
1. Reads the current storage bucket configuration
2. If using local file system (local), no additional initialization is needed
3. If using cloud storage (oss or tos), uploads default icon files from local to cloud storage

### Initialization Characteristics by Driver

- **Local File System (local)**: No special initialization required, system uses project files by default
- **Alibaba Cloud Object Storage (oss)**: Requires initialization command to upload default icons to OSS bucket
- **ByteDance Cloud Object Storage (tos)**: Requires initialization command to upload default icons to TOS bucket

Example output:
```
Public bucket configuration: {"adapter":"tos","config":{"region":"cn-beijing","endpoint":"tos-cn-beijing.volces.com","ak":"YOUR_AK","sk":"YOUR_SK","bucket":"magic-public","trn":"YOUR_TRN"},"public_read":true}
Local file path: /path/to/project/storage/files/MAGIC/open/default/icon1.png
Local file path: /path/to/project/storage/files/MAGIC/open/default/icon2.png
...
File system initialization completed
```

## Usage Scenarios and Recommendations

### Local File System (local)
- Suitable for development environments or small applications
- Not recommended for production environments unless there are special requirements
- Advantages: Simple configuration, no third-party dependencies
- Disadvantages: No support for distributed deployment, limited reliability and scalability

### Alibaba Cloud Object Storage (oss)
- Suitable for production environments using Alibaba Cloud services
- Advantages: Stable and reliable, supports CDN acceleration, data backup and disaster recovery
- Disadvantages: Additional costs required

### ByteDance Cloud Object Storage (tos)
- Suitable for production environments using ByteDance Cloud services
- Advantages: High integration with other ByteDance Cloud services
- Disadvantages: Additional costs required

## Public and Private Storage Usage Recommendations

- **Public Storage**: Suitable for non-sensitive content, such as website images, public documents, etc.
- **Private Storage**: Suitable for protected content, such as user-uploaded private files, system configuration files, etc.

## Configuration Notes

1. Ensure all necessary configuration items are correctly filled, otherwise the system will fail to initialize properly
2. For cloud storage services, ensure the configured AK/SK has sufficient permissions for file upload operations
3. The initialization command should be run once during the first system deployment, and only needs to be run again when switching storage drivers
4. Ensure the storage bucket (Bucket) is created in advance with correct access policies

## Other Notes

1. When switching file driver types, ensure there is a migration plan for existing files
2. Alibaba Cloud OSS and ByteDance Cloud TOS drivers require their respective SDKs to be installed
3. Use local file system for development environment, cloud storage services for production environment
4. Incorrect configuration may cause file access or upload failures, please test thoroughly before use

## Security Recommendations

1. Regularly rotate AccessKey and Secret
2. Use different storage buckets for different environments
3. For private storage, use signed URLs to limit access time (system default signature validity is 259200 seconds, about 3 days)
4. Configure appropriate cross-origin access policies (CORS)
5. Do not store sensitive access credentials in code repositories, use environment variables or key management systems

## File System API Usage Guide

Magic Service provides a complete set of file operation APIs, mainly through the `FileDomainService` class. Here are common APIs and their usage:

### Core Service Classes

- **FileDomainService**: File domain service, provides high-level APIs for all file operations
- **CloudFileRepository**: File storage repository implementation, responsible for interacting with specific storage drivers

### Common Methods

#### Get File Links

```php
// Inject service
public function __construct(
    private readonly FileDomainService $fileDomainService
) {}

// Get single file link
$fileLink = $this->fileDomainService->getLink(
    $organizationCode,  // Organization code
    $filePath,          // File path
    StorageBucketType::Public  // Storage bucket type (optional)
);

// Access link information
if ($fileLink) {
    $url = $fileLink->getUrl();  // File URL
    $path = $fileLink->getPath(); // File path
}

// Batch get file links
$links = $this->fileDomainService->getLinks(
    $organizationCode,   // Organization code
    [$filePath1, $filePath2],  // File path array
    StorageBucketType::Private, // Storage bucket type (optional)
    [$downloadName1, $downloadName2] // Download file names (optional)
);
```

#### Upload Files

```php
// Upload via temporary credentials (recommended for large files or frontend direct upload)
$this->fileDomainService->uploadByCredential(
    $organizationCode,  // Organization code
    new UploadFile(
        $localFilePath,  // Local file path
        $remoteDir,      // Remote directory
        $fileName,       // File name
        $isStream        // Whether it's stream data
    ),
    StorageBucketType::Private,  // Storage bucket type
    true                // Whether to automatically generate directory (default true)
);

// Direct upload (small files)
$this->fileDomainService->upload(
    $organizationCode,  // Organization code
    new UploadFile(
        $localFilePath,  // Local file path
        $remoteDir,      // Remote directory
        $fileName,       // File name
        $isStream        // Whether it's stream data
    ),
    StorageBucketType::Public   // Storage bucket type
);
```

#### Get Pre-signed URLs

```php
// Get pre-signed URLs (for temporary access to private files)
$preSignedUrls = $this->fileDomainService->getPreSignedUrls(
    $organizationCode,  // Organization code
    [$fileName1, $fileName2],  // File name array
    3600,  // Validity period (seconds)
    StorageBucketType::Private  // Storage bucket type
);

// Use pre-signed URLs
foreach ($preSignedUrls as $fileName => $preSignedUrl) {
    // Use the pre-signed URL
} 
```