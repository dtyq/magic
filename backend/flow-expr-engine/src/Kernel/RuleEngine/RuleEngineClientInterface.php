<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine;

use Dtyq\FlowExprEngine\Structure\Condition\Condition;
use Dtyq\FlowExprEngine\Structure\Expression\Expression;

interface RuleEngineClientInterface
{
    public function execute(string $code, array $data): mixed;

    public function isEffective(string $code): bool;

    public function getCodeByExpression(Expression $expression): string;

    public function getCodeByCondition(Condition $condition): string;
}
