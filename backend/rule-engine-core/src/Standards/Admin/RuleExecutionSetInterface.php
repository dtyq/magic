<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards\Admin;

use JsonSerializable;

interface RuleExecutionSetInterface extends JsonSerializable
{
    public function getName(): string;

    public function getDescription(): ?string;

    public function setDefaultObjectFilter(string $objectFilterClassname): void;

    public function getDefaultObjectFilter(): string;

    public function getRules(): array;
}
