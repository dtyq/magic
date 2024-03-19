<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

/**
 * 网页爬取响应对象.
 */
class WebScrapeResponse
{
    public function __construct(
        private bool $success,
        private string $url,
        private mixed $content,
        private string $provider,
        private array $formats = [],
        private ?string $error = null,
        private array $metadata = []
    ) {
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getContent(): mixed
    {
        return $this->content;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function getFormats(): array
    {
        return $this->formats;
    }

    public function getError(): ?string
    {
        return $this->error;
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * 转换为统一的响应数组格式.
     */
    public function toArray(): array
    {
        $result = [
            'success' => $this->success,
            'data' => [
                'url' => $this->url,
                'content' => $this->content,
                'provider' => $this->provider,
            ],
        ];

        if (! empty($this->formats)) {
            $result['data']['formats'] = $this->formats;
        }

        if (! empty($this->metadata)) {
            $result['data']['metadata'] = $this->metadata;
        }

        if (! $this->success && $this->error !== null) {
            $result['error'] = $this->error;
        }

        return $result;
    }

    /**
     * 创建成功响应.
     */
    public static function success(
        string $url,
        mixed $content,
        string $provider,
        array $formats = [],
        array $metadata = []
    ): self {
        return new self(
            success: true,
            url: $url,
            content: $content,
            provider: $provider,
            formats: $formats,
            metadata: $metadata
        );
    }

    /**
     * 创建失败响应.
     */
    public static function error(string $url, string $error, string $provider): self
    {
        return new self(
            success: false,
            url: $url,
            content: null,
            provider: $provider,
            error: $error
        );
    }
}
