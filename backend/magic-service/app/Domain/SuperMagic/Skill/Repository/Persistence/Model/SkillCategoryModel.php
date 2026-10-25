<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id 主键 ID
 * @property int $parent_id 父分类 ID
 * @property string $organization_code 归属组织编码
 * @property array $name_i18n 多语言名称
 * @property null|string $logo Logo 图片 URL
 * @property int $sort_order 排序权重
 * @property int $status 状态
 * @property string $creator_id 创建者用户 ID
 * @property null|string $modifier_id 最后更新者用户 ID
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class SkillCategoryModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_skill_categories';

    protected array $fillable = [
        'id',
        'parent_id',
        'organization_code',
        'name_i18n',
        'logo',
        'sort_order',
        'status',
        'creator_id',
        'modifier_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'parent_id' => 'integer',
        'organization_code' => 'string',
        'name_i18n' => 'array',
        'logo' => 'string',
        'sort_order' => 'integer',
        'status' => 'integer',
        'creator_id' => 'string',
        'modifier_id' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
