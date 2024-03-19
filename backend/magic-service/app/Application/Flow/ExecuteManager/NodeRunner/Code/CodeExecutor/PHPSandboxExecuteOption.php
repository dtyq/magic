<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Code\CodeExecutor;

use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\Options\ExecuteOption\AbstractExecuteOption;
use Dtyq\FlowExprEngine\SdkInfo;
use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;

class PHPSandboxExecuteOption extends AbstractExecuteOption
{
    public function getUri(): string
    {
        return SdkInfo::RULE_SERVICE_PROVIDER;
    }

    public function getInputType(): InputType
    {
        return InputType::from(InputType::String);
    }

    public function getRuleSessionType(): RuleSessionType
    {
        return RuleSessionType::from(RuleSessionType::Stateless);
    }

    public function getRuleExecutionSetProperties(): RuleExecutionSetProperties
    {
        $ruleExecutionSetProperties = new RuleExecutionSetProperties();
        $ruleExecutionSetProperties->setName($this->name);
        $ruleExecutionSetProperties->setRuleType(RuleType::Script);
        return $ruleExecutionSetProperties;
    }
}
