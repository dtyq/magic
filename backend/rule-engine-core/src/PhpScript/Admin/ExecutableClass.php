<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

class ExecutableClass implements ExecutableClassInterface
{
    private ExecutableType $type;

    private string $name;

    private string $namespace;

    private string $shortName;

    private string $ruleGroup;

    public function __construct($name, $ruleGroup = '')
    {
        $this->name = $name;
        $this->ruleGroup = $ruleGroup;
        if ($pos = strrpos($name, '\\')) {
            $this->shortName = substr($name, $pos + 1);
            $this->namespace = substr($name, 0, $pos);
        } else {
            $this->shortName = $name;
            $this->namespace = '';
        }
        $this->type = ExecutableType::from(ExecutableType::CLASS_TYPE);
    }

    public function getNamespaceName(): string
    {
        return $this->namespace;
    }

    public function getType(): ExecutableType
    {
        return $this->type;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getShortName(): string
    {
        return $this->shortName;
    }

    public function getRuleGroup(): string
    {
        return $this->ruleGroup;
    }
}
