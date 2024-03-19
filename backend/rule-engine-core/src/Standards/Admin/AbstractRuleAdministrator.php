<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards\Admin;

use Dtyq\RuleEngineCore\Standards\Exception\ConfigurationException;
use ReflectionClass;

abstract class AbstractRuleAdministrator implements RuleAdministratorInterface
{
    protected array $ruleExecutionSetProviderMap = [];

    public function __construct()
    {
        foreach (InputType::cases() as $case) {
            if ($providerClass = $this->getRuleExecutionSetProviderClassname($case)) {
                $this->ruleExecutionSetProviderMap[$case->name] = $providerClass;
            }
        }
    }

    public function getRuleExecutionSetProvider(InputType $inputType, ?Properties $properties = null): RuleExecutionSetProviderInterface
    {
        if (! isset($this->ruleExecutionSetProviderMap[$inputType->name])) {
            throw new ConfigurationException('No RuleExecutionSetProvider registered against intput type: ' . $inputType->name, 1004);
        }

        $ref = new ReflectionClass($this->ruleExecutionSetProviderMap[$inputType->name]['class']);
        $rsp = $ref->newInstanceArgs($this->ruleExecutionSetProviderMap[$inputType->name]['constructor']);
        if (! $rsp instanceof RuleExecutionSetProviderInterface) {
            throw new ConfigurationException($rsp::class . ' must implement RuleExecutionSetProviderInterface', 1005);
        }

        return $rsp;
    }

    abstract protected function getRuleExecutionSetProviderClassname(InputType $inputType): ?array;
}
