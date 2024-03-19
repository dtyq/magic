<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Repository;

use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetInterface;

interface RuleExecutionSetRepositoryInterface
{
    public function getRegistrations(): array;

    public function getRuleExecutionSet(string $bindUri, ?Properties $properties = null): ?RuleExecutionSetInterface;

    public function registerRuleExecutionSet(string $bindUri, RuleExecutionSetInterface $ruleSet, ?Properties $properties = null): void;

    public function unregisterRuleExecutionSet(string $bindUri, ?Properties $properties = null): void;
}
