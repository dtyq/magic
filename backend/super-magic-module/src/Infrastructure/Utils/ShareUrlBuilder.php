<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * 分享URL构建器工具类.
 */
class ShareUrlBuilder
{
    protected string $frontendBaseUrl = 'https://app.domain.com';

    protected string $sharePath = '/share';

    /**
     * 构建完整的分享URL.
     *
     * @param string $shareCode 分享代码
     * @param null|string $resourceType 资源类型名称
     * @return string 完整的分享URL
     */
    public function buildShareUrl(string $shareCode, ?string $resourceType = null): string
    {
        $url = rtrim($this->frontendBaseUrl, '/') . $this->sharePath . '/' . $shareCode;

        if ($resourceType !== null) {
            $url .= '?type=' . $resourceType;
        }

        return $url;
    }

    /**
     * 获取分享URL的前缀部分.
     *
     * @return string 分享URL前缀
     */
    public function getShareUrlPrefix(): string
    {
        return rtrim($this->frontendBaseUrl, '/') . $this->sharePath . '/';
    }

    /**
     * 从完整URL中提取分享代码
     *
     * @param string $url 完整的分享URL
     * @return null|string 分享代码，如果无法提取则返回null
     */
    public function extractShareCodeFromUrl(string $url): ?string
    {
        $prefix = $this->getShareUrlPrefix();

        if (strpos($url, $prefix) !== 0) {
            return null;
        }

        $remainder = substr($url, strlen($prefix));
        $parts = explode('?', $remainder, 2);

        return $parts[0] ?: null;
    }
}
