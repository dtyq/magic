<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

interface ExecutableClassInterface extends ExecutableCodeInterface
{
    public function getNamespaceName(): string;

    public function getShortName(): string;
}
