<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property int $type
 * @property string $relation_key1
 * @property string $relation_key2
 * @property string $relation_key3
 * @property array $params
 * @property array $suggestions
 * @property int $status
 * @property null|string $created_uid
 * @property string $created_at
 * @property string $updated_at
 */
class MagicGeneratedSuggestionModel extends Model
{
    protected ?string $table = 'magic_generated_suggestions';

    protected array $fillable = [
        'id',
        'type',
        'relation_key1',
        'relation_key2',
        'relation_key3',
        'params',
        'suggestions',
        'status',
        'created_uid',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'type' => 'integer',
        'params' => 'array',
        'suggestions' => 'array',
        'status' => 'integer',
    ];
}
