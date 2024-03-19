<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Entity\ValueObject;

/**
 * 请求信息值对象.
 * Domain层定义，避免直接依赖HTTP请求对象.
 */
readonly class RequestInfo
{
    public function __construct(
        private ?string $ip = null,
        private ?string $userAgent = null,
        private ?string $method = null,
        private ?string $uri = null,
        private ?string $fullUrl = null,
        private ?string $requestBody = null
    ) {
    }

    public function getIp(): ?string
    {
        return $this->ip;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function getMethod(): ?string
    {
        return $this->method;
    }

    public function getUri(): ?string
    {
        return $this->uri;
    }

    public function getFullUrl(): ?string
    {
        return $this->fullUrl;
    }

    public function getRequestBody(): ?string
    {
        return $this->requestBody;
    }
}
