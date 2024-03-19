<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra;

abstract class AbstractExtra
{
    abstract public function toArray(): array;

    abstract public static function create(array $config, array $options = []): AbstractExtra;
}
