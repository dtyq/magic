<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

interface ExecutableCodeInterface
{
    public function getType(): ExecutableType;

    public function getName(): string;

    public function getRuleGroup(): string;
}
