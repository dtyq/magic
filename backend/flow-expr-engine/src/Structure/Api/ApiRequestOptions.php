<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Api;

class ApiRequestOptions
{
    private string $uri;

    private string $method;

    private array $paramsQuery = [];

    private array $paramsPath = [];

    private array $body = [];

    private array $headers = [];

    private string $proxy = '';

    private bool $verify = true;

    private ApiRequestBodyType $apiRequestBodyType = ApiRequestBodyType::None;

    public function getApiRequestBodyType(): ApiRequestBodyType
    {
        return $this->apiRequestBodyType;
    }

    public function setApiRequestBodyType(ApiRequestBodyType $apiRequestBodyType): ApiRequestOptions
    {
        $this->apiRequestBodyType = $apiRequestBodyType;
        return $this;
    }

    public function getUri(): string
    {
        return $this->uri;
    }

    public function setUri(string $uri): ApiRequestOptions
    {
        $this->uri = $uri;
        return $this;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function setMethod(string $method): ApiRequestOptions
    {
        $this->method = $method;
        return $this;
    }

    public function setProxy(string $proxy): void
    {
        $this->proxy = $proxy;
    }

    public function addParamsQuery(?array $paramsQuery): void
    {
        if (! $paramsQuery) {
            return;
        }
        $this->paramsQuery = array_merge($this->paramsQuery, $paramsQuery);
    }

    public function addParamsPath(?array $paramsPath): void
    {
        if (! $paramsPath) {
            return;
        }
        $this->paramsPath = array_merge($this->paramsPath, $paramsPath);
    }

    public function addBody(?array $body): void
    {
        if (! $body) {
            return;
        }
        $this->body = array_merge($this->body, $body);
    }

    public function addHeaders(?array $headers): void
    {
        if (! $headers) {
            return;
        }
        $this->headers = array_merge($this->headers, $headers);
    }

    public function getParamsQuery(): array
    {
        return $this->paramsQuery;
    }

    public function getParamsPath(): array
    {
        return $this->paramsPath;
    }

    public function getBody(): array
    {
        return $this->body;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getProxy(): string
    {
        return $this->proxy;
    }

    public function isVerify(): bool
    {
        return $this->verify;
    }

    public function setVerify(bool $verify): void
    {
        $this->verify = $verify;
    }
}
