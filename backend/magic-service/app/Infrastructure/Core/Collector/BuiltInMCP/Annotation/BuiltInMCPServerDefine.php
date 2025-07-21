<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\BuiltInMCP\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS)]
class BuiltInMCPServerDefine extends AbstractAnnotation
{
    public function __construct(
        protected string $serverCode,
        protected bool $enabled = true,
        protected int $priority = 99,
    ) {
    }

    public function getServerCode(): string
    {
        return $this->serverCode;
    }

    public function getPriority(): int
    {
        return $this->priority;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }
}
