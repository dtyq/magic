<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\FileService;

use Dtyq\CloudFile\Kernel\Driver\ExpandInterface;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FileMetadata;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use League\Flysystem\FileAttributes;

class FileServiceExpand implements ExpandInterface
{
    private FileServiceApi $fileServiceApi;

    public function __construct(FileServiceApi $fileServiceApi)
    {
        $this->fileServiceApi = $fileServiceApi;
    }

    public function getUploadCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        return $this->fileServiceApi->getTemporaryCredential($credentialPolicy, $options);
    }

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(array $fileNames, int $expires = 3600, array $options = []): array
    {
        $data = $this->fileServiceApi->getPreSignedUrls($fileNames, $expires, $options);
        $list = [];
        $useInternal = $options['use_internal_endpoint'] ?? false;

        foreach ($data['list'] ?? [] as $item) {
            if (empty($item['path']) || empty($item['url']) || empty($item['expires']) || empty($item['file_name'])) {
                continue;
            }

            $url = $item['url'];
            // Convert to internal endpoint if requested
            if ($useInternal) {
                $platform = $this->detectPlatformFromUrl($url);
                $url = EasyFileTools::convertToInternalEndpoint($url, $platform, true);
            }

            $list[$item['file_name']] = new FilePreSignedUrl(
                $item['file_name'],
                $url,
                $item['headers'] ?? [],
                $item['expires'],
                $item['path']
            );
        }
        return $list;
    }

    public function getMetas(array $paths, array $options = []): array
    {
        $list = $this->fileServiceApi->show($paths, $options);
        $metas = [];
        foreach ($list as $item) {
            if (empty($item['name']) || empty($item['file_path']) || empty($item['metadata'])) {
                continue;
            }
            $metas[$item['file_path']] = new FileMetadata(
                $item['name'],
                $item['file_path'],
                new FileAttributes(
                    $item['file_path'],
                    $item['metadata']['file_size'] ?? 0,
                    $item['metadata']['visibility'] ?? null,
                    $item['metadata']['last_modified'] ?? null,
                    $item['metadata']['mime_type'] ?? null,
                    $item['metadata']['extra_metadata'] ?? [],
                )
            );
        }
        return $metas;
    }

    public function getFileLinks(array $paths, array $downloadNames = [], int $expires = 3600, array $options = []): array
    {
        $list = $this->fileServiceApi->getUrls($paths, $downloadNames, $expires, $options);
        $links = [];
        $useInternal = $options['use_internal_endpoint'] ?? false;

        foreach ($list as $item) {
            if (empty($item['file_path']) || empty($item['url']) || empty($item['expires'])) {
                continue;
            }

            $url = $item['url'];
            // Convert to internal endpoint if requested
            if ($useInternal) {
                $platform = $this->detectPlatformFromUrl($url);
                $url = EasyFileTools::convertToInternalEndpoint($url, $platform, true);
            }

            $links[$item['file_path']] = new FileLink($item['file_path'], $url, $item['expires'], $item['download_name'] ?? '');
        }
        return $links;
    }

    public function destroy(array $paths, array $options = []): void
    {
        $this->fileServiceApi->destroy($paths, $options);
    }

    public function duplicate(string $source, string $destination, array $options = []): string
    {
        return $this->fileServiceApi->copy($source, $destination, $options);
    }

    public function downloadByChunks(string $filePath, string $localPath, ChunkDownloadConfig $config, array $options = []): void
    {
        throw new CloudFileException('暂不支持');
    }

    /**
     * Detect cloud platform from URL to determine correct endpoint conversion.
     *
     * @param string $url The URL to analyze
     * @return string Platform identifier (aliyun, tos, obs, etc.)
     */
    private function detectPlatformFromUrl(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (! $host) {
            return 'unknown';
        }

        // Alibaba Cloud OSS patterns
        if (strpos($host, '.aliyuncs.com') !== false) {
            return 'aliyun';
        }

        // ByteDance TOS patterns
        if (strpos($host, '.volces.com') !== false || strpos($host, '.ivolces.com') !== false) {
            return 'tos';
        }

        // Huawei Cloud OBS patterns
        if (strpos($host, '.myhuaweicloud.com') !== false) {
            return 'obs';
        }

        return 'unknown';
    }
}
