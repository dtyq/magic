<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\Options\ExecuteOption;

use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSetProperties;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;

abstract class AbstractExecuteOption
{
    protected string $name;

    protected string $namePrefix = 'rule-engine-';

    public function __construct()
    {
        $this->generateName();
    }

    public function getName(): string
    {
        return $this->name;
    }

    abstract public function getUri(): string;

    abstract public function getInputType(): InputType;

    abstract public function getRuleSessionType(): RuleSessionType;

    abstract public function getRuleExecutionSetProperties(): RuleExecutionSetProperties;

    protected function generateName(): void
    {
        $this->name = uniqid($this->namePrefix);
    }
}
