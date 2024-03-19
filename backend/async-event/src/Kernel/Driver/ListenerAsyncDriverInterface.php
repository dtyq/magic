<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver;

use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;

interface ListenerAsyncDriverInterface
{
    public function publish(AsyncEventModel $asyncEventModel, object $event, callable $listener): void;
}
