<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel;

use Dtyq\CloudFile\Kernel\Driver\ExpandInterface;
use Dtyq\CloudFile\Kernel\Driver\FileService\FileServiceApi;
use Dtyq\CloudFile\Kernel\Exceptions\ChunkDownloadException;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FileMetadata;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload\AliyunSimpleUpload;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload\FileServiceSimpleUpload;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload\ObsSimpleUpload;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload\TosSimpleUpload;
use Dtyq\SdkBase\SdkBase;
use League\Flysystem\Filesystem;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\PathNormalizer;

class FilesystemProxy extends Filesystem
{
    private string $adapterName;

    private ExpandInterface $expand;

    private SdkBase $container;

    private array $config;

    private bool $isPublicRead = false;

    private string $publicDomain = '';

    private array $options = [];

    private array $simpleUploadsMap = [
        AdapterName::ALIYUN => AliyunSimpleUpload::class,
        AdapterName::TOS => TosSimpleUpload::class,
        AdapterName::OBS => ObsSimpleUpload::class,
        AdapterName::FILE_SERVICE => FileServiceSimpleUpload::class,
    ];

    private array $simpleUploadInstances = [];

    public function __construct(
        SdkBase $container,
        string $adapterName,
        FilesystemAdapter $adapter,
        array $config = [],
        ?PathNormalizer $pathNormalizer = null
    ) {
        $this->container = $container;
        $this->adapterName = AdapterName::form($adapterName);
        $this->config = $config;
        $this->expand = $this->createExpand($this->adapterName, $config);
        $this->initSimpleUpload();
        parent::__construct($adapter, $config, $pathNormalizer);
    }

    /**
     * 上传文件.
     */
    public function upload(UploadFile $uploadFile, array $config = []): string
    {
        $key = $uploadFile->getKeyPath();

        $stream = fopen($uploadFile->getRealPath(), 'r+');
        if (! is_resource($stream)) {
            throw new CloudFileException("file stream is not resource | [{$uploadFile->getName()}]");
        }
        $contents = '';
        while (! feof($stream)) {
            $contents .= fread($stream, 8192);
        }
        fclose($stream);
        $this->write($key, $contents, $config);
        $uploadFile->setKey($key);
        return $key;
    }

    /**
     * 上传文件 - 通过临时凭证直传.
     */
    public function uploadByCredential(UploadFile $uploadFile, CredentialPolicy $credentialPolicy, array $options = []): void
    {
        $credentialPolicy->setSts(false);
        $credentialPolicy->setContentType($uploadFile->getMimeType());
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $this->getSimpleUploadInstance($this->adapterName)->uploadObject($credential, $uploadFile);
        $uploadFile->release();
    }

    /**
     * Upload file by chunks using STS credentials.
     *
     * @param ChunkUploadFile $chunkUploadFile Chunk upload file object
     * @param CredentialPolicy $credentialPolicy Credential policy
     * @param array $options Additional options
     * @throws CloudFileException
     */
    public function uploadByChunks(ChunkUploadFile $chunkUploadFile, CredentialPolicy $credentialPolicy, array $options = []): void
    {
        // Force STS mode for chunk upload
        $credentialPolicy->setSts(true);
        $credentialPolicy->setContentType($chunkUploadFile->getMimeType());

        // Get STS temporary credentials
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);

        // Call platform-specific chunk upload implementation
        $this->getSimpleUploadInstance($this->adapterName)->uploadObjectByChunks($credential, $chunkUploadFile);

