<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript;

use Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Exception\RuleSessionTypeUnsupportedException;
use Dtyq\RuleEngineCore\Standards\RuleRuntimeInterface;
use Dtyq\RuleEngineCore\Standards\RuleSessionInterface;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;

class RuleRuntime implements RuleRuntimeInterface
{
    public function __construct(
        private RuleExecutionSetRepositoryInterface $executionSetRepository,
    ) {
    }

    public function createRuleSession(string $uri, ?Properties $properties, RuleSessionType $ruleSessionType): RuleSessionInterface
    {
        return match ($ruleSessionType->value) {
            RuleSessionType::Stateless => new StatelessRuleSession($uri, $properties, $this->executionSetRepository),
            default => throw new RuleSessionTypeUnsupportedException('invalid session type:' . $ruleSessionType->name, 1007),
        };
    }

    public function getRegistrations(): array
    {
        // TODO: Implement getRegistrations() method.
        return [];
    }
}
