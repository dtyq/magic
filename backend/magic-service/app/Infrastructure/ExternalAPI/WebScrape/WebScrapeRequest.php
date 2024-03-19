<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

/**
 * 网页爬取请求对象.
 */
class WebScrapeRequest
{
    public function __construct(
        private string $url,
        private array $formats = ['TEXT'],
        private string $mode = 'quality',
        private array $options = []
    ) {
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getFormats(): array
    {
        return $this->formats;
    }

    public function getMode(): string
    {
        return $this->mode;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function toArray(): array
    {
        return [
            'url' => $this->url,
            'formats' => $this->formats,
            'mode' => $this->mode,
            'options' => $this->options,
        ];
    }
}
