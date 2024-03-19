<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Repository\Persistence\Model;

use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $user_id
 * @property string $type
 * @property string $platform
 * @property array $user
 * @property array $token
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 */
class MagicAuthenticationUserModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_authentication_user';

    protected array $fillable = [
        'id', 'organization_code', 'user_id', 'type', 'platform', 'user', 'token',
        'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'type' => 'string',
        'platform' => 'string',
        'user' => 'json',
        'token' => 'json',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
    ];
}
