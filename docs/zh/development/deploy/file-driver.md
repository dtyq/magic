# 文件驱动使用说明

本文档详细介绍 Magic Service 项目中支持的文件存储驱动、配置方法以及使用场景。

## 概述

Magic Service 支持多种文件存储驱动，可根据不同环境和需求灵活配置。目前支持以下三种驱动类型：

1. 本地文件系统（Local）
2. 阿里云对象存储（OSS）
3. 火山引擎对象存储（TOS）

所有文件存储都遵循公有/私有两种访问模式：
- **私有存储**：需要授权才能访问的文件
- **公有存储**：无需授权即可访问的文件

## 配置方法

### 基础配置

首先在 `.env` 文件中设置使用的文件驱动类型：

```
# 文件驱动
FILE_DRIVER=local   # 可选值：local/oss/tos
```

### 本地文件系统驱动 (local)

当 `FILE_DRIVER=local` 时，使用本地文件系统存储文件。

必要配置：
```
# 本地文件驱动配置
FILE_LOCAL_ROOT=    # 本地存储根目录，例如：/app/storage/files
FILE_LOCAL_READ_HOST=     # 文件读取域名，例如：https://example.com
FILE_LOCAL_WRITE_HOST=    # 文件上传域名，例如：https://upload.example.com
```

说明：
- `FILE_LOCAL_ROOT`：指定文件存储的绝对路径，若不配置，默认为项目根目录下的 `storage/files`
- `FILE_LOCAL_READ_HOST`：文件访问的基础URL
- `FILE_LOCAL_WRITE_HOST`：文件上传的基础URL，系统会自动拼接 `/api/v1/file/upload` 作为上传路径

### 阿里云对象存储驱动 (oss)

当 `FILE_DRIVER=oss`时，使用阿里云 OSS 存储文件。

必要配置：
```
# 阿里云文件驱动配置 - 私有 
FILE_PRIVATE_ALIYUN_ACCESS_ID=      # 阿里云 AccessKey ID
FILE_PRIVATE_ALIYUN_ACCESS_SECRET=  # 阿里云 AccessKey Secret
FILE_PRIVATE_ALIYUN_BUCKET=         # OSS 存储桶名称
FILE_PRIVATE_ALIYUN_ENDPOINT=       # OSS 访问域名，例如：oss-cn-hangzhou.aliyuncs.com
FILE_PRIVATE_ALIYUN_ROLE_ARN=       # 可选，用于 STS 临时授权的角色 ARN

# 阿里云文件驱动配置 - 公有
FILE_PUBLIC_ALIYUN_ACCESS_ID=       # 阿里云 AccessKey ID
FILE_PUBLIC_ALIYUN_ACCESS_SECRET=   # 阿里云 AccessKey Secret
FILE_PUBLIC_ALIYUN_BUCKET=          # OSS 存储桶名称
FILE_PUBLIC_ALIYUN_ENDPOINT=        # OSS 访问域名
FILE_PUBLIC_ALIYUN_ROLE_ARN=        # 可选，用于 STS 临时授权的角色 ARN
```

### 火山引擎对象存储驱动 (tos)

当 `FILE_DRIVER=tos` 时，使用火山引擎 TOS 存储文件。

必要配置：
```
# 火山云文件驱动配置 - 私有
FILE_PRIVATE_TOS_REGION=     # TOS 地域，例如：cn-beijing
FILE_PRIVATE_TOS_ENDPOINT=   # TOS 访问域名
FILE_PRIVATE_TOS_AK=         # 火山引擎 AccessKey
FILE_PRIVATE_TOS_SK=         # 火山引擎 SecretKey
FILE_PRIVATE_TOS_BUCKET=     # TOS 存储桶名称
FILE_PRIVATE_TOS_TRN=        # 可选，用于 STS 临时授权的角色 ARN

# 火山云文件驱动配置 - 公有
FILE_PUBLIC_TOS_REGION=      # TOS 地域
FILE_PUBLIC_TOS_ENDPOINT=    # TOS 访问域名
FILE_PUBLIC_TOS_AK=          # 火山引擎 AccessKey
FILE_PUBLIC_TOS_SK=          # 火山引擎 SecretKey
FILE_PUBLIC_TOS_BUCKET=      # TOS 存储桶名称
FILE_PUBLIC_TOS_TRN=         # 可选，用于 STS 临时授权的角色 ARN
```

