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
 * @property int $service_provider_config_id
 * @property string $name
 * @property string $model_version
 * @property string $category
 * @property string $model_id
 * @property int $model_type
 * @property array $config
 * @property string $description
 * @property int $sort
 * @property string $icon
 * @property string $organization_code
 * @property int $status
 * @property string $disabled_by
 * @property array $translate
 * @property int $model_parent_id
 * @property array $visible_organizations
 * @property array $visible_applications
 * @property array $visible_packages
 * @property int $is_office
 * @property int $super_magic_display_state
 * @property DateTime $created_at
 * @property DateTime $updated_at
 * @property DateTime $deleted_at
 */
class ProviderModelModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'service_provider_models';

    protected array $fillable = [
        'id', 'service_provider_config_id', 'name', 'model_version', 'category', 'model_id',
        'model_type', 'config', 'description', 'sort', 'icon', 'organization_code',
        'status', 'disabled_by', 'translate', 'model_parent_id', 'visible_organizations', 'visible_applications', 'visible_packages',
        'load_balancing_weight', 'is_office', 'super_magic_display_state', 'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'service_provider_config_id' => 'integer',
        'name' => 'string',
        'model_version' => 'string',
        'category' => 'string',
        'model_id' => 'string',
        'model_type' => 'integer',
        'config' => 'array',
        'description' => 'string',
        'sort' => 'integer',
        'icon' => 'string',
        'organization_code' => 'string',
        'status' => 'integer',
        'disabled_by' => 'string',
        'translate' => 'array',
        'model_parent_id' => 'integer',
        'visible_organizations' => 'array',
        'visible_applications' => 'array',
        'load_balancing_weight' => 'integer',
        'visible_packages' => 'array',
        'is_office' => 'integer',
        'super_magic_display_state' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
