<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Model;

use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\Builder;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @method static Builder projectSpace()
 * @method static Builder visibleProjectFiles()
 */
class TaskFileModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * file_id 由调用方按雪花 ID 显式赋值，不依赖数据库自增，必须保持 false。
     *
     * Eloquent 默认按自增模型插入：插入成功后会把 PDO::lastInsertId() 写回主键属性
     * （Hyperf\Database\Model\Model::insertAndSetId）。而本表的 INSERT 一定显式带 file_id，
     * MySQL 不会为该语句生成自增值，lastInsertId() 返回的是这条连接上「最近一次自增插入」
     * 的残留值（可能来自其它任何表）。一旦回写，内存里的 file_id 就与真正入库的值不一致，
     * MagicFS 创建接口会把该残留值当 file.id 返回给挂载端，之后按 file_id 的查询一律查不到
     * （51300 文件不存在），挂载端改这个新节点就失败。
     */
    public bool $incrementing = false;

    protected ?string $table = 'magic_super_agent_task_files';

    protected string $primaryKey = 'file_id';

    /**
     * 可填充字段列表.
     */
    protected array $fillable = [
        'file_id',
        'source_file_id',
        'user_id',
        'organization_code',
        'project_id',
        'topic_id',
        'latest_modified_topic_id',
        'task_id',
        'latest_modified_task_id',
        'file_type',
        'file_name',
        'file_extension',
        'file_key',
        'file_size',
        'external_url',
        'storage_type', // 存储类型
        'is_hidden', // 是否为隐藏文件
        'is_directory', // 是否为目录
        'sort', // 排序字段
        'parent_id', // 父级ID
        'metadata', // 文件元数据，存储 JSON
        'display_config', // 前端展示配置，存储 JSON
        'source', // 来源字段，取值见 TaskFileSource 枚举
        'latest_version', // 版本号，用于内容版本管理
        'metadata_version', // 元数据版本号，用于 MagicFS 缓存失效检测（包含重命名、移动等操作）
        'space_type', // 文件所属空间类型：project-项目，user-用户
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 默认属性值
     */
    protected array $attributes = [
        'storage_type' => StorageType::WORKSPACE->value, // 默认存储类型为workspace
        'is_hidden' => 0, // 默认不是隐藏文件：0-否，1-是
        'is_directory' => 0, // 默认不是目录：0-否，1-是
        'sort' => 0, // 默认排序为0
        'source' => TaskFileSource::DEFAULT->value, // 默认来源：未标记（首次入口由写入方显式指定）
        'latest_version' => 1, // 默认版本号为1
        'metadata_version' => 1, // 默认元数据版本号为1
    ];

    /**
     * 类型转换.
     */
    protected array $casts = [
        'is_hidden' => 'boolean', // 自动将数据库中的0/1转换为false/true
        'is_directory' => 'boolean', // 自动将数据库中的0/1转换为false/true
        'source' => TaskFileSource::class, // 自动将数据库中的int转换为TaskFileSource枚举
        'storage_type' => StorageType::class, // 自动将数据库中的string转换为StorageType枚举
    ];

    /**
     * 项目空间包含隐藏文件和目录，供完整空间统计复用。
     * 权限、项目范围和删除状态由调用方决定，不影响 topic／user 的内部查询。
     */
    public function scopeProjectSpace(Builder $query): Builder
    {
        return $query->where($this->qualifyColumn('space_type'), FileSpaceType::PROJECT->value)
            ->where($this->qualifyColumn('storage_type'), StorageType::WORKSPACE->value);
    }

    /**
     * 普通项目文件展示排除内部隐藏文件；此条件不代替用户权限检查。
     * 回收站须显式 withTrashed()，普通列表保留默认软删除过滤。
     */
    public function scopeVisibleProjectFiles(Builder $query): Builder
    {
        return $this->scopeProjectSpace($query)->where($this->qualifyColumn('is_hidden'), false);
    }

    public function getDates(): array
    {
        return [];
    }
}
