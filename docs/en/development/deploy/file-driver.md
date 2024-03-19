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