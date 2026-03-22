<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id 主键 ID
 * @property string $organization_code 归属组织编码
 * @property string $skill_code Skill 唯一标识码
 * @property int $skill_version_id 关联的 Skill 版本 ID
 * @property null|array $name_i18n 多语言展示名称
 * @property null|array $description_i18n 多语言展示描述
 * @property null|string $search_text 统一小写搜索字段
 * @property null|string $logo Logo 图片 URL
 * @property string $publisher_id 发布者用户 ID
 * @property string $publisher_type 发布者类型
 * @property null|int $category_id 分类 ID
 * @property string $publish_status 发布状态
 * @property int $install_count 安装次数
 * @property null|int $sort_order 排序值，数值越大越靠前
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class SkillMarketModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_skill_market';

    protected array $fillable = [
        'id',
        'organization_code',
        'skill_code',
        'skill_version_id',
        'name_i18n',
        'description_i18n',
        'search_text',
        'logo',
        'publisher_id',
        'publisher_type',
        'category_id',
        'publish_status',
        'install_count',
        'sort_order',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'skill_code' => 'string',
        'skill_version_id' => 'integer',
        'name_i18n' => 'array',
        'description_i18n' => 'array',
        'search_text' => 'string',
        'logo' => 'string',
        'publisher_id' => 'string',
        'publisher_type' => 'string',
        'category_id' => 'integer',
        'publish_status' => 'string',
        'install_count' => 'integer',
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
