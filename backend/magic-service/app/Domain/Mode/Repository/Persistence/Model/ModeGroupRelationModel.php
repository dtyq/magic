<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id
 * @property int $mode_id
 * @property int $group_id
 * @property int $model_id
 * @property int $sort
 * @property string $organization_code
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class ModeGroupRelationModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_model_group_relations';

    protected array $fillable = [
        'id',
        'mode_id',
        'group_id',
        'model_id',
        'sort',
        'organization_code',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'mode_id' => 'integer',
        'group_id' => 'integer',
        'model_id' => 'integer',
        'sort' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
