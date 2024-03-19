<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Closure;
use Dtyq\RuleEngineCore\Standards\Exception\RuleAdministrationException;

use function count;
use function function_exists;
use function ltrim;

class ExecutableFunction implements ExecutableFunctionInterface
{
    private ExecutableType $type;

    private string $name;

    private string $ruleGroup;

    private bool $isWhiteLists;

    private Closure $function;

    public function __construct(string $name, callable $function, $ruleGroup = '', $isWhiteLists = false)
    {
        $this->name = $name;
        $this->function = $function instanceof Closure ? $function : Closure::fromCallable($function);
        $this->ruleGroup = $ruleGroup;
        $this->type = ExecutableType::from(ExecutableType::FUNCTION_TYPE);
        $this->isWhiteLists = $isWhiteLists;
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

    public function getFunction(): Closure
    {
        return $this->function;
    }

    public function isWhiteLists(): bool
    {
        return $this->isWhiteLists;
    }

    public static function fromPhp(string $phpFunctionName, ?string $expressionFunctionName = null, string $ruleGroup = '', bool $isWhiteLists = true): self
    {
        $phpFunctionName = ltrim($phpFunctionName, '\\');
        if (! function_exists($phpFunctionName)) {
            throw new RuleAdministrationException(sprintf('PHP function "%s" does not exist.', $phpFunctionName), 1005000);
        }

        $parts = explode('\\', $phpFunctionName);
        if (! $expressionFunctionName && count($parts) > 1) {
            throw new RuleAdministrationException(sprintf('An expression function name must be defined when PHP function "%s" is namespaced.', $phpFunctionName), 1005000);
        }

        //        $compiler = function (...$args) use ($phpFunctionName) {
        //            return sprintf('\%s(%s)', $phpFunctionName, implode(', ', $args));
        //        };

        $evaluator = function (...$args) use ($phpFunctionName) {
            return $phpFunctionName(...$args);
        };

        return new self($expressionFunctionName ?: end($parts), $evaluator, $ruleGroup, $isWhiteLists);
    }
}
