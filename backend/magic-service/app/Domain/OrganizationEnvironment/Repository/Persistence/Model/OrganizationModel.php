<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * 组织模型.
 *
 * @property int $id 主键ID
 * @property string $magic_organization_code
 * @property string $name 组织名称
 * @property null|string $platform_type 平台类型
 * @property null|string $logo 组织logo
 * @property null|string $introduction 企业描述
 * @property null|string $contact_user 联系人
 * @property null|string $contact_mobile 联系电话
 * @property string $industry_type 组织行业类型
 * @property null|string $number 企业规模
 * @property int $status 状态 1:正常 2:禁用
 * @property null|string $creator_id 创建人
 * @property int $type
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 删除时间
 */
class OrganizationModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    /**
     * 状态常量.
     */
    public const int STATUS_NORMAL = 1;

    public const int STATUS_DISABLED = 2;

    /**
     * 与模型关联的表名.
     */
    protected ?string $table = 'magic_organizations';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id',
        'magic_organization_code',
        'name',
        'platform_type',
        'logo',
        'introduction',
        'contact_user',
        'contact_mobile',
        'industry_type',
        'number',
        'status',
        'creator_id',
        'type',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 属性类型转换.
     */
    protected array $casts = [
        'id' => 'int',
        'magic_organization_code' => 'string',
        'name' => 'string',
        'platform_type' => 'string',
        'logo' => 'string',
        'introduction' => 'string',
        'contact_user' => 'string',
        'contact_mobile' => 'string',
        'industry_type' => 'string',
        'number' => 'string',
        'status' => 'int',
        'creator_id' => 'string',
        'type' => 'int',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * 启用组织.
     */
    public function enable(): void
    {
        $this->status = self::STATUS_NORMAL;
    }

    /**
     * 禁用组织.
     */
    public function disable(): void
    {
        $this->status = self::STATUS_DISABLED;
    }
}
