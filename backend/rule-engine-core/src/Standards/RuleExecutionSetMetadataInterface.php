<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

interface RuleExecutionSetMetadataInterface
{
    public function getUri(): string;

    public function getName(): string;

    public function getDescription(): string;
}
