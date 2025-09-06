<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class OrganizationAdminModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * 状态常量.
     */
    public const STATUS_DISABLED = 0;

    public const STATUS_ENABLED = 1;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_organization_admins';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'user_id',
        'organization_code',
        'magic_id',
        'grantor_user_id',
        'granted_at',
        'status',
        'is_organization_creator',
        'remarks',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'status' => 'integer',
        'is_organization_creator' => 'boolean',
        'granted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
