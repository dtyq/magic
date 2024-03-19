<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class VariableValidate
{
    public static function checkName(?string $variableName): void
    {
        $variableName = trim($variableName ?? '');
        if (empty($variableName)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.variable.name_empty');
        }
        if (! preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $variableName)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.variable.name_invalid');
        }
    }
}
