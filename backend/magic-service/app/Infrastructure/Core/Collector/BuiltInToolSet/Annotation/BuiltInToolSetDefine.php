<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS)]
class BuiltInToolSetDefine extends AbstractAnnotation
{
    public function __construct(
        protected bool $enabled = true,
        protected int $sort = 99,
    ) {
    }

    public function getSort(): int
    {
        return $this->sort;
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
