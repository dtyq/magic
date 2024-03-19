<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

class DepartmentModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_departments';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'department_id',
        'parent_department_id',
        'name',
        'i18n_name',
        'order',
        'leader_user_id',
        'organization_code',
        'status',
        'path',
        'level',
        'created_at',
        'updated_at',
        'deleted_at',
        'document_id',
        'employee_sum',
        'option',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
