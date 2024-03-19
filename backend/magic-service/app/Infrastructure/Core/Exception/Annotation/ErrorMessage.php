<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception\Annotation;

use Attribute;

#[Attribute(Attribute::TARGET_CLASS_CONSTANT)]
readonly class ErrorMessage
{
    public function __construct(
        private string $message
    ) {
    }

    public function getMessage(): string
    {
        return $this->message;
    }
}
