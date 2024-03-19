<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

/**
 * 网页爬取接口.
 */
interface WebScrapeInterface
{
    /**
     * 爬取网页内容.
     *
     * @param string $url 目标URL
     * @param array $formats 输出格式数组 (如: ['TEXT', 'MARKDOWN', 'HTML'])
     * @param string $mode 爬取模式 (如: quality, fast)
     * @param array $options 其他可选参数
     * @return WebScrapeResponse 统一响应对象
     */
    public function scrape(string $url, array $formats, string $mode, array $options = []): WebScrapeResponse;

    /**
     * 获取平台名称.
     */
    public function getPlatformName(): string;
}
