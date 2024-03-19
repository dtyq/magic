<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript;

interface PlaceholderProviderInterface
{
    public function resolve($rules): array;

    public function replace($ruleName, $rules, $context): array;
}
