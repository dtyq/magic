<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Volcengine\Base;

use DateTime;

class SignParam
{
    private bool $isSignUrl = false;

    private string $payloadHash = '';

    private string $method = '';

    private DateTime $date;

    private string $path = '';

    private string $host = '';

    private array $queryList = [];

    private array $headerList = [];

    public function isSignUrl(): bool
    {
        return $this->isSignUrl;
    }

    public function setIsSignUrl(bool $isSignUrl): void
    {
        $this->isSignUrl = $isSignUrl;
    }

    public function getPayloadHash(): string
    {
        return $this->payloadHash;
    }

    public function setPayloadHash(string $payloadHash): void
    {
        $this->payloadHash = $payloadHash;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function setMethod(string $method): void
    {
        $this->method = $method;
    }

    public function getDate(): DateTime
    {
        return $this->date;
    }

    public function setDate(DateTime $date): void
    {
        $this->date = $date;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function setPath(string $path): void
    {
        $this->path = $path;
    }

    public function getHost(): string
    {
        return $this->host;
    }

    public function setHost(string $host): void
    {
        $this->host = $host;
    }

    public function getQueryList(): array
    {
        return $this->queryList;
    }

    public function setQueryList(array $queryList): void
    {
        $this->queryList = $queryList;
    }

    public function getHeaderList(): array
    {
        return $this->headerList;
    }

    public function setHeaderList(array $headerList): void
    {
        $this->headerList = $headerList;
    }
}
