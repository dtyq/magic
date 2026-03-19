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
 * @property string $code Skill 唯一标识码
 * @property string $creator_id 创建者用户 ID
 * @property string $package_name Skill 包唯一标识名
 * @property null|string $package_description Skill 包描述
 * @property array $name_i18n 多语言展示名
 * @property null|array $description_i18n 多语言展示描述
 * @property null|string $logo Logo 图片 URL
 * @property string $file_key 压缩包在对象存储中的 key
 * @property string $source_type 来源类型
 * @property null|int $source_id 来源关联 ID
 * @property null|array $source_meta 来源扩展元数据
 * @property null|int $version_id 版本ID
 * @property null|string $version_code 版本号
 * @property bool $is_enabled 是否启用
 * @property null|Carbon $pinned_at 置顶时间
 * @property null|int $project_id 项目ID
 * @property null|Carbon $latest_published_at Latest published timestamp
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class SkillModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_skills';

    protected array $fillable = [
        'id',
        'organization_code',
        'code',
        'creator_id',
        'package_name',
        'package_description',
        'name_i18n',
        'description_i18n',
        'logo',
        'file_key',
        'source_type',
        'source_id',
        'source_meta',
        'version_id',
        'version_code',
        'is_enabled',
        'pinned_at',
        'project_id',
        'latest_published_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'code' => 'string',
        'creator_id' => 'string',
        'package_name' => 'string',
        'package_description' => 'string',
        'name_i18n' => 'array',
        'description_i18n' => 'array',
        'logo' => 'string',
        'file_key' => 'string',
        'source_type' => 'string',
        'source_id' => 'integer',
        'source_meta' => 'array',
        'version_id' => 'integer',
        'version_code' => 'string',
        'is_enabled' => 'boolean',
        'pinned_at' => 'datetime',
        'project_id' => 'integer',
        'latest_published_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