## 系统初始化

### 默认图标文件

系统预设了一组默认图标文件，位于 `storage/files/MAGIC/open/default/` 目录下。这些图标在系统初始化时会被上传到配置的存储服务中（仅当使用云存储服务时需要上传）。

### 初始化命令

Magic Service 提供了一个命令行工具用于初始化文件系统，尤其是在使用云存储服务时需要执行此命令将默认图标文件上传到云端：

```bash
php bin/hyperf.php file:init
```

命令执行流程：
1. 读取当前配置的存储桶设置
2. 如果是本地文件系统（local），则不需要额外初始化
3. 如果是云存储（oss 或 tos），则将默认图标文件从本地上传到云端存储

### 各驱动初始化特点

- **本地文件系统(local)**：无需特殊初始化，系统默认使用项目中的文件
- **阿里云对象存储(oss)**：需要执行初始化命令将默认图标上传到OSS存储桶
- **火山引擎对象存储(tos)**：需要执行初始化命令将默认图标上传到TOS存储桶

示例输出：
```
公有桶配置：{"adapter":"tos","config":{"region":"cn-beijing","endpoint":"tos-cn-beijing.volces.com","ak":"YOUR_AK","sk":"YOUR_SK","bucket":"magic-public","trn":"YOUR_TRN"},"public_read":true}
本地文件路径：/path/to/project/storage/files/MAGIC/open/default/icon1.png
本地文件路径：/path/to/project/storage/files/MAGIC/open/default/icon2.png
...
文件系统初始化完成
```

## 使用场景与建议

### 本地文件系统 (local)
- 适用于开发环境或小型应用
- 不推荐在生产环境使用，除非有特殊需求
- 优点：配置简单，无需第三方依赖
- 缺点：不支持分布式部署，可靠性和扩展性有限

### 阿里云对象存储 (oss)
- 适用于使用阿里云服务的生产环境
- 优点：稳定可靠，支持CDN加速，数据备份和灾难恢复
- 缺点：需要额外的费用

### 火山引擎对象存储 (tos)
- 适用于使用火山引擎/字节跳动云服务的生产环境
- 优点：与火山引擎其他服务集成度高
- 缺点：需要额外的费用

## 公有与私有存储使用建议

- **公有存储**：适用于不敏感的内容，如网站图片、公开文档等
- **私有存储**：适用于需要保护的内容，如用户上传的私密文件、系统配置文件等

## 配置注意事项

1. 必须确保所有必要的配置项都已正确填写，否则系统将无法正常初始化
2. 对于云存储服务，必须确保配置的AK/SK具有足够的权限进行文件上传操作
3. 初始化命令在系统首次部署时应该运行一次，之后除非切换存储驱动，否则无需再次运行
4. 请确保存储桶（Bucket）已经提前创建，且配置正确的访问策略

## 其他注意事项

1. 在切换文件驱动类型时，需要确保已有文件的迁移计划
2. 阿里云OSS和火山引擎TOS驱动需要确保对应的SDK已安装
3. 开发环境可使用本地文件系统，生产环境建议使用云存储服务
4. 配置不当可能导致文件无法访问或上传失败，使用前请充分测试

## 安全建议

1. 定期更换 AccessKey 和 Secret
2. 为不同环境使用不同的存储桶
3. 对于私有存储，使用签名 URL 限制访问时间（系统默认签名有效期为 259200 秒，约 3 天）
4. 配置适当的跨域访问策略（CORS）
5. 不要在代码仓库中保存敏感的访问凭证，应使用环境变量或密钥管理系统

## 文件系统API使用说明

Magic Service 提供了一套完整的文件操作API，主要通过 `FileDomainService` 类进行调用。以下是常用 API 及其用法：

### 核心服务类

