<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class MagicClawModel extends AbstractModel
{
    use SoftDeletes;

    public const DELETED_AT = 'deleted_at';

    /**
     * Disable auto-increment; ID is generated externally via snowflake.
     */
    public bool $incrementing = false;

    protected ?string $table = 'magic_super_magic_claw';

    protected string $keyType = 'int';

    protected array $fillable = [
        'id',
        'code',
        'name',
        'description',
        'icon',
        'organization_code',
        'user_id',
        'project_id',
        'created_uid',
        'updated_uid',
    ];

    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
