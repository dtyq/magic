<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards\Admin;

interface RuleExecutionSetProviderInterface
{
    public function createRuleExecutionSet(mixed $input, Properties $properties): RuleExecutionSetInterface;
}
