<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

use GuzzleHttp\Client;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

/**
 * 网页爬取抽象基类.
 */
abstract class AbstractWebScrape implements WebScrapeInterface
{
    protected LoggerInterface $logger;

    protected Client $httpClient;

    protected int $timeout = 30;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(static::class);
        $this->initHttpClient();
    }

    /**
     * 设置超时时间.
     */
    public function setTimeout(int $timeout): void
    {
        $this->timeout = $timeout;
        $this->initHttpClient();
    }

    /**
     * 初始化HTTP客户端.
     */
    protected function initHttpClient(): void
    {
        $this->httpClient = new Client([
            'timeout' => $this->timeout,
        ]);
    }

    /**
     * 记录请求日志.
     */
    protected function logRequest(string $url, array $params): void
    {
        $this->logger->info('WebScrape Request', [
            'platform' => $this->getPlatformName(),
            'url' => $url,
            'params' => $params,
        ]);
    }

    /**
     * 记录响应日志.
     */
    protected function logResponse(string $url, bool $success, ?string $error = null): void
    {
        $level = $success ? 'info' : 'error';
        $this->logger->{$level}('WebScrape Response', [
            'platform' => $this->getPlatformName(),
            'url' => $url,
            'success' => $success,
            'error' => $error,
        ]);
    }

    /**
     * 验证URL格式.
     */
    protected function validateUrl(string $url): bool
    {
        return filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    /**
     * 验证请求参数.
     */
    protected function validateRequest(string $url, array $formats): void
    {
        if (empty($url)) {
            throw new InvalidArgumentException('URL cannot be empty');
        }

        if (! $this->validateUrl($url)) {
            throw new InvalidArgumentException('Invalid URL format');
        }

        if (empty($formats)) {
            throw new InvalidArgumentException('Formats cannot be empty');
        }
    }
}
