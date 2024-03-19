<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure;

use Dtyq\FlowExprEngine\Component;

readonly class Filter
{
    public function __construct(
        private LeftType $leftType,
        private OperatorType $operatorType,
        private Component $rightValue
    ) {
    }

    public function getLeftType(): LeftType
    {
        return $this->leftType;
    }

    public function getOperatorType(): OperatorType
    {
        return $this->operatorType;
    }

    public function getRightValue(): Component
    {
        return $this->rightValue;
    }

    public function toArray(): array
    {
        return [
            'left' => $this->leftType->value,
            'operator' => $this->operatorType->value,
            'right' => $this->rightValue->toArray(),
        ];
    }
}
