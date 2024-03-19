<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;

abstract class AbstractParameter
{
    private string $accessToken;

    private string $requestId;

    public function __construct(string $accessToken, string $requestId = '')
    {
        $this->accessToken = $accessToken;
        $this->requestId = $requestId ?: uniqid();
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function validate(): void
    {
        if (empty($this->accessToken)) {
            throw new InvalidParameterException('access_token 不能为空');
        }
        $this->validateParams();
    }

    abstract protected function validateParams(): void;
}
