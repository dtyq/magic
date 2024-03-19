<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\PhpScript;

use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableClass;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableCodeInterface;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableConstant;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableFunction;
use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSet;
use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;
use Hyperf\Context\ApplicationContext;
use HyperfTest\Cases\AbstractTestCase;
use HyperfTest\Mock\ExecutableCode\TestClass;

/**
 * @internal
 * @coversNothing
 */
class ExecuteTest extends AbstractTestCase
{
    private static $uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;

    private $ruleGroup = 'test-group';

    public static function setUpBeforeClass(): void
    {
        $container = ApplicationContext::getContainer();
        RuleServiceProviderManager::registerRuleServiceProvider(self::$uri, RuleServiceProvider::class, $container);
    }

    /**
     * @dataProvider registerExecutableCodeProvider
     */
    public function testRegisterExecutableCode(ExecutableCodeInterface $executableCode)
    {
        $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider(self::$uri);
        $admin = $ruleProvider->getRuleAdministrator();
        $admin->registerExecutableCode($executableCode);

        $this->addToAssertionCount(1);
    }

    public function registerExecutableCodeProvider(): array
    {
        return [
            [
                new ExecutableFunction('add', function ($arg1, $arg2) {
                    return $arg1 + $arg2;
                }, $this->ruleGroup),
            ],
            [
                new ExecutableClass(TestClass::class, $this->ruleGroup),
            ],
            [
                new ExecutableConstant('PHP_EOL', null, $this->ruleGroup),
            ],
        ];
    }

    /**
     * @dataProvider registerRuleExecutionSetProvider
     * @depends testRegisterExecutableCode
     */
    public function testRegisterRuleExecutionSet(array $input, RuleExecutionSetProperties $properties, string $bindUri, callable $assert)
    {
        $admin = RuleServiceProviderManager::getRuleServiceProvider(self::$uri)->getRuleAdministrator();
        $ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
        $set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
        $admin->registerRuleExecutionSet($bindUri, $set);
        $assert($set);
    }

    public function registerRuleExecutionSetProvider(): array
    {
        return [
            [
                ['add($a, $b)'],
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setName('add-rule');
                    $properties->setRuleType(RuleType::Expression); // 规则类型，支持脚本或表达式类型。未进行定义时，默认为脚本类型。
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-add-function',
                function (RuleExecutionSet $set) {
                    $this->assertNotEmpty($set->getAsts());
                },
            ],
            [
                ['(new \HyperfTest\Mock\ExecutableCode\TestClass())->add($a, $b)'],
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setName('testClass-rule');
                    $properties->setRuleType(RuleType::Expression); // 规则类型，支持脚本或表达式类型。未进行定义时，默认为脚本类型。
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-testClass-function',
                function (RuleExecutionSet $set) {
                    $this->assertNotEmpty($set->getAsts());
                },
            ],
            [
                ['if( {{ruleEnableCondition}} ) return $a;'],
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setName('testPlaceholder-rule');
                    $properties->setRuleType(RuleType::Script); // 规则类型，支持脚本或表达式类型。未进行定义时，默认为脚本类型。
                    $properties->setResolvePlaceholders(true);
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-placeholder',
                function (RuleExecutionSet $set) {
                    $this->assertEmpty($set->getAsts());
                },
            ],
            [
                ['return PHP_EOL;'],
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setName('testContracts-rule');
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-contracts',
                function (RuleExecutionSet $set) {
                    $this->assertNotEmpty($set->getAsts());
                    $properties = $set->getProperties();
                    $this->assertNotEmpty($properties->getExecutableConstants());
                },
            ],
        ];
    }

    /**
     * @dataProvider executeRulesProvider
     * @depends testRegisterRuleExecutionSet
     */
    public function testExecuteRules(RuleExecutionSetProperties $properties, string $bindUri, array $inputs, callable $assert)
    {
        $runtime = RuleServiceProviderManager::getRuleServiceProvider(self::$uri)->getRuleRuntime();
        $ruleSession = $runtime->createRuleSession($bindUri, $properties, RuleSessionType::from(RuleSessionType::Stateless));
        $this->assertNotEmpty($ruleSession->getAsts());
        $res = $ruleSession->executeRules($inputs);
        $ruleSession->release();
        $assert($res);
    }

    public function executeRulesProvider(): array
    {
        return [
            [
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-add-function',
                [
                    'a' => 1,
                    'b' => 2,
                ],
                function ($res) {
                    $this->assertSame(3, $res[0]);
                },
            ],
            [
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-testClass-function',
                [
                    'a' => 3,
                    'b' => 2,
                ],
                function ($res) {
                    $this->assertSame(5, $res[0]);
                },
            ],
            [
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setRuleGroup($this->ruleGroup);
                    $properties->setPlaceholders(['ruleEnableCondition' => '1 == 1']);
                    return $properties;
                })(),
                'test-placeholder',
                [
                    'a' => 5,
                ],
                function ($res) {
                    $this->assertSame(5, $res[0]);
                },
            ],
            [
                (function () {
                    $properties = new RuleExecutionSetProperties();
                    $properties->setRuleGroup($this->ruleGroup);
                    return $properties;
                })(),
                'test-contracts',
                [],
                function ($res) {
                    $this->assertNotEmpty($res[0]);
                },
            ],
        ];
    }
}
