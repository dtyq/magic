<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Entity\ValueObject;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum OpenMethod: int
{
    /** 当前窗口打开 */
    case CurrentWindow = 1;

    /** 新窗口打开 */
    case NewWindow = 2;

    public static function make(mixed $value): self
    {
        if (! is_int($value)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '打开方式']);
        }

        $method = self::tryFrom($value);
        if ($method === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '打开方式']);
        }

        return $method;
    }

    /**
     * @return array<int>
     */
    public static function getValues(): array
    {
        return array_column(self::cases(), 'value');
    }
}