        // Release file resources
        $chunkUploadFile->release();
    }

    /**
     * 追加上传文件 - 通过临时凭证直传.
     */
    public function appendUploadByCredential(AppendUploadFile $appendUploadFile, CredentialPolicy $credentialPolicy, array $options = []): void
    {
        $credentialPolicy->setSts(true);
        $credentialPolicy->setContentType($appendUploadFile->getMimeType());
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $this->getSimpleUploadInstance($this->adapterName)->appendUploadObject($credential, $appendUploadFile);
        $appendUploadFile->release();
    }

    /**
     * 列举对象 - 通过临时凭证.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $prefix 对象前缀过滤
     * @param array $options 额外选项 (marker, max-keys等)
     * @return array 对象列表
     */
    public function listObjectsByCredential(CredentialPolicy $credentialPolicy, string $prefix = '', array $options = []): array
    {
        $credentialPolicy->setSts(true);
        $credentialPolicy->setStsType('list_objects');
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        return $this->getSimpleUploadInstance($this->adapterName)->listObjectsByCredential($credential, $prefix, $options);
    }

    /**
     * 删除对象 - 通过临时凭证.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $objectKey 要删除的对象键
     * @param array $options 额外选项
     */
    public function deleteObjectByCredential(CredentialPolicy $credentialPolicy, string $objectKey, array $options = []): void
    {
        $credentialPolicy->setSts(true);
        $credentialPolicy->setStsType('del_objects');
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $object = $this->getSimpleUploadInstance($this->adapterName);
        $object->deleteObjectByCredential($credential, $objectKey, $options);
    }

    /**
     * 拷贝对象 - 通过临时凭证.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $sourceKey 源对象键
     * @param string $destinationKey 目标对象键
     * @param array $options 额外选项
     */
    public function copyObjectByCredential(CredentialPolicy $credentialPolicy, string $sourceKey, string $destinationKey, array $options = []): void
    {
        $credentialPolicy->setSts(true);
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $this->getSimpleUploadInstance($this->adapterName)->copyObjectByCredential($credential, $sourceKey, $destinationKey, $options);
    }

    /**
     * 获取上传临时凭证
     */
    public function getUploadTemporaryCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        $isCache = (bool) ($options['cache'] ?? true);
        $cacheKey = $credentialPolicy->uniqueKey($options);
        if ($isCache && $data = $this->getCache($cacheKey)) {
            return $data;
        }
        $credential = $this->expand->getUploadCredential($credentialPolicy, $options);

        $platform = $credential['platform'] ?? $this->adapterName;
        $expires = $credential['expires'] ?? time() + $credentialPolicy->getExpires();
        $temporaryCredential = $credential['temporary_credential'] ?? $credential;
        $data = [
            'platform' => $platform,
            'temporary_credential' => $temporaryCredential,
            'expires' => (int) $expires,
        ];
        $cacheTtl = max(0, (int) ($expires - time() - 60));
        $cacheTtl = max($cacheTtl, 1);
        $this->setCache($cacheKey, $data, $cacheTtl);
        return $data;
    }

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(array $fileNames, int $expires = 3600, array $options = []): array
    {
        return $this->expand->getPreSignedUrls($fileNames, $expires, $options);
    }

    /**
     * 获取文件元数据.
     * @return array<FileMetadata>
     */
    public function getMetas(array $paths, array $options = []): array
    {
        return $this->expand->getMetas($this->formatPaths($paths), $options);
    }

    /**
     * 获取文件链接.
     * @return array<FileLink>
     */
    public function getLinks(array $paths, array $downloadNames = [], int $expires = 3600, array $options = []): array
    {
        $paths = $this->formatPaths($paths);
        // 如果是公共读，直接返回拼接好的链接
        $list = [];
        if ($this->isPublicRead && ! empty($this->publicDomain) && empty($downloadNames)) {
            foreach ($paths as $path) {
                $list[$path] = new FileLink($path, $this->publicDomain . '/' . $path, $expires);
            }
            return $list;
        }
        $isCache = (bool) ($options['cache'] ?? true);
        unset($options['cache']);
        $unCachePaths = $paths;
        if ($isCache) {
            foreach ($paths as $path) {
                $cacheKey = md5($path . serialize($downloadNames[$path] ?? '') . $expires . serialize($options));
                if ($data = $this->getCache($cacheKey)) {
                    if ($data instanceof FileLink) {
                        $list[$path] = $data;
                        $unCachePaths = array_diff($unCachePaths, [$path]);
                    }
                }
            }
        }
        if (! empty($unCachePaths)) {
            $unCachePaths = array_values($unCachePaths);
            $unCachePathsData = $this->expand->getFileLinks($unCachePaths, $downloadNames, $expires, $options);
            foreach ($unCachePathsData as $path => $data) {
                if (! $data instanceof FileLink) {
                    continue;
                }
                if ($this->isPublicRead) {
                    $noSignUrlParsed = parse_url($data->getUrl());
                    $port = '';
                    if (! empty($noSignUrlParsed['port'])) {
                        $port = ':' . $noSignUrlParsed['port'];
                    }
                    $noSignUrl = $noSignUrlParsed['scheme'] . '://' . $noSignUrlParsed['host'] . $port . $noSignUrlParsed['path'];
                    $data->setUrl($noSignUrl);
                    // 首次加载时，设置公共域名
                    $this->publicDomain = $noSignUrlParsed['scheme'] . '://' . $noSignUrlParsed['host'] . $port;
                }
                $list[$path] = $data;
                $cacheKey = md5($path . serialize($downloadNames[$path] ?? '') . $expires . serialize($options));
                $this->setCache($cacheKey, $data, $expires - 60);
            }
        }
        return $list;
    }

    /**
     * 删除文件.
     */
    public function destroy(array $paths, array $options = []): void
    {
        $this->expand->destroy($paths, $options);
    }

    /**
     * 复制文件.
     */
    public function duplicate(string $source, string $destination, array $options = []): string
    {
        return $this->expand->duplicate($source, $destination, $options);
    }

    /**
     * 获取对象元数据 - 通过临时凭证.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $objectKey 对象键
     * @param array $options 额外选项
     * @return array 对象元数据
     * @throws CloudFileException
     */
    public function getHeadObjectByCredential(CredentialPolicy $credentialPolicy, string $objectKey, array $options = []): array
    {
        $credentialPolicy->setSts(true);
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        return $this->getSimpleUploadInstance($this->adapterName)->getHeadObjectByCredential($credential, $objectKey, $options);
    }

    /**
     * 创建对象 - 通过临时凭证.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $objectKey 对象键
     * @param array $options 额外选项 (content, content_type等)
     */
    public function createObjectByCredential(CredentialPolicy $credentialPolicy, string $objectKey, array $options = []): void
    {
        $credentialPolicy->setSts(true);
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $this->getSimpleUploadInstance($this->adapterName)->createObjectByCredential($credential, $objectKey, $options);
    }

    /**
     * 获取预签名URL - 通过临时凭证.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $objectKey 对象键
     * @param array $options 额外选项 (method, expires, filename等)
     * @return string 预签名URL
     */
    public function getPreSignedUrlByCredential(CredentialPolicy $credentialPolicy, string $objectKey, array $options = []): string
    {
        $credentialPolicy->setSts(true);
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        return $this->getSimpleUploadInstance($this->adapterName)->getPreSignedUrlByCredential($credential, $objectKey, $options);
    }

    /**
     * Delete multiple objects by credential.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param array $objectKeys 要删除的对象键数组
     * @param array $options 额外选项
     * @return array 删除结果，包含成功和错误信息
     */
    public function deleteObjectsByCredential(CredentialPolicy $credentialPolicy, array $objectKeys, array $options = []): array
    {
        $credentialPolicy->setSts(true);
        $credentialPolicy->setStsType('del_objects');
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        return $this->getSimpleUploadInstance($this->adapterName)->deleteObjectsByCredential($credential, $objectKeys, $options);
    }

    /**
     * Set object metadata by credential.
     *
     * @param CredentialPolicy $credentialPolicy 凭证策略
     * @param string $objectKey 对象键
     * @param array $metadata 要设置的元数据
     * @param array $options 额外选项
     */
    public function setHeadObjectByCredential(CredentialPolicy $credentialPolicy, string $objectKey, array $metadata, array $options = []): void
    {
        $credentialPolicy->setSts(true);
        $credentialPolicy->setStsType('set_object_meta');
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $this->getSimpleUploadInstance($this->adapterName)->setHeadObjectByCredential($credential, $objectKey, $metadata, $options);
    }

    /**
     * Download file by chunks.
     *
     * @param string $filePath Remote file path
     * @param string $localPath Local file path to save
     * @param null|ChunkDownloadConfig $config Download configuration
     * @param array $options Additional options
     * @throws ChunkDownloadException
     */
    public function downloadByChunks(string $filePath, string $localPath, ?ChunkDownloadConfig $config = null, array $options = []): void
    {
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'magic',
            'dir' => '',
        ]);

        $platform = $this->config['platform'] ?? $this->adapterName;
        $credential = $this->getUploadTemporaryCredential($credentialPolicy, $options);
        $expandConfig = $this->createExpandConfigByCredential($platform, $credential);
        $config = $config ?? ChunkDownloadConfig::createDefault();
        $expandObject = $this->createExpand($platform, $expandConfig);
        $expandObject->downloadByChunks($filePath, $localPath, $config, $options);
    }

    public function setIsPublicRead(bool $isPublicRead): void
    {
        $this->isPublicRead = $isPublicRead;
    }

    public function setOptions(array $options): void
    {
        $this->options = $options;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    protected function initSimpleUpload(): void
    {
        foreach ($this->simpleUploadsMap as $platform => $simpleUploadClass) {
            if (! isset($this->simpleUploadInstances[$platform])) {
                $this->simpleUploadInstances[$platform] = new $simpleUploadClass($this->container);
            }
        }
    }

    protected function getSimpleUploadInstance(string $platform): SimpleUpload
    {
        if (! isset($this->simpleUploadInstances[$platform])) {
            throw new CloudFileException("adapter not found | [{$this->adapterName}]");
        }
        return $this->simpleUploadInstances[$platform];
    }

    private function setCache(string $key, $value, int $ttl): void
    {
        $this->container->getCache()->set($this->uniqueKey() . '_' . $key, $value, $ttl);
    }

    private function getCache(string $key): mixed
    {
        return $this->container->getCache()->get($this->uniqueKey() . '_' . $key);
    }

    private function formatPaths(array $paths): array
    {
        $filePaths = [];
        foreach ($paths as $path) {
            if (str_contains($path, '%')) {
                $path = str_replace('%', '%25', $path);
            }
            $filePaths[] = $path;
        }
        return $filePaths;
    }

    private function createExpand(string $adapterName, array $config = []): ExpandInterface
    {
        switch ($adapterName) {
            case AdapterName::ALIYUN:
                return new Driver\OSS\OSSExpand($config);
            case AdapterName::TOS:
                return new Driver\TOS\TOSExpand($config);
            case AdapterName::FILE_SERVICE:
                $fileServiceApi = new FileServiceApi($this->container, $config);
                return new Driver\FileService\FileServiceExpand($fileServiceApi);
            case AdapterName::LOCAL:
                return new Driver\Local\LocalExpand($config);
            default:
                throw new CloudFileException("expand not found | [{$adapterName}]");
        }
    }

    private function createExpandConfigByCredential(string $adapterName, array $credential): array
    {
        switch ($adapterName) {
            case AdapterName::TOS:
                $tempCred = $credential['temporary_credential'];
                $credentials = $tempCred['credentials'];
                return [
                    'region' => $tempCred['region'],
                    'endpoint' => $tempCred['endpoint'],
                    'ak' => $credentials['AccessKeyId'],
                    'sk' => $credentials['SecretAccessKey'],
                    'securityToken' => $credentials['SessionToken'], // STS token for temporary access
                    'bucket' => $tempCred['bucket'],
                ];
            case AdapterName::ALIYUN:
                $temp = $credential['temporary_credential'];
                $region = $temp['region'];
                $actualRegion = str_replace('oss-', '', $region);
                return [
                    'accessId' => $temp['access_key_id'],
                    'accessSecret' => $temp['access_key_secret'],
                    'securityToken' => $temp['sts_token'],
                    'endpoint' => 'https://oss-' . $actualRegion . '.aliyuncs.com',
                    'bucket' => $temp['bucket'],
                    'timeout' => 3600,
                    'connectTimeout' => 10,
                ];
            default:
                throw new CloudFileException("expand not found | [{$adapterName}]");
        }
    }

    private function uniqueKey(): string
    {
        return 'cloudfile:' . md5($this->adapterName . serialize($this->config));
    }
}
