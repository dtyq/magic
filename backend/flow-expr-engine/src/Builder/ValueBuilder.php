<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Builder;

use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\Structure;

class ValueBuilder extends Builder
{
    public function build(array $structure): ?Value
    {
        return Value::build($structure);
    }

    public function template(string $componentId, array $structure = []): ?Structure
    {
        $template = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "input",
            "value": "",
            "name": ""
        }
    ],
    "expression_value": null
}
JSON, true);
        if (! empty($structure)) {
            $template = $structure;
        }
        return $this->build($template);
    }
}
