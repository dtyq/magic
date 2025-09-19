<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\OCR;

use App\Infrastructure\Core\Exception\OCRException;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Support\retry;

readonly class OCRService
{
    private LoggerInterface $logger;

    public function __construct(
        protected OCRClientFactory $clientFactory,
        protected LoggerFactory $loggerFactory,
        protected CacheInterface $cache,
    ) {
        $this->logger = $loggerFactory->get('ocr_service');
    }

    public function ocr(OCRClientType $type, ?string $url = null): string
    {
        if ($url === null) {
            throw new InvalidArgumentException('url is empty');
        }
        $ocrClient = $this->clientFactory->getClient($type);
        try {
            $result = retry(1, function () use ($ocrClient, $url) {
                // 如果还有其他服务商，这里可以故障转移
                return $this->get($url, $ocrClient);
            }, 1000);
        } catch (Throwable $throwable) {
            $this->logger->warning('ocr_fail', [
                'message' => $throwable->getMessage(),
                'code' => $throwable->getCode(),
                'trace' => $throwable->getTraceAsString(),
            ]);
            throw new OCRException($throwable->getMessage(), 500, $throwable);
        }
        return $result;
    }

    private function get(string $url, OCRClientInterface $OCRClient): string
    {
        // 定义 Redis 缓存键
        $cacheKey = 'file_cache:' . md5($url);

        // 尝试从缓存获取数据
        $cachedData = $this->cache->get($cacheKey);
        if ($cachedData) {
            $cachedData = Json::decode($cachedData);
        }

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        // 获取远程文件的头信息
        $headers = get_headers($url, true, $context);
        if ($headers === false) {
            throw new RuntimeException("无法获取头信息: {$url}");
        }

        // 提取 `Last-Modified`、`ETag` 和 `Content-Length`（如果存在）
        $lastModified = $headers['Last-Modified'] ?? null;
        $etag = $headers['Etag'] ?? null;
        $contentLength = $headers['Content-Length'] ?? null;

        // 检查缓存中的 `Last-Modified`、`ETag` 和 `Content-Length`
        if ($cachedData) {
            $isCacheValid = true;

            // 检查 Last-Modified 和 ETag
            if ($lastModified && $etag) {
                $isCacheValid = $cachedData['Last-Modified'] === $lastModified && $cachedData['Etag'] === $etag;
            }
            // 如果没有 Last-Modified 或 ETag，检查 Content-Length
            elseif ($contentLength) {
                $isCacheValid = $cachedData['Content-Length'] === $contentLength;
            }

            // 如果缓存数据有效，直接返回缓存内容
            if ($isCacheValid) {
                return $cachedData['content'];
            }
        }

        // 调用 OCR 服务进行处理
        $result = $OCRClient->ocr($url);

        // 更新缓存数据
        $newCacheData = [
            'Last-Modified' => $lastModified,
            'Etag' => $etag,
            'Content-Length' => $contentLength,
            'content' => $result,
        ];

        $this->cache->set($cacheKey, Json::encode($newCacheData), 1800);

        return $result;
    }
}
