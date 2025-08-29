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
 * @property array $name_i18n
 * @property string $icon
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

    protected ?string $table = 'magic_mode_groups';

    protected array $fillable = [
        'id',
        'mode_id',
        'name_i18n',
        'icon',
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
        'name_i18n' => 'array',
        'sort' => 'integer',
        'status' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
