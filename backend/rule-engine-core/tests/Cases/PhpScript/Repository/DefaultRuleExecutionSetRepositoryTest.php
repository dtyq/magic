<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\PhpScript\Repository;

use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSet;
use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\PhpScript\Repository\DefaultRuleExecutionSetRepository;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use HyperfTest\Cases\AbstractTestCase;

/**
 * @internal
 * @coversNothing
 */
class DefaultRuleExecutionSetRepositoryTest extends AbstractTestCase
{
    /**
     * @dataProvider registerRuleExecutionSetProvider
     */
    public function testRegisterRuleExecutionSet(string $bindUri, RuleExecutionSet $executionSet, RuleExecutionSetProperties $properties)
    {
        $repository = new DefaultRuleExecutionSetRepository();
        $executionSet->create(['1+1'], $properties);
        $repository->registerRuleExecutionSet($bindUri, $executionSet);

        $this->addToAssertionCount(1);
    }

    public function registerRuleExecutionSetProvider(): array
    {
        return [
            [
                'Default-Rule-Execution-Set-Repository-Test',
                (function () {
                    return new RuleExecutionSet();
                })(),
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setName('My Rule');
                    $properties->setRuleType(RuleType::Expression);
                    $properties->setRuleGroup('test');
                    return $properties;
                })(),
            ],
        ];
    }

    /**
     * @depends testRegisterRuleExecutionSet
     */
    public function testGetRuleExecutionSet()
    {
        $repository = new DefaultRuleExecutionSetRepository();
        foreach ($this->registerRuleExecutionSetProvider() as $value) {
            $bindUri = $value[0];
            $properties = $value[2];
            $this->assertNotEmpty($repository->getRuleExecutionSet($bindUri, $properties));
        }
    }

    /**
     * @depends testGetRuleExecutionSet
     */
    public function testUnregisterRuleExecutionSet()
    {
        $repository = new DefaultRuleExecutionSetRepository();
        foreach ($this->registerRuleExecutionSetProvider() as $value) {
            $bindUri = $value[0];
            $properties = $value[2];
            $repository->unregisterRuleExecutionSet($bindUri, $properties);
            $this->assertEmpty($repository->getRuleExecutionSet($bindUri, $properties));
        }
    }
}
