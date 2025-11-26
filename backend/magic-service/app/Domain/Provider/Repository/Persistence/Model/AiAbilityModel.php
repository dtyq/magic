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
 * @property string $code
 * @property string $organization_code
 * @property array $name_i18n
 * @property array $description_i18n
 * @property string $icon
 * @property int $sort_order
 * @property int $status
 * @property string $config
 * @property DateTime $created_at
 * @property DateTime $updated_at
 */
class AiAbilityModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_ai_abilities';

    protected array $fillable = [
        'id',
        'code',
        'organization_code',
        'name_i18n',
        'description_i18n',
        'icon',
        'sort_order',
        'status',
        'config',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'code' => 'string',
        'organization_code' => 'string',
        'name_i18n' => 'json',
        'description_i18n' => 'json',
        'icon' => 'string',
        'sort_order' => 'integer',
        'status' => 'integer',
        'config' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
