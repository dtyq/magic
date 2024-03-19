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
 */
class ThirdPlatformDepartmentUserModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_third_platform_department_users';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'magic_department_id',
        'magic_organization_code',
        'third_department_id',
        'third_union_id',
        'third_platform_type',
        'third_is_leader',
        'third_job_title',
        'third_leader_user_id',
        'third_city',
        'third_country',
        'third_join_time',
        'third_employee_no',
        'third_employee_type',
        'third_custom_attrs',
        'third_department_path',
        'third_platform_department_users_extra',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
    ];
}
