<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_FUNCTION | Attribute::TARGET_METHOD)]
class ApiResponse extends AbstractAnnotation
{
    /**
     * 结构体版本.
     */
    public string $version;

    /**
     * 是否开启转换.
     */
    public bool $needTransform;

    public function __construct(string $version = 'standard', bool $needTransform = true)
    {
        $this->version = $version;
        $this->needTransform = $needTransform;
    }
}
