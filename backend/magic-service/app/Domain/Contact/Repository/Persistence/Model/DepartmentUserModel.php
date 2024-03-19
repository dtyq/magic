<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property string $magic_id
 * @property string $user_id
 * @property string $department_id
 * @property string $job_title
 */
class DepartmentUserModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_department_users';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'magic_id',
        'user_id',
        'department_id',
        'is_leader',
        'job_title',
        'leader_user_id',
        'organization_code',
        'city',
        'country',
        'join_time',
        'employee_no',
        'employee_type',
        'orders',
        'custom_attrs',
        'department_path',
        'is_frozen',
        'created_at',
        'updated_at',
        'deleted_at',
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
