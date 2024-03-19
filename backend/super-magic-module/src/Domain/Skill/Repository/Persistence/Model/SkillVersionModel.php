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
 * @property int $id 主键 ID（版本ID）
 * @property string $code Skill 唯一标识码
 * @property string $organization_code 归属组织编码
 * @property string $creator_id 创建操作人用户 ID
 * @property string $package_name Skill 包唯一标识名
 * @property null|string $package_description Skill 包描述
 * @property string $version 当前生效版本号
 * @property array $name_i18n 多语言展示名
 * @property null|array $description_i18n 多语言展示描述
 * @property null|string $logo Logo 图片 URL
 * @property string $file_key 压缩包在对象存储中的 key
 * @property string $publish_status 发布状态
 * @property string $review_status 审核状态
 * @property string $source_type 来源类型
 * @property null|int $source_id 来源关联 ID
 * @property null|array $source_meta 来源扩展元数据
 * @property null|int $project_id 项目ID
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class SkillVersionModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_skill_versions';

    protected array $fillable = [
        'id',
        'code',
        'organization_code',
        'creator_id',
        'package_name',
        'package_description',
        'version',
        'name_i18n',
        'description_i18n',
        'logo',
        'file_key',
        'publish_status',
        'review_status',
        'source_type',
        'source_id',
        'source_meta',
        'project_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'code' => 'string',
        'organization_code' => 'string',
        'creator_id' => 'string',
        'package_name' => 'string',
        'package_description' => 'string',
        'version' => 'string',
        'name_i18n' => 'array',
        'description_i18n' => 'array',
        'logo' => 'string',
        'file_key' => 'string',
        'publish_status' => 'string',
        'review_status' => 'string',
        'source_type' => 'string',
        'source_id' => 'integer',
        'source_meta' => 'array',
        'project_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
