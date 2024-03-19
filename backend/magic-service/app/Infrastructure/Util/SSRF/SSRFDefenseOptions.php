<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\SSRF;

class SSRFDefenseOptions
{
    private array $blackList = [
        '169.254.169.254',  // 华为云元数据
        '100.100.100.200',  // 阿里云元数据
        '100.96.0.96',      // 火山云元数据
    ];

    private array $whiteList;

    private array $allowProtocols;

    private bool $replaceIp;

    private bool $allowRedirect;

    public function __construct(array $blackList = [], array $whiteList = [], array $allowProtocols = ['http', 'https'], bool $replaceIp = true, bool $allowRedirect = false)
    {
        $this->blackList = array_merge($this->blackList, $blackList);
        $this->whiteList = $whiteList;
        $this->allowProtocols = $allowProtocols;
        $this->replaceIp = $replaceIp;
        $this->allowRedirect = $allowRedirect;
    }

    public function isReplaceIp(): bool
    {
        return $this->replaceIp;
    }

    public function getBlackList(): array
    {
        return $this->blackList;
    }

    public function getWhiteList(): array
    {
        return $this->whiteList;
    }

    public function getAllowProtocols(): array
    {
        return $this->allowProtocols;
    }

    public function isAllowRedirect(): bool
    {
        return $this->allowRedirect;
    }
}
