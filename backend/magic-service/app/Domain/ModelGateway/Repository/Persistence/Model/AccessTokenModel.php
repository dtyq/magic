<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $type
 * @property string $access_token
 * @property string $relation_id
 * @property string $name
 * @property string $description
 * @property array $models
 * @property array $ip_limit
 * @property null|Carbon $expire_time
 * @property float $total_amount
 * @property float $use_amount
 * @property int $rpm
 * @property string $organization_code
 * @property string $creator
 * @property Carbon $created_at
 * @property string $modifier
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 * @property bool $enabled
 */
class AccessTokenModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_api_access_tokens';

    protected array $fillable = [
        'id', 'type', 'access_token', 'relation_id', 'name', 'description', 'models', 'ip_limit',
        'expire_time', 'total_amount', 'use_amount', 'rpm', 'enabled',
        'organization_code', 'creator', 'created_at', 'modifier', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'type' => 'string',
        'access_token' => 'string',
        'relation_id' => 'string',
        'name' => 'string',
        'description' => 'string',
        'models' => 'string',
        'ip_limit' => 'string',
        'expire_time' => 'datetime',
        'total_amount' => 'float',
        'use_amount' => 'float',
        'rpm' => 'integer',
        'organization_code' => 'string',
        'creator' => 'string',
        'created_at' => 'datetime',
        'modifier' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'enabled' => 'boolean',
    ];

    public function setModelsAttribute(mixed $models): void
    {
        if (is_array($models)) {
            $models = implode(',', $models);
        }
        if (is_string($models)) {
            $this->attributes['models'] = $models;
        }
    }

    public function getModelsAttribute(?string $models): array
    {
        if (empty($models)) {
            return [];
        }
        return explode(',', $models);
    }

    public function setIpLimitAttribute(mixed $ipLimit): void
    {
        if (is_array($ipLimit)) {
            $ipLimit = implode(',', $ipLimit);
        }
        if (is_string($ipLimit)) {
            $this->attributes['ip_limit'] = $ipLimit;
        }
    }

    public function getIpLimitAttribute(?string $ipLimit): array
    {
        if (empty($ipLimit)) {
            return [];
        }
        return explode(',', $ipLimit);
    }
}
