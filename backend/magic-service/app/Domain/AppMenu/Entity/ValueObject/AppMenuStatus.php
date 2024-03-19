<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Entity\ValueObject;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum AppMenuStatus: int
{
    /** 正常/启用 */
    case Enabled = 1;

    /** 禁用 */
    case Disabled = 2;

    public static function make(mixed $value): self
    {
        if (! is_int($value)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '状态']);
        }

        $status = self::tryFrom($value);
        if ($status === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '状态']);
        }

        return $status;
    }

    /**
     * @return array<int>
     */
    public static function getValues(): array
    {
        return array_column(self::cases(), 'value');
    }
}
