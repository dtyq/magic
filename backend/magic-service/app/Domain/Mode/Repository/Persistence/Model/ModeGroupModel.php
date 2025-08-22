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
 * @property string $name
 * @property string $icon
 * @property string $color
 * @property string $description
 * @property int $sort
 * @property int $status
 * @property string $organization_code
 * @property string $creator_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 */
class ModeGroupModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_model_groups';

    protected array $fillable = [
        'id',
        'mode_id',
        'name',
        'icon',
        'color',
        'description',
        'sort',
        'status',
        'organization_code',
        'creator_id',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'mode_id' => 'integer',
        'sort' => 'integer',
        'status' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
