<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\PhpScript;

use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableFunction;
use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\PhpScript\Repository\DefaultRuleExecutionSetRepository;
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;
use Hyperf\Context\ApplicationContext;
use HyperfTest\Cases\AbstractTestCase;
use HyperfTest\Mock\Repository\CustomExecutionSetRepository;

/**
 * @internal
 * @coversNothing
 */
class CustomExecutionSetRepositoryTest extends AbstractTestCase
{
    private static $uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;

    private $bindUri = 'CustomExecutionSetRepositoryTest';

    public static function setUpBeforeClass(): void
    {
        RuleServiceProviderManager::deregisterRuleServiceProvider(self::$uri);

        $provider = new RuleServiceProvider();
        $provider
            ->setExecutionSetRepository(new CustomExecutionSetRepository(new DefaultRuleExecutionSetRepository()));
        $container = ApplicationContext::getContainer();
        RuleServiceProviderManager::registerRuleServiceProvider(self::$uri, $provider, $container);

        $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider(self::$uri);
        $admin = $ruleProvider->getRuleAdministrator();
        $admin->registerExecutableCode(new ExecutableFunction('add', function ($arg1, $arg2) {
            return $arg1 + $arg2;
        }));
    }

    public static function tearDownAfterClass(): void
    {
        RuleServiceProviderManager::deregisterRuleServiceProvider(self::$uri);
    }

    public function testRegisterRuleExecutionSet()
    {
        $admin = RuleServiceProviderManager::getRuleServiceProvider(self::$uri)->getRuleAdministrator();
        $ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
        $properties = new RuleExecutionSetProperties();
        $properties->setName('CustomExecutionSetRepositoryTest-rule');
        $properties->setRuleType(RuleType::Expression);
        $set = $ruleExecutionSetProvider->createRuleExecutionSet(['$a + 1'], $properties);
        $admin->registerRuleExecutionSet($this->bindUri, $set);

        $this->addToAssertionCount(1);
    }

    /**
     * @depends testRegisterRuleExecutionSet
     */
    public function testExecuteRules()
    {
        $runtime = RuleServiceProviderManager::getRuleServiceProvider(self::$uri)->getRuleRuntime();
        $ruleSession = $runtime->createRuleSession($this->bindUri, new RuleExecutionSetProperties(), RuleSessionType::from(RuleSessionType::Stateless));
        $inputs = [
            'a' => 2,
        ];
        $res = $ruleSession->executeRules($inputs);
        $ruleSession->release();
        $this->assertSame(3, $res[0]);
    }
}
