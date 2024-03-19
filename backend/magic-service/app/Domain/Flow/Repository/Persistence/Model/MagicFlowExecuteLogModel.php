<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $execute_data_id
 * @property string $conversation_id
 * @property string $flow_code
 * @property string $flow_version_code
 * @property int $status
 * @property array $ext_params
 * @property array $result
 * @property Carbon $created_at
 * @property int $retry_count
 * @property string $flow_type
 * @property string $parent_flow_code
 * @property string $operator_id
 * @property int $level
 * @property string $execution_type
 */
class MagicFlowExecuteLogModel extends AbstractModel
{
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'magic_flow_execute_logs';

    protected array $fillable = [
        'id', 'organization_code', 'execute_data_id', 'conversation_id', 'flow_code', 'flow_version_code', 'status', 'ext_params', 'result', 'created_at', 'retry_count', 'flow_type', 'parent_flow_code', 'operator_id', 'level', 'execution_type',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'execute_data_id' => 'string',
        'conversation_id' => 'string',
        'flow_code' => 'string',
        'flow_version_code' => 'string',
        'status' => 'integer',
        'ext_params' => 'json',
        'result' => 'json',
        'created_at' => 'datetime',
        'retry_count' => 'integer',
        'flow_type' => 'string',
        'parent_flow_code' => 'string',
        'operator_id' => 'string',
        'level' => 'integer',
        'execution_type' => 'string',
    ];
}
