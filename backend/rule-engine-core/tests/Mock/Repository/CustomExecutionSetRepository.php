<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Mock\Repository;

use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSet;
use Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryDecorator;
use Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetInterface;
use Hyperf\Context\ApplicationContext;
use Psr\SimpleCache\CacheInterface;

class CustomExecutionSetRepository extends RuleExecutionSetRepositoryDecorator
{
    private CacheInterface $cache;

    public function __construct(RuleExecutionSetRepositoryInterface $wrapped)
    {
        parent::__construct($wrapped);
        $container = ApplicationContext::getContainer();
        $this->cache = $container->get(CacheInterface::class);
    }

    public function registerRuleExecutionSet(string $bindUri, RuleExecutionSetInterface $ruleSet, ?Properties $properties = null): void
    {
        $ruleSetArr = [
            'rules' => $ruleSet->getOriginalRule(),
            'properties' => $ruleSet->getProperties(),
        ];
        $this->cache->set($this->getMapKey($bindUri, $ruleSet->getRuleGroup() ?? null), $ruleSetArr, 90);
    }

    public function getRuleExecutionSet(string $bindUri, ?Properties $properties = null): ?RuleExecutionSetInterface
    {
        $arr = $this->cache->get($this->getMapKey($bindUri, $properties?->getRuleGroup() ?? null));
        if (empty($arr)) {
            return null;
        }

        $ruleExecutionSet = new RuleExecutionSet();
        $ruleExecutionSet->create($arr['rules'], $arr['properties']);

        return $ruleExecutionSet;
    }

    private function getMapKey(string $bindUri, ?string $ruleGroup = null): string
    {
        return ($ruleGroup ?: 'commonGroup') . ':' . $bindUri;
    }
}
