<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Service;

use App\Domain\File\Constant\DefaultFileBusinessType;
use App\Domain\File\Constant\DefaultFileType;
use App\Domain\File\Constant\FileUploadBusinessCode;
use App\Domain\File\Entity\DefaultFileEntity;
use App\Domain\File\Service\DefaultFileDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\File\Service\FileTemporaryCredentialDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\AdapterName;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Cache\Annotation\Cacheable;
use Psr\SimpleCache\CacheInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Swow\Psr7\Message\UploadedFile;

class FileAppService extends AbstractAppService
{
    public function __construct(
        private readonly FileDomainService $fileDomainService,
        private readonly DefaultFileDomainService $defaultFileDomainService,
        private CacheInterface $cache,
        private readonly FileTemporaryCredentialDomainService $temporaryCredentialDomainService,
    ) {
    }

    public function getSimpleUploadTemporaryCredential(Authenticatable $authorization, string $storage, ?string $contentType = null, bool $sts = false): array
    {
        $dataIsolation = $this->createFileDataIsolation($authorization);
        $data = $this->fileDomainService->getSimpleUploadTemporaryCredential(
            $dataIsolation,
            StorageBucketType::from($storage),
            $contentType,
            $sts,
        );
        // 如果是本地驱动，那么增加一个临时 key
        if ($data['platform'] === AdapterName::LOCAL) {
            $localCredential = 'local_credential:' . IdGenerator::getUniqueId32();
            $this->cache->set(
                $localCredential,
                [
                    'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                    'dir' => $data['temporary_credential']['dir'] ?? '',
                ],
                (int) ($data['expires'] - time()),
            );
            $data['temporary_credential']['credential'] = $localCredential;
        }
        return $data;
    }

    public function getPublicUploadToken(Authenticatable $authorization, string $businessCode, int $expires = 3600): array
    {
        return $this->getStsTemporaryCredentialV2(
            $this->getOrganizationCode($authorization),
            StorageBucketType::Public->value,
            FileUploadBusinessCode::from(strtolower($businessCode))->getDir(),
            $expires,
        );
    }

    public function getPrivateUploadToken(Authenticatable $authorization, string $businessCode, int $expires = 3600): array
    {
        return $this->getStsTemporaryCredentialV2(
            $this->getOrganizationCode($authorization),
            StorageBucketType::Private->value,
            FileUploadBusinessCode::from(strtolower($businessCode))->getDir(),
            $expires,
        );
    }

