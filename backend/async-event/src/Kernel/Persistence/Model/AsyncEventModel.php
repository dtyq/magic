<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Persistence\Model;

use Carbon\Carbon;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property int $status
 * @property string $event
 * @property string $listener
 * @property int $retry_times
 * @property string $args
 * @property null|array $context_data
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class AsyncEventModel extends Model
{
    use Snowflake;

    public function __construct(array $attributes = [])
    {
        // 为了适配hyperf2和3的属性定义问题，这里需要手动指定表名
        $this->table = 'async_event_records';
        $this->fillable = [
            'id', 'status', 'event', 'listener', 'retry_times', 'args', 'context_data', 'created_at', 'updated_at',
        ];
        $this->casts = [
            'id' => 'integer',
            'status' => 'integer',
            'retry_times' => 'integer',
            'event' => 'string',
            'listener' => 'string',
            'args' => 'string',
            'context_data' => 'json',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];

        parent::__construct($attributes);
    }
}
