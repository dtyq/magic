<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint;

interface EndpointInterface
{
    public function selectApp(string $appName): void;
}
