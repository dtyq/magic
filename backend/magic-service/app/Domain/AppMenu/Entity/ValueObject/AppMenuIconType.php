<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Entity\ValueObject;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum AppMenuIconType: int
{
    case Icon = 1;
    case Image = 2;

    public static function make(mixed $type): self
    {
        if (! is_int($type)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '图标类型']);
        }

        $iconType = self::tryFrom($type);
        if ($iconType === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '图标类型']);
        }

        return $iconType;
    }

    /**
     * @return array<int>
     */
    public static function getValues(): array
    {
        return array_column(self::cases(), 'value');
    }
}
