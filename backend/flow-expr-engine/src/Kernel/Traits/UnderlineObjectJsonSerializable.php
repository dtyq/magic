<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\Traits;

use Dtyq\FlowExprEngine\Kernel\Utils\Functions;

trait UnderlineObjectJsonSerializable
{
    public function jsonSerialize(): array
    {
        $json = [];
        foreach ($this as $key => $value) {
            $key = Functions::unCamelize($key);
            $json[$key] = $value;
        }

        return $json;
    }
}
