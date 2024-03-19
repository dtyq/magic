<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Repository;

use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableCodeInterface;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableType;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;

class DefaultExecutableCodeRepository implements ExecutableCodeRepositoryInterface
{
    /**
     * @var ExecutableCodeInterface[][][]
     */
    public static array $executableCodes = [];

    public function getRegistrations(): array
    {
        // TODO: Implement getRegistrations() method.
        return [];
    }

    public function registerExecutableCode(ExecutableCodeInterface $executableCode, ?Properties $properties = null): void
    {
        $ruleGroup = $this->getGroupKey($executableCode->getRuleGroup());
        static::$executableCodes[$ruleGroup][$executableCode->getType()->name][$executableCode->getName()] = $executableCode;
    }

    public function unregisterExecutableCode(ExecutableType $executableType, string $name, ?string $ruleGroup = null, ?Properties $properties = null): void
    {
        $ruleGroup = $this->getGroupKey($ruleGroup);
        if (! isset(static::$executableCodes[$ruleGroup][$executableType->name][$name])) {
            return;
        }

        unset(static::$executableCodes[$ruleGroup][$executableType->name][$name]);
    }

    public function getExecutableCodesByType(ExecutableType $executableType, ?string $ruleGroup = null, ?Properties $properties = null): array
    {
        $ruleGroup = $this->getGroupKey($ruleGroup);
        return static::$executableCodes[$ruleGroup][$executableType->name] ?? [];
    }

    private function getGroupKey(?string $ruleGroup = null): string
    {
        return $ruleGroup ?: 'commonGroup';
    }
}
