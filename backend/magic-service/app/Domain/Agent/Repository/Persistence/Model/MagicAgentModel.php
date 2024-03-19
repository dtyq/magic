<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence\Model;

use Hyperf\Database\Model\Relations\HasOne;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property string $id
 */
class MagicAgentModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_bots';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'bot_version_id',
        'instructs',
        'status',
        'flow_code',
        'code',
        'robot_name',
        'robot_avatar',
        'robot_description',
        'version_name',
        'created_uid',
        'created_at',
        'updated_uid',
        'updated_at',
        'deleted_at',
        'organization_code',
        'start_page',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
        'bot_version_id' => 'string',
        'flow_code' => 'string',
        'code' => 'string',
        'instructs' => 'json',
        'start_page' => 'bool',
    ];

    public function lastVersionInfo(): HasOne
    {
        return $this->hasOne(MagicAgentVersionModel::class, 'id', 'bot_version_id');
    }
}
