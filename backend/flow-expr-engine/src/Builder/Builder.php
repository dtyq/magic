<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Builder;

use Dtyq\FlowExprEngine\Structure\Structure;

abstract class Builder
{
    abstract public function build(array $structure): ?Structure;

    abstract public function template(string $componentId, array $structure = []): ?Structure;
}