- **FileDomainService**：文件领域服务，提供所有文件操作的高级 API
- **CloudFileRepository**：文件存储库实现，负责与具体存储驱动交互

### 常用方法

#### 获取文件链接

```php
// 注入服务
public function __construct(
    private readonly FileDomainService $fileDomainService
) {}

// 获取单个文件链接
$fileLink = $this->fileDomainService->getLink(
    $organizationCode,  // 组织代码
    $filePath,          // 文件路径
    StorageBucketType::Public  // 存储桶类型（可选）
);

// 访问链接信息
if ($fileLink) {
    $url = $fileLink->getUrl();  // 文件URL
    $path = $fileLink->getPath(); // 文件路径
}

// 批量获取文件链接
$links = $this->fileDomainService->getLinks(
    $organizationCode,   // 组织代码
    [$filePath1, $filePath2],  // 文件路径数组
    StorageBucketType::Private, // 存储桶类型（可选）
    [$downloadName1, $downloadName2] // 下载时的文件名（可选）
);
```

#### 上传文件

```php
// 通过临时凭证上传（推荐用于大文件或前端直传）
$this->fileDomainService->uploadByCredential(
    $organizationCode,  // 组织代码
    new UploadFile(
        $localFilePath,  // 本地文件路径
        $remoteDir,      // 远程目录
        $fileName,       // 文件名
        $isStream        // 是否为流数据
    ),
    StorageBucketType::Private,  // 存储桶类型
    true                // 是否自动生成目录（默认true）
);

// 直接上传（小文件）
$this->fileDomainService->upload(
    $organizationCode,  // 组织代码
    new UploadFile(
        $localFilePath,  // 本地文件路径
        $remoteDir,      // 远程目录
        $fileName,       // 文件名
        $isStream        // 是否为流数据
    ),
    StorageBucketType::Public   // 存储桶类型
);
```

#### 获取预签名URL

```php
// 获取预签名URL（用于临时访问私有文件）
$preSignedUrls = $this->fileDomainService->getPreSignedUrls(
    $organizationCode,  // 组织代码
    [$fileName1, $fileName2],  // 文件名数组
    3600,  // 有效期（秒）
    StorageBucketType::Private  // 存储桶类型
);

// 使用预签名URL
foreach ($preSignedUrls as $fileName => $preSignedUrl) {
    $url = $preSignedUrl->getUrl();  // 预签名URL
    $expiration = $preSignedUrl->getExpiration();  // 过期时间
}
```

#### 获取上传临时凭证

```php
// 获取简单上传临时凭证（用于前端直传）
$credential = $this->fileDomainService->getSimpleUploadTemporaryCredential(
    $organizationCode,  // 组织代码
    StorageBucketType::Private->value  // 存储桶类型
);

// 返回的凭证信息可直接传给前端使用
```

#### 检查文件是否存在

```php
// 获取文件元数据
$metas = $this->fileDomainService->getMetas(
    [$filePath1, $filePath2],  // 文件路径数组
    $organizationCode  // 组织代码
);

// 检查特定文件是否存在
$exists = $this->fileDomainService->exist($metas, $filePath);
```

### 存储桶类型

系统定义了两种存储桶类型：

```php
// 引入枚举类型
use App\Infrastructure\Core\ValueObject\StorageBucketType;

// 公有存储桶（无需认证即可访问）
StorageBucketType::Public

// 私有存储桶（需要签名或认证才能访问）
StorageBucketType::Private
```

### 最佳实践

1. **文件路径命名**：建议使用 `{组织代码}/{业务类型}/{年月}/{文件名}` 的格式，便于管理和查找
2. **大文件处理**：对于大文件，应使用 `uploadByCredential` 方法获取临时凭证，让前端直接上传到存储服务
3. **私有文件访问**：对于私有文件，应使用预签名 URL 或系统生成的临时链接访问
4. **文件类型限制**：在应用层应限制允许上传的文件类型，避免安全风险
5. **异常处理**：所有文件操作应包含适当的异常处理机制，确保系统稳定性

---

如有其他问题，请联系系统管理员或查阅相关云服务商的官方文档。 
