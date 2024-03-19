<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\ApiManager;

use Dtyq\SdkBase\Kernel\Constant\RequestMethod;

interface ApiInterface
{
    public function getMethod(): RequestMethod;

    public function getHost(): string;

    public function getUri(): string;

    public function getOptions(): array;

    public function getPathParams(): array;
}
