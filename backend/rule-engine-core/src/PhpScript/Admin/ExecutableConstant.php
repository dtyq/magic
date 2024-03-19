<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

class ExecutableConstant implements ExecutableConstantInterface
{
    private ExecutableType $type;

    private string $name;

    private string $ruleGroup;

    private string $constName;

    private mixed $constValue;

    private bool $isSystemConst = false;

    public function __construct(string $constName, $constValue = null, $ruleGroup = '')
    {
        $this->name = $constName;
        $this->ruleGroup = $ruleGroup;
        $this->constValue = $constValue;
        if (! isset($constValue)) {
            $this->isSystemConst = true;
        }
        $this->constName = $constName;
        $this->type = ExecutableType::from(ExecutableType::CONSTANT_TYPE);
    }

    public function getType(): ExecutableType
    {
        return $this->type;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getRuleGroup(): string
    {
        return $this->ruleGroup;
    }

    public function getConstantName(): string
    {
        return $this->constName;
    }

    public function getConstantValue(): mixed
    {
        return $this->constValue;
    }

    public function isSystemConstant(): bool
    {
        return $this->isSystemConst;
    }

    public function isSystemConst(): bool
    {
        return $this->isSystemConst;
    }

    public function setIsSystemConst(bool $isSystemConst): self
    {
        $this->isSystemConst = $isSystemConst;
        return $this;
    }
}
