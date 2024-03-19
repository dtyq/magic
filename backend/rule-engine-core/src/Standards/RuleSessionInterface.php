<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

interface RuleSessionInterface
{
    public function getRuleExecutionSetMetadata(): RuleExecutionSetMetadataInterface;

    public function release(): void;

    public function getType(): RuleSessionType;
}
