<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

use Dtyq\RuleEngineCore\Standards\Admin\Properties;

interface RuleRuntimeInterface
{
    public function createRuleSession(string $uri, ?Properties $properties, RuleSessionType $ruleSessionType): RuleSessionInterface;

    public function getRegistrations(): array;
}
