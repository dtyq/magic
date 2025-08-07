<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 雪花ID
 * @property string $organization_code 组织编码
 * @property string $magic_id 账号MagicID
 * @property string $user_id 用户ID
 * @property string $key 设置键
 * @property array $value 设置值
 * @property string $creator 创建者
 * @property DateTime $created_at 创建时间
 * @property string $modifier 修改者
 * @property DateTime $updated_at 更新时间
 */
class UserSettingModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_user_settings';

    protected array $fillable = [
        'id',
        'organization_code',
        'magic_id',
        'user_id',
        'key',
        'value',
        'creator',
        'created_at',
        'modifier',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'magic_id' => 'string',
        'user_id' => 'string',
        'key' => 'string',
        'value' => 'json',
        'creator' => 'string',
        'created_at' => 'datetime',
        'modifier' => 'string',
        'updated_at' => 'datetime',
    ];
}
