<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget;

class ShowOptions
{
    private bool $desensitization;

    public function __construct(bool $desensitization = false)
    {
        $this->desensitization = $desensitization;
    }

    public function isDesensitization(): bool
    {
        return $this->desensitization;
    }
}
