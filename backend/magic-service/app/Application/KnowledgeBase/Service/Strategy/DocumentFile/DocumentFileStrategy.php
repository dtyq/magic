<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\DocumentFile;

use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\BaseDocumentFileStrategyInterface;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\ExternalFileDocumentFileStrategyInterface;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\ThirdPlatformDocumentFileStrategyInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ExternalDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;
use Throwable;

class DocumentFileStrategy
{
    protected LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly FileDomainService $fileDomainService,
        private readonly CacheInterface $cache,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function parseContent(KnowledgeBaseDataIsolation $dataIsolation, ?DocumentFileInterface $documentFile, ?string $knowledgeBaseCode = null): string
    {
        $driver = $this->getImplement($documentFile);
        $originContent = $driver?->parseContent($dataIsolation, $documentFile) ?? '';
        // 替换图片
        return $this->replaceImages($originContent, $dataIsolation, $knowledgeBaseCode);
    }

    public function parseDocType(KnowledgeBaseDataIsolation $dataIsolation, ?DocumentFileInterface $documentFile): ?int
    {
        $driver = $this->getImplement($documentFile);
        return $driver?->parseDocType($dataIsolation, $documentFile);
    }

    public function parseThirdPlatformType(KnowledgeBaseDataIsolation $dataIsolation, ?DocumentFileInterface $documentFile): ?string
    {
        $driver = $this->getImplement($documentFile);
        return $driver?->parseThirdPlatformType($dataIsolation, $documentFile);
    }

    public function parseThirdFileId(KnowledgeBaseDataIsolation $dataIsolation, ?DocumentFileInterface $documentFile): ?string
    {
        $driver = $this->getImplement($documentFile);
        return $driver?->parseThirdFileId($dataIsolation, $documentFile);
    }

    /**
     * 预处理文档文件，根据文档文件类型，进行不同的处理.
     */
    public function preProcessDocumentFiles(KnowledgeBaseDataIsolation $dataIsolation, array $documentFiles): array
    {
        // 按类分组
        $groupedFiles = [];
        foreach ($documentFiles as $file) {
            $class = get_class($file);
            $groupedFiles[$class][] = $file;
        }

        $result = [];
        // 对每个分组分别处理
        foreach ($groupedFiles as $class => $files) {
            $driver = $this->getImplement($files[0]);
            if ($driver) {
                $result = array_merge($result, $driver->preProcessDocumentFiles($dataIsolation, $files));
            }
        }

        return $result;
    }

    public function preProcessDocumentFile(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): DocumentFileInterface
    {
        $driver = $this->getImplement($documentFile);
        return $driver?->preProcessDocumentFile($dataIsolation, $documentFile);
    }

    /**
     * 替换内容中的图片为 MagicCompressibleContent 标签.
     */
    private function replaceImages(string $content, KnowledgeBaseDataIsolation $dataIsolation, ?string $knowledgeBaseCode = null): string
    {
        // 匹配所有图片
        $pattern = '/(!\[.*\]\((.*?)\))/';
        $matches = [];
        preg_match_all($pattern, $content, $matches);
        $fullMatches = $matches[1] ?? [];  // 完整的markdown图片语法
        $imageUrls = $matches[2] ?? [];  // 图片URL或base64

        foreach ($imageUrls as $index => $imageUrl) {
            try {
                $md5 = md5($imageUrl);
                $isBase64 = str_starts_with($imageUrl, 'data:image/');

                // 获取缓存key
                $cacheKey = 'knowledge_base:' . $knowledgeBaseCode . ':document_file:image:' . $md5;
                $fileKey = $this->cache->get($cacheKey);

                if (! $fileKey) {
                    // 获取图片内容
                    if ($isBase64) {
                        // 解析base64数据
                        $base64Data = explode(',', $imageUrl);
                        $imageContent = base64_decode($base64Data[1]);
                    } else {
                        // 下载图片
                        $imageContent = file_get_contents($imageUrl);
                        if ($imageContent === false) {
                            throw new RuntimeException('Failed to download image from URL: ' . $imageUrl);
                        }
                    }

                    // 保存临时文件
                    $tempFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . uniqid();
                    file_put_contents($tempFile, $imageContent);

                    // 获取文件扩展名
                    $finfo = finfo_open(FILEINFO_MIME_TYPE);
                    $mimeType = finfo_file($finfo, $tempFile);
                    finfo_close($finfo);
                    $extension = $this->getExtensionFromMimeType($mimeType);

                    // 重命名临时文件
                    $imageName = uniqid() . '.' . $extension;
                    $imagePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $imageName;
                    rename($tempFile, $imagePath);

                    // 创建上传文件对象并上传
                    $uploadFile = new UploadFile($imagePath, 'knowledge-base/' . $knowledgeBaseCode, $imageName);
                    $this->fileDomainService->uploadByCredential(
                        $dataIsolation->getCurrentOrganizationCode(),
                        $uploadFile,
                        autoDir: false,
                    );
                    $fileKey = $uploadFile->getKey();
                    $this->cache->set($cacheKey, $fileKey, 3600);
                }

                // 替换图片链接
                $content = str_replace($fullMatches[$index], '<MagicCompressibleContent Type="Image">![image](magic_knowledge_base_file_' . $fileKey . ')</MagicCompressibleContent>', $content);
            } catch (Throwable $e) {
                $this->logger->error('Failed to process image', [
                    'error' => $e->getMessage(),
                    'url' => $imageUrl,
                ]);
            } finally {
                // 删除临时文件
                if (isset($imagePath) && file_exists($imagePath)) {
                    unlink($imagePath);
                }
                if (isset($tempFile) && file_exists($tempFile)) {
                    unlink($tempFile);
                }
            }
        }

        return $content;
    }

    /**
     * 根据MIME类型获取文件扩展名.
     */
    private function getExtensionFromMimeType(string $mimeType): string
    {
        $mimeMap = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/bmp' => 'bmp',
            'image/svg+xml' => 'svg',
            'image/x-icon' => 'ico',
        ];

        return $mimeMap[$mimeType] ?? 'png';
    }

    private function getImplement(?DocumentFileInterface $documentFile): ?BaseDocumentFileStrategyInterface
    {
        $interface = match (true) {
            $documentFile instanceof ExternalDocumentFileInterface => ExternalFileDocumentFileStrategyInterface::class,
            $documentFile instanceof ThirdPlatformDocumentFileInterface => ThirdPlatformDocumentFileStrategyInterface::class,
            default => null,
        };

        $driver = null;
        if (container()->has($interface)) {
            /** @var BaseDocumentFileStrategyInterface $driver */
            $driver = di($interface);
        }

        if ($driver && $driver->validation($documentFile)) {
            return $driver;
        }

        $this->logger->warning('没有与[' . get_class($documentFile) . ']匹配的文本解析策略！将返回空值！');
        return null;
    }
}
