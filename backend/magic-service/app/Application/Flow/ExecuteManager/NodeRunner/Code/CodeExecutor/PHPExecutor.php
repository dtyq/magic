<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Code\CodeExecutor;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\ExecuteResult;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PHPExecutorInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\RuleEngineCore\Standards\Exception\InvalidRuleSessionException;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\StatelessRuleSessionInterface;

class PHPExecutor implements PHPExecutorInterface
{
    public function execute(string $organizationCode, string $code, array $sourceData = []): ExecuteResult
    {
        try {
            $input = [$code];

            $options = new PHPSandboxExecuteOption();
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
            return new ExecuteResult($result, $debug);
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
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.code.execute_failed | ' . implode(' | ', $error));
        } finally {
            if (isset($ruleSession)) {
                $ruleSession->release();
            }
        }
    }
}
