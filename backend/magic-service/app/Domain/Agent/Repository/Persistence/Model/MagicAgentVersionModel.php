<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

class MagicAgentVersionModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_bot_versions';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'flow_code',
        'flow_version',
        'instructs',
        'root_id',
        'robot_name',
        'robot_avatar',
        'robot_description',
        'version_name',
        'version_description',
        'version_number',
        'release_scope',
        'approval_status',
        'review_status',
        'enterprise_release_status',
        'app_market_status',
        'created_uid',
        'created_at',
        'updated_uid',
        'updated_at',
        'deleted_at',
        'organization_code',
        'start_page',
        'visibility_config',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
        'flow_code' => 'string',
        'version_number' => 'string',
        'flow_version' => 'string',
        'root_id' => 'string',
        'instructs' => 'json',
        'start_page' => 'bool',
    ];
}
