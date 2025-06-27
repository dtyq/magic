<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract;

interface RequestInterface
{
    public function toArray(): array;
} 