<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Repository\Persistence\Model;

use DateTime;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

use function Hyperf\Config\config;

/**
 * @property int $id
 * @property string $environment
 * @property string $external_id
 * @property string $name
 * @property DateTime $expect_time
 * @property DateTime $actual_time
 * @property int $type
 * @property int $retry_times
 * @property int $cost_time
 * @property string $status
 * @property array $callback_method
 * @property array $callback_params
 * @property string $remark
 * @property string $creator
 * @property DateTime $created_at
 */
class TaskSchedulerModel extends Model
{
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'task_scheduler';

    protected array $fillable = [
        'id', 'environment', 'external_id', 'name', 'expect_time', 'actual_time', 'type', 'retry_times', 'cost_time', 'status', 'callback_method', 'callback_params', 'remark', 'creator', 'created_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'environment' => 'string',
        'external_id' => 'string',
        'name' => 'string',
        'expect_time' => 'datetime',
        'actual_time' => 'datetime',
        'type' => 'integer',
        'retry_times' => 'integer',
        'cost_time' => 'integer',
        'status' => 'integer',
        'callback_method' => 'json',
        'callback_params' => 'json',
        'remark' => 'string',
        'creator' => 'string',
        'created_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        $this->table = config('task_scheduler.table_names.task_scheduler', 'task_scheduler');
        parent::__construct($attributes);
    }
}
