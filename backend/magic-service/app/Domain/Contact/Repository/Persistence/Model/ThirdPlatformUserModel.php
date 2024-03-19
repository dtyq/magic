<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class ThirdPlatformUserModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_third_platform_users';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'magic_id',
        'magic_user_id',
        'magic_organization_code',
        'third_user_id',
        'third_union_id',
        'third_platform_type',
        'third_employee_no',
        'third_real_name',
        'third_nick_name',
        'third_avatar',
        'third_gender',
        'third_email',
        'third_mobile',
        'third_id_number',
        'third_platform_users_extra',
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
