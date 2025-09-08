<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $cache_hash
 * @property string $cache_prefix
 * @property string $cache_key
 * @property string $scope_tag
 * @property string $cache_value
 * @property int $ttl_seconds
 * @property DateTime $expires_at
 * @property string $organization_code
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 */
class MagicFlowCacheModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_flow_cache';

    protected array $fillable = [
        'id', 'cache_hash', 'cache_prefix', 'cache_key', 'scope_tag', 'cache_value',
        'ttl_seconds', 'expires_at', 'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'cache_hash' => 'string',
        'cache_prefix' => 'string',
        'cache_key' => 'string',
        'scope_tag' => 'string',
        'cache_value' => 'string',
        'ttl_seconds' => 'integer',
        'expires_at' => 'datetime',
        'organization_code' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
    ];
}
