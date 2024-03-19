<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Closure;

interface ExecutableFunctionInterface extends ExecutableCodeInterface
{
    public function getFunction(): Closure;
}
