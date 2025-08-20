<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Hyperf\Database\Model\SoftDeletes;

class TaskFileModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_agent_task_files';

    protected string $primaryKey = 'file_id';

    /**
     * 可填充字段列表.
     */
    protected array $fillable = [
        'file_id',
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
        'storage_type', // 存储类型，由FileProcessAppService.processAttachmentsArray方法传入
        'is_hidden', // 是否为隐藏文件
        'is_directory', // 是否为目录
        'sort', // 排序字段
        'parent_id', // 父级ID
        'metadata', // 文件元数据，存储 JSON
        'source', // 来源字段：1-首页，2-项目目录，3-agent
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
        'source' => TaskFileSource::HOME->value, // 默认来源为首页
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
}
