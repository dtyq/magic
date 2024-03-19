<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Repository\Persistence;

use Dtyq\TaskScheduler\Util\Functions;
use Hyperf\Database\Model\Builder;

abstract class AbstractRepository
{
    protected function createBuilder(Builder $builder): Builder
    {
        $appEnv = Functions::getEnv();
        if (! empty($appEnv)) {
            $builder->where('environment', $appEnv);
        }
        return $builder;
    }
}
