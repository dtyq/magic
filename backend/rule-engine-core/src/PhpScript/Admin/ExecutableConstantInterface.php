<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

interface ExecutableConstantInterface extends ExecutableCodeInterface
{
    public function getConstantName(): string;

    public function getConstantValue(): mixed;

    public function isSystemConstant(): bool;
}
