<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime\Proxy;

use PHPSandbox\Options\SandboxOptions;

interface RuntimeProxyInterface
{
    public function setOptions(SandboxOptions $options): self;
}
