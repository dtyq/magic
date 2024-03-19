<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards\Admin;

interface RuleAdministratorInterface
{
    public function getRuleExecutionSetProvider(InputType $inputType, ?Properties $properties = null): RuleExecutionSetProviderInterface;

    public function registerRuleExecutionSet(string $bindUri, RuleExecutionSetInterface $set, ?Properties $properties = null): void;

    public function deregisterRuleExecutionSet(string $bindUri, ?Properties $properties = null): void;
}
