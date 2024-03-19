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
 * @property int $task_id
 * @property string $environment
 * @property string $external_id
 * @property string $name
 * @property DateTime $expect_time
 * @property DateTime $actual_time
 * @property int $cost_time
 * @property int $type
 * @property string $status
 * @property array $callback_method
 * @property array $callback_params
 * @property string $remark
 * @property string $creator
 * @property DateTime $created_at
 * @property array $result
 */
class TaskSchedulerLogModel extends Model
{
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'task_scheduler_log';

    protected array $fillable = [
        'id', 'task_id', 'environment', 'external_id', 'name', 'expect_time', 'actual_time', 'cost_time', 'type', 'status', 'callback_method', 'callback_params', 'remark', 'creator', 'created_at', 'result',
    ];

    protected array $casts = [
        'id' => 'integer',
        'task_id' => 'integer',
        'environment' => 'string',
        'external_id' => 'string',
        'name' => 'string',
        'expect_time' => 'datetime',
        'actual_time' => 'datetime',
        'type' => 'integer',
        'cost_time' => 'integer',
        'status' => 'integer',
        'callback_method' => 'json',
        'callback_params' => 'json',
        'remark' => 'string',
        'creator' => 'string',
        'created_at' => 'datetime',
        'result' => 'json',
    ];

    public function __construct(array $attributes = [])
    {
        $this->table = config('task_scheduler.table_names.task_scheduler_log', 'task_scheduler_log');
        parent::__construct($attributes);
    }
}
