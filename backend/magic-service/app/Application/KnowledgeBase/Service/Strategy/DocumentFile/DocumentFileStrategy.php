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
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ExternalDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
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
        // 替换base64图片
        return $this->replaceBase64Images($originContent, $dataIsolation, $knowledgeBaseCode);
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
     * 替换内容中的 base64 图片为 MagicCompressibleContent 标签.
     */
    private function replaceBase64Images(string $content, KnowledgeBaseDataIsolation $dataIsolation, ?string $knowledgeBaseCode = null): string
    {
        // 提取base64的图片
        $pattern = '/(!\[.*\]\((data:image\/([^;]+);base64,([^)]+))\))/';
        $matches = [];
        preg_match_all($pattern, $content, $matches);
        $fullMatches = $matches[1] ?? [];  // 完整的markdown图片语法
        $images = $matches[2] ?? [];  // 完整的data URL
        $imageTypes = $matches[3] ?? [];  // 图片类型
        $base64Contents = $matches[4] ?? [];  // base64内容

        foreach ($images as $index => $image) {
            try {
                $md5 = md5($image);
                $cacheKey = 'knowledge_base:' . $knowledgeBaseCode . ':document_file:base64_image:' . $md5;
                $fileKey = $this->cache->get($cacheKey);
                if (! $fileKey) {
                    $extension = $imageTypes[$index] ?? 'png';
                    $imageName = uniqid() . '.' . $extension;
                    $imagePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $imageName;
                    file_put_contents($imagePath, base64_decode($base64Contents[$index]));

                    // 创建上传文件对象
                    $uploadFile = new UploadFile($imagePath, 'knowledge-base/' . $knowledgeBaseCode, $imageName);

                    // 上传文件
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
                    'image' => $image,
                ]);
            } finally {
                // 删除临时文件
                if (isset($imagePath) && file_exists($imagePath)) {
                    unlink($imagePath);
                }
            }
        }
        return $content;
    }

    private function getImplement(?DocumentFileInterface $documentFile): ?BaseDocumentFileStrategyInterface
    {
        $interface = match (get_class($documentFile)) {
            ExternalDocumentFile::class => ExternalFileDocumentFileStrategyInterface::class,
            ThirdPlatformDocumentFile::class => ThirdPlatformDocumentFileStrategyInterface::class,
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
