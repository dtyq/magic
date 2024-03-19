<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\PHPCodeExecutor;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\RuleEngineCore\Standards\Exception\InvalidRuleSessionException;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\StatelessRuleSessionInterface;

class PHPExecutor
{
    public static function execute(string $code, array $sourceData = []): PHPExecuteResult
    {
        try {
            $input = [$code];

            $options = new CodeExecuteOption();
            $uri = $options->getUri();
            $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
            $admin = $ruleProvider->getRuleAdministrator();
            $ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider($options->getInputType());

            $properties = $options->getRuleExecutionSetProperties();
            $bindUri = $properties->getName();
            $set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
            $admin->registerRuleExecutionSet($bindUri, $set, $properties);
            $runtime = $ruleProvider->getRuleRuntime();
            /** @var StatelessRuleSessionInterface $ruleSession */
            $ruleSession = $runtime->createRuleSession($bindUri, $properties, $options->getRuleSessionType());

            ob_start();
            $result = $ruleSession->executeRules($sourceData)[0] ?? null;
            $debug = ob_get_clean();
            return new PHPExecuteResult($result, $debug);
        } catch (InvalidRuleSessionException $invalidRuleSessionException) {
            $limit = 5;
            $error[] = $invalidRuleSessionException->getMessage();
            $throw = $invalidRuleSessionException;
            while ($throw->getPrevious() ?? false) {
                $error[] = $throw->getPrevious()->getMessage();
                if (count($error) > $limit) {
                    break;
                }
                $throw = $throw->getPrevious();
            }
            throw new FlowExprEngineException('code_execute_failed | ' . implode(' | ', $error));
        } finally {
            if (isset($ruleSession)) {
                $ruleSession->release();
            }
        }
    }
}
