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
 * @property string $crontab
 * @property DateTime $last_gen_time
 * @property bool $enabled
 * @property int $retry_times
 * @property array $callback_method
 * @property array $callback_params
 * @property string $remark
 * @property DateTime $deadline
 * @property string $creator
 * @property string $filter_id
 * @property DateTime $created_at
 */
class TaskSchedulerCrontabModel extends Model
{
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'task_scheduler_crontab';

    protected array $fillable = [
        'id', 'environment', 'external_id', 'name', 'crontab', 'last_gen_time', 'enabled', 'retry_times', 'callback_method', 'callback_params', 'remark', 'deadline', 'creator', 'filter_id', 'created_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'environment' => 'string',
        'external_id' => 'string',
        'name' => 'string',
        'crontab' => 'string',
        'last_gen_time' => 'datetime',
        'enabled' => 'boolean',
        'retry_times' => 'integer',
        'callback_method' => 'json',
        'callback_params' => 'json',
        'remark' => 'string',
        'deadline' => 'datetime',
        'creator' => 'string',
        'filter_id' => 'string',
        'created_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        $this->table = config('task_scheduler.table_names.task_scheduler_crontab', 'task_scheduler_crontab');
        parent::__construct($attributes);
    }
}
