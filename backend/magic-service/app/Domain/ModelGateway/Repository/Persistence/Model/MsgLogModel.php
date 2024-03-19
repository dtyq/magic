<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property float $use_amount
 * @property int $use_token
 * @property string $model
 * @property string $user_id
 * @property string $app_code
 * @property string $organization_code
 * @property string $business_id
 * @property Carbon $created_at
 */
class MsgLogModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_api_msg_logs';

    protected array $fillable = [
        'id',
        'use_amount',
        'use_token',
        'model',
        'user_id',
        'app_code',
        'organization_code',
        'business_id',
        'source_id',
        'user_name',
        'access_token_id',
        'created_at',
        'provider_id',
        'provider_model_id',
        'prompt_tokens',
        'completion_tokens',
        'cache_write_tokens',
        'cache_read_tokens',
    ];

    protected array $casts = [
        'id' => 'int',
        'use_amount' => 'float',
        'use_token' => 'int',
        'model' => 'string',
        'user_id' => 'string',
        'app_code' => 'string',
        'organization_code' => 'string',
        'business_id' => 'string',
        'source_id' => 'string',
        'user_name' => 'string',
        'access_token_id' => 'string',
        'created_at' => 'datetime',
        'provider_id' => 'string',
        'provider_model_id' => 'string',
        'prompt_tokens' => 'int',
        'completion_tokens' => 'int',
        'cache_write_tokens' => 'int',
        'cache_read_tokens' => 'int',
    ];
}
