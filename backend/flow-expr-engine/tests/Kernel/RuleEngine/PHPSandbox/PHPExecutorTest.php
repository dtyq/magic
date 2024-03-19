<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Kernel\RuleEngine\PHPSandbox;

use Dtyq\FlowExprEngine\SdkInfo;
use Dtyq\FlowExprEngine\Test\BaseTestCase;
use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;
use Dtyq\RuleEngineCore\Standards\StatelessRuleSessionInterface;

/**
 * @internal
 * @coversNothing
 */
class PHPExecutorTest extends BaseTestCase
{
    public function testExecuteCode()
    {
        $code = <<<'PHP'
echo "hello ".PHP_EOL;
PHP;
        $input = [$code];

        $uri = SdkInfo::RULE_SERVICE_PROVIDER;
        $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
        $admin = $ruleProvider->getRuleAdministrator();
        $ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));

        $ruleExecutionSetProperties = new RuleExecutionSetProperties();
        $ruleExecutionSetProperties->setName('test');
        $ruleExecutionSetProperties->setRuleType(RuleType::Script);

        $properties = $ruleExecutionSetProperties;
        $bindUri = $properties->getName();
        $set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
        $admin->registerRuleExecutionSet($bindUri, $set, $properties);
        $runtime = $ruleProvider->getRuleRuntime();
        /** @var StatelessRuleSessionInterface $ruleSession */
        $ruleSession = $runtime->createRuleSession($bindUri, $properties, RuleSessionType::from(RuleSessionType::Stateless));

        ob_start();
        $result = $ruleSession->executeRules([])[0] ?? null;
        $debug = ob_get_clean();
        $this->assertEquals('hello ' . PHP_EOL, $debug);
        $this->assertNull($result);
    }
}
