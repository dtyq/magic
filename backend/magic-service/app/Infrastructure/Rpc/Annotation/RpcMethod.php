<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_METHOD)]
class RpcMethod extends AbstractAnnotation
{
    public function __construct(
        protected string $name,
        protected bool $enabled = true,
        protected bool $full = false,
    ) {
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function isFull(): bool
    {
        return $this->full;
    }
}
