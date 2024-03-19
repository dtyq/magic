<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Repository;

use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetInterface;
use Hyperf\Context\Context;

class DefaultRuleExecutionSetRepository implements RuleExecutionSetRepositoryInterface
{
    public static $contextkeys = [
        'executionSetRepository' => 'rule-engine.php-script.execution-set-repository',
    ];

    public function getRegistrations(): array
    {
        return [];
    }

    /**
     * @param null|RuleExecutionSetProperties $properties
     */
    public function getRuleExecutionSet(string $bindUri, ?Properties $properties = null): ?RuleExecutionSetInterface
    {
        return Context::get($this->getMapKey($bindUri, $properties?->getRuleGroup() ?? null));
    }

    public function registerRuleExecutionSet(string $bindUri, RuleExecutionSetInterface $ruleSet, ?Properties $properties = null): void
    {
        Context::set(
            $this->getMapKey($bindUri, $ruleSet->getRuleGroup() ?? null),
            $ruleSet
        );
    }

    /**
     * @param null|RuleExecutionSetProperties $properties
     */
    public function unregisterRuleExecutionSet(string $bindUri, ?Properties $properties = null): void
    {
        Context::destroy($this->getMapKey($bindUri, $properties?->getRuleGroup() ?? null));
    }

    private function getMapKey(string $bindUri, ?string $ruleGroup = null): string
    {
        return static::$contextkeys['executionSetRepository'] . '.' . ($ruleGroup ?: 'commonGroup') . '.' . $bindUri;
    }
}
