<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class TokenUsageRecordModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_agent_token_usage_records';

    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'topic_id',
        'task_id',
        'sandbox_id',
        'organization_code',
        'user_id',
        'task_status',
        'usage_type',
        'total_input_tokens',
        'total_output_tokens',
        'total_tokens',
        'model_id',
        'model_name',
        'cached_tokens',
        'cache_write_tokens',
        'reasoning_tokens',
        'usage_details',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'topic_id' => 'integer',
        'task_id' => 'string',
        'sandbox_id' => 'string',
        'organization_code' => 'string',
        'user_id' => 'string',
        'task_status' => 'string',
        'usage_type' => 'string',
        'total_input_tokens' => 'integer',
        'total_output_tokens' => 'integer',
        'total_tokens' => 'integer',
        'model_id' => 'string',
        'model_name' => 'string',
        'cached_tokens' => 'integer',
        'cache_write_tokens' => 'integer',
        'reasoning_tokens' => 'integer',
        'usage_details' => 'json',
    ];
}
