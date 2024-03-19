<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Entity\ValueObject;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum DisplayScope: int
{
    /** 仅企业/团队可见 */
    case TeamOnly = 0;

    /** 仅个人可见 */
    case PersonalOnly = 1;

    /** 所有可见（个人+团队） */
    case All = 2;

    public static function make(mixed $value): self
    {
        if (! is_int($value)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '可见范围']);
        }

        $scope = self::tryFrom($value);
        if ($scope === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '可见范围']);
        }

        return $scope;
    }

    /**
     * @return array<int>
     */
    public static function getValues(): array
    {
        return array_column(self::cases(), 'value');
    }
}
