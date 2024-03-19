<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;

/**
 * @property int $id
 * @property string $model_id
 * @property int $type
 * @property string $organization_code
 * @property null|DateTime $created_at
 * @property null|DateTime $updated_at
 * @property null|DateTime $deleted_at
 */
class ProviderOriginalModelModel extends AbstractModel
{
    protected ?string $table = 'service_provider_original_models';

    protected array $fillable = [
        'id', 'model_id', 'type', 'organization_code',
        'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'model_id' => 'string',
        'type' => 'integer',
        'organization_code' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
