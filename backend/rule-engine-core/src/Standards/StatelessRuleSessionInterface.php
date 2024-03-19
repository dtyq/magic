<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

interface StatelessRuleSessionInterface extends RuleSessionInterface
{
    public function executeRules(array $facts, ?ObjectFilterInterface $filter = null): array;
}
