<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Snowflake\Concern\Snowflake;

class ModelIdentifierMappingModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_model_identifier_mappings';

    protected array $fillable = [
        'id', 'group_id', 'group_name', 'source_model_id', 'target_model_id', 'status',
        'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'group_id' => 'string',
        'group_name' => 'string',
        'source_model_id' => 'string',
        'target_model_id' => 'string',
        'status' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
