<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

interface ObjectFilterInterface
{
    public function filter(object $var1): object;

    public function reset(): void;
}
