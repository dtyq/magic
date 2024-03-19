<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Repository;

use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableCodeInterface;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableType;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;

interface ExecutableCodeRepositoryInterface
{
    public function getRegistrations(): array;

    public function registerExecutableCode(ExecutableCodeInterface $executableCode, ?Properties $properties = null): void;

    public function unregisterExecutableCode(ExecutableType $executableType, string $name, ?string $ruleGroup = null, ?Properties $properties = null): void;

    /**
     * @return ExecutableCodeInterface[]
     */
    public function getExecutableCodesByType(ExecutableType $executableType, ?string $ruleGroup = null, ?Properties $properties = null): array;
}
