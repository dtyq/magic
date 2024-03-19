<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\End;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class EndNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        return [];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([]);
        $output = new NodeOutput();

        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $this->node->setInput(null);
        $this->node->setOutput($output);
    }
}
