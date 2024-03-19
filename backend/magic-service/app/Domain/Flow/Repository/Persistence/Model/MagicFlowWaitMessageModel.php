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
 * @property string $conversation_id
 * @property string $origin_conversation_id
 * @property string $message_id
 * @property string $wait_node_id
 * @property string $flow_code
 * @property string $flow_version
 * @property int $timeout
 * @property bool $handled
 * @property array $persistent_data
 * @property string $created_uid
 * @property Carbon $created_at
 * @property string $updated_uid
 * @property Carbon $updated_at
 */
class MagicFlowWaitMessageModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_flow_wait_messages';

    protected array $fillable = [
        'id', 'organization_code', 'conversation_id', 'origin_conversation_id', 'message_id', 'wait_node_id', 'flow_code', 'flow_version', 'timeout', 'handled', 'persistent_data',
        'created_uid', 'created_at', 'updated_uid', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'conversation_id' => 'string',
        'origin_conversation_id' => 'string',
        'message_id' => 'string',
        'wait_node_id' => 'string',
        'flow_code' => 'string',
        'flow_version' => 'string',
        'timeout' => 'integer',
        'handled' => 'boolean',
        'persistent_data' => 'array',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
    ];
}