    public function fileUpload(UploadedFile $file, string $key, string $localCredential): array
    {
        if (! $cacheData = $this->cache->get($localCredential)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'invalid_credential');
        }
        $organizationCode = $cacheData['organization_code'] ?? '';
        $credentialDir = $cacheData['dir'] ?? '';
        if ($credentialDir === '' || ! str_starts_with($key, $credentialDir)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'invalid_credential');
        }

        $fileArray = $file->toArray();
        $uploadFile = new UploadFile($fileArray['tmp_file'], '', $key, false);
        $this->fileDomainService->upload($organizationCode, $uploadFile);
        return [
            'key' => $uploadFile->getKey(),
        ];
    }

    public function publicFileDownload(string $fileKey): ?FileLink
    {
        $orgCode = explode('/', $fileKey, 2)[0] ?? '';
        return $this->fileDomainService->getLink($orgCode, $fileKey, StorageBucketType::Public);
    }

    /**
     * @return array<string, ?FileLink> key, FileLink
     */
    public function publicFileDownloads(array $fileKeys): array
    {
        $result = [];
        foreach ($fileKeys as $fileKey) {
            $orgCode = explode('/', $fileKey, 2)[0] ?? '';
            $result[$fileKey] = $this->fileDomainService->getLink($orgCode, $fileKey, StorageBucketType::Public);
        }
        return $result;
    }

    #[Cacheable(prefix: 'default_icons', ttl: 60)]
    public function getDefaultIcons(): array
    {
        return $this->fileDomainService->getDefaultIcons();
    }

    public function getLink(string $getSenderOrganizationCode, string $key, ?StorageBucketType $bucketType = null, array $downloadNames = [], array $options = []): ?FileLink
    {
        return $this->fileDomainService->getLink($getSenderOrganizationCode, $key, $bucketType, $downloadNames, $options);
    }

    public function getLinks(string $organizationCode, array $fileKeys, ?StorageBucketType $bucketType = null, array $downloadNames = [], array $options = []): array
    {
        return $this->fileDomainService->getLinks($organizationCode, $fileKeys, $bucketType, $downloadNames, $options);
    }

    public function upload(string $getSenderOrganizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null): void
    {
        $this->fileDomainService->uploadByCredential($getSenderOrganizationCode, $uploadFile, $storage, $autoDir, $contentType);
    }

    public function getFileByBusinessType(DefaultFileBusinessType $businessType, string $organizationCode): array
    {
        $organizationFileEntities = $this->defaultFileDomainService->getByOrganizationCodeAndBusinessType($businessType, $organizationCode);
        $defaultFileEntities = $this->defaultFileDomainService->getDefaultFile($businessType);
        $files = array_merge($organizationFileEntities, $defaultFileEntities);

        $keys = array_column($files, 'key');

        // 按组织编码分组文件 keys，参考 ProviderAppService 做法
        $keysByOrg = [];
        foreach ($keys as $key) {
            if (empty($key)) {
                continue;
            }
            $keyOrganizationCode = substr($key, 0, strpos($key, '/'));
            if (! isset($keysByOrg[$keyOrganizationCode])) {
                $keysByOrg[$keyOrganizationCode] = [];
            }
            $keysByOrg[$keyOrganizationCode][] = $key;
        }

        // 批量获取各组织的文件链接
        $allFileLinks = [];
        foreach ($keysByOrg as $orgCode => $orgKeys) {
            $links = $this->fileDomainService->getLinks($orgCode, $orgKeys);
            $allFileLinks = array_merge($allFileLinks, $links);
        }

        $fileObject = [];
        foreach ($files as $file) {
            $key = $file->getKey();
            $fileType = $file->getFileType();
            if (isset($allFileLinks[$key])) {
                $fileObject[] = ['key' => $key, 'url' => $allFileLinks[$key]->getUrl(), 'type' => $fileType];
            } else {
                $fileObject[] = ['key' => $key, 'url' => '', 'type' => $fileType];
            }
        }

        return $fileObject;
    }

    public function uploadBusinessType(MagicUserAuthorization $authorization, string $fileKey, string $businessType): string
    {
        $defaultFileBusinessType = DefaultFileBusinessType::from($businessType);
        $organizationCode = $authorization->getOrganizationCode();

        // 检查文件是否已经存在于该业务类型下
        $existingFile = $this->defaultFileDomainService->getByKeyAndBusinessType($fileKey, $businessType, $organizationCode);
        if ($existingFile) {
            // 如果文件已存在，直接返回文件链接
            return $this->fileDomainService->getLink($organizationCode, $fileKey)->getUrl();
        }

        $metas = $this->fileDomainService->getMetas([$fileKey], $organizationCode);
        $meta = $metas[$fileKey];
        $info = $meta->getFileAttributes();
        $defaultFileEntity = new DefaultFileEntity();
        $defaultFileEntity->setOrganization($organizationCode);
        $defaultFileEntity->setKey($fileKey);
        $defaultFileEntity->setFileSize($info['fileSize']);
        $defaultFileEntity->setFileType(DefaultFileType::NOT_DEFAULT->value);
        $defaultFileEntity->setFileExtension($info['type']);
        $defaultFileEntity->setUserId($authorization->getId());
        $defaultFileEntity->setBusinessType($defaultFileBusinessType->value);
        $this->defaultFileDomainService->insert($defaultFileEntity);
        return $this->fileDomainService->getLink($organizationCode, $fileKey)->getUrl();
    }

    public function deleteBusinessFile(MagicUserAuthorization $authorization, string $fileKey, string $businessType): bool
    {
        if (! DefaultFileBusinessType::tryFrom($businessType)) {
            return false;
        }

        $organizationCode = $authorization->getOrganizationCode();

        // 获取文件信息
        $fileEntity = $this->defaultFileDomainService->getByKey($fileKey);
        if (! $fileEntity) {
            return false;
        }

        // 检查是否为默认文件
        if ($fileEntity->getFileType() === DefaultFileType::DEFAULT->value) {
            return false;
        }

        // 删除文件记录
        return $this->defaultFileDomainService->deleteByKey($fileKey, $organizationCode);
    }

    /**
     * use getStsTemporaryCredentialV2.
     * @deprecated
     */
    public function getStsTemporaryCredential(Authenticatable $authorization, string $storage, string $dir = '', int $expires = 3600, bool $autoBucket = true): array
    {
        $organizationCode = $this->getOrganizationCode($authorization);
        // 调用文件服务获取STS Token
        $data = $this->fileDomainService->getStsTemporaryCredential(
            $organizationCode,
            StorageBucketType::from($storage),
            $dir,
            $expires,
            $autoBucket,
        );

        // 如果是本地驱动，那么增加一个临时 key
        if ($data['platform'] === AdapterName::LOCAL) {
            $localCredential = 'local_credential:' . IdGenerator::getUniqueId32();
            $data['temporary_credential']['dir'] = $organizationCode . '/' . $data['temporary_credential']['dir'];
            $data['temporary_credential']['credential'] = $localCredential;
            $data['temporary_credential']['read_host'] = env('FILE_LOCAL_DOCKER_READ_HOST', 'http://magic-caddy/files');
            $data['temporary_credential']['host'] = env('FILE_LOCAL_DOCKER_WRITE_HOST', '');
            $this->cache->set($localCredential, ['organization_code' => $organizationCode], (int) ($data['expires'] - time()));
        }

        // magic service 服务地址
        $data['magic_service_host'] = config('super-magic.sandbox.callback_host', '');

        return $data;
    }

    public function getStsTemporaryCredentialV2(
        string $organizationCode,
        string $storage,
        string $dir = '',
        int $expires = 3600,
        bool $autoBucket = true,
        array $options = []
    ): array {
        return $this->temporaryCredentialDomainService->getStsTemporaryCredentialV2(
            $organizationCode,
            StorageBucketType::from($storage),
            $dir,
            $expires,
            $autoBucket,
            $options,
        );
    }

    /**
     * 获取同时包含公网和内网 endpoint 的 STS 凭证.
     *
     * 以公网凭证为基底，叠加内网 endpoint / host 字段，供 super-magic 区分使用：
     *  - 下载/上传走内网 endpoint（internal_endpoint / internal_host）
     *  - 生成 presigned URL 走公网 endpoint（endpoint / host）
     *
     * 参数签名与 getStsTemporaryCredentialV2 完全一致，调用方只需替换方法名。
     *
     * @param string $organizationCode 组织编码
     * @param string $storage 存储类型（private/public/sandbox）
     * @param string $dir 上传目录
     * @param int $expires 过期时间（秒）
     * @param bool $autoBucket 是否自动拼接 bucket 前缀
     * @param array $options 额外选项，internal_endpoint 选项会被自动处理
     * @return array 合并后的 STS 凭证，以公网为基底，含 internal_endpoint / internal_host 字段
     */
    public function getDualEndpointStsCredentialV2(
        string $organizationCode,
        string $storage,
        string $dir = '',
        int $expires = 3600,
        bool $autoBucket = true,
        array $options = []
    ): array {
        // 公网调用：去除 internal_endpoint 选项，确保获取公网 endpoint
        $publicOptions = array_diff_key($options, ['internal_endpoint' => true]);

        // 以公网为基底
        $publicSts = $this->getStsTemporaryCredentialV2(
            $organizationCode,
            $storage,
            $dir,
            $expires,
            $autoBucket,
            $publicOptions
        );

        // local 存储没有内网 endpoint 概念，直接返回，避免生成无用的 local credential 污染缓存
        if ($publicSts['platform'] === AdapterName::LOCAL) {
            return $publicSts;
        }

        // 获取内网凭证（仅对云存储有意义）
        $internalSts = $this->getStsTemporaryCredentialV2(
            $organizationCode,
            $storage,
            $dir,
            $expires,
            $autoBucket,
            array_merge($options, ['internal_endpoint' => true])
        );

        // 以公网为基底，叠加内网字段
        $result = $publicSts;
        $result['temporary_credential']['internal_endpoint'] = $internalSts['temporary_credential']['endpoint'] ?? null;
        // TOS 有 host 字段，OSS 和 S3 没有
        if (isset($internalSts['temporary_credential']['host'])) {
            $result['temporary_credential']['internal_host'] = $internalSts['temporary_credential']['host'];
        }
        return $result;
    }

    /**
     * Chunk file upload - dedicated method for large file upload using chunks.
     *
     * @param ChunkUploadFile $chunkUploadFile Chunk upload file object
     * @param string $organizationCode Organization code
     * @return array Upload result
     */
    public function chunkFileUpload(ChunkUploadFile $chunkUploadFile, string $organizationCode): array
    {
        // Perform chunk upload
        $this->fileDomainService->uploadByChunks($organizationCode, $chunkUploadFile);

        return [
            'key' => $chunkUploadFile->getKey(),
            'upload_method' => 'chunk',
            'file_size' => $chunkUploadFile->getSize(),
            'upload_id' => $chunkUploadFile->getUploadId(),
            'chunk_size' => $chunkUploadFile->getChunkConfig()->getChunkSize(),
            'total_chunks' => count($chunkUploadFile->getChunks()),
        ];
    }

    /**
     * Download file using chunk download.
     *
     * @param string $organizationCode Organization code
     * @param string $filePath Remote file path
     * @param string $localPath Local save path
     * @param string $storage Storage type (private/public)
     * @param array $options Additional options (chunk_size, max_concurrency, etc.)
     */
    public function downloadByChunks(string $organizationCode, string $filePath, string $localPath, string $storage = 'private', array $options = []): void
    {
        $storageType = StorageBucketType::from($storage);
        $this->fileDomainService->downloadByChunks($organizationCode, $filePath, $localPath, $storageType, $options);
    }

    protected function getOrganizationCode(Authenticatable $authorization): string
    {
        if (method_exists($authorization, 'getOrganizationCode')) {
            return $authorization->getOrganizationCode();
        }

        ExceptionBuilder::throw(GenericErrorCode::SystemError, 'unknown_authorization_type');
    }
}
