<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\ApiManager;

abstract class ApiAbstract implements ApiInterface
{
    private array $options = [];

    private array $pathParams = [];

    public function setOptions(array $options): void
    {
        $this->options = $options;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function getPathParams(): array
    {
        return $this->pathParams;
    }

    public function setPathParams(array $pathParams): void
    {
        $this->pathParams = $pathParams;
    }
}
