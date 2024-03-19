<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loop;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;

class LoopBodyNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        return [];
    }

    public function generateTemplate(): void
    {
        $this->node->setMeta([
            'parent_id' => '',
        ]);
    }
}
