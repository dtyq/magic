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
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
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
        foreach ($data['list'] ?? [] as $item) {
            if (empty($item['path']) || empty($item['url']) || empty($item['expires']) || empty($item['file_name'])) {
                continue;
            }
            $list[$item['file_name']] = new FilePreSignedUrl(
                $item['file_name'],
                $item['url'],
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
        // Process image options to maintain consistency with OSS/TOS
        if (isset($options['image'])) {
            // Support new ImageProcessOptions object
            if ($options['image'] instanceof ImageProcessOptions) {
                // Convert to operation array format expected by file service backend
                //  will use the appropriate TOS/OSS processor based on platform
                $operations = $this->convertImageOptionsToOperations($options['image']);
                if (! empty($operations)) {
                    $options['image'] = $operations;
                } else {
                    unset($options['image']);
                }
            }
            // Legacy format support: ['image']['process'] string
            elseif (! empty($options['image']['process'])) {
                // Keep legacy format as-is for backward compatibility
            }
            // Legacy format support: array of operations [['type' => '...', 'params' => [...]]]
            elseif (is_array($options['image'])) {
                // Keep legacy array format as-is for backward compatibility
            }
        }

        $list = $this->fileServiceApi->getUrls($paths, $downloadNames, $expires, $options);
        $links = [];
        foreach ($list as $item) {
            if (empty($item['file_path']) || empty($item['url']) || empty($item['expires'])) {
                continue;
            }
            $links[$item['file_path']] = new FileLink($item['file_path'], $item['url'], $item['expires'], $item['download_name'] ?? '');
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
     * Convert ImageProcessOptions to operations array format for file service backend.
     * The backend will handle platform-specific conversion using OSS/TOS processors.
     */
    private function convertImageOptionsToOperations(ImageProcessOptions $imageOptions): array
    {
        $operations = [];
        $data = $imageOptions->toArray();

        foreach ($data as $key => $value) {
            $operation = $this->buildOperation($key, $value);
            if ($operation !== null) {
                $operations[] = $operation;
            }
        }

        return $operations;
    }

    /**
     * Build a single operation array.
     */
    private function buildOperation(string $type, mixed $value): ?array
    {
        // Map of operation types
        $typeMap = [
            'resize' => 'resize',
            'quality' => 'quality',
            'format' => 'format',
            'rotate' => 'rotate',
            'crop' => 'crop',
            'circle' => 'circle',
            'roundedCorners' => 'rounded-corners',
            'indexcrop' => 'indexcrop',
            'watermark' => 'watermark',
            'blur' => 'blur',
            'sharpen' => 'sharpen',
            'bright' => 'bright',
            'contrast' => 'contrast',
            'info' => 'info',
            'averageHue' => 'average-hue',
            'autoOrient' => 'auto-orient',
            'interlace' => 'interlace',
        ];

        if (! isset($typeMap[$type])) {
            return null;
        }

        $params = [];

        if (is_array($value)) {
            // For complex operations like resize, crop, watermark
            $params = $this->convertComplexParams($value);
        } else {
            // For simple single-value operations
            $params = $this->convertSimpleParam($type, $value);
        }

        return [
            'type' => $typeMap[$type],
            'params' => $params,
        ];
    }

    /**
     * Convert complex parameters (arrays).
     */
    private function convertComplexParams(array $params): array
    {
        $paramMap = [
            'width' => 'w',
            'height' => 'h',
            'mode' => 'm',
            'limit' => 'l',
            'short' => 's',
            'percentage' => 'p',
            'x' => 'x',
            'y' => 'y',
            'gravity' => 'g',
            'radius' => 'r',
            'sigma' => 's',
            'axis' => 'a',
            'length' => 'l',
            'index' => 'i',
            'type' => 't',
            'content' => 'c',
            'position' => 'p',
            'transparency' => 'tr',
            'size' => 's',
            'color' => 'co',
            'font' => 'f',
        ];

        $result = [];
        foreach ($params as $key => $value) {
            $shortKey = $paramMap[$key] ?? $key;
            $result[$shortKey] = $value;
        }

        return $result;
    }

    /**
     * Convert simple parameters (single values).
     */
    private function convertSimpleParam(string $type, mixed $value): array
    {
        // File service backend expects specific parameter names for different operations
        $paramNameMap = [
            'quality' => 'q',
            'format' => 'value',
            'rotate' => 'value',
            'circle' => 'r',
            'roundedCorners' => 'r',
            'sharpen' => 'value',
            'bright' => 'value',
            'contrast' => 'value',
            'autoOrient' => 'value',
            'interlace' => 'value',
        ];

        $paramName = $paramNameMap[$type] ?? 'value';
        return [$paramName => $value];
    }
}
