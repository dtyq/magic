<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $name
 * @property string $provider_code
 * @property string $description
 * @property string $icon
 * @property int $provider_type
 * @property string $category
 * @property int $status
 * @property int $is_models_enable
 * @property DateTime $created_at
 * @property DateTime $updated_at
 * @property DateTime $deleted_at
 * @property array $translate
 * @property string $remark
 */
class ProviderModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'service_provider';

    protected array $fillable = [
        'id', 'name', 'provider_code', 'description', 'icon', 'provider_type', 'category',
        'status', 'is_models_enable', 'created_at', 'updated_at', 'deleted_at',
        'translate', 'remark',
    ];

    protected array $casts = [
        'id' => 'integer',
        'name' => 'string',
        'provider_code' => 'string',
        'description' => 'string',
        'icon' => 'string',
        'provider_type' => 'integer',
        'category' => 'string',
        'status' => 'integer',
        'is_models_enable' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'translate' => 'json',
        'remark' => 'string',
    ];
}
