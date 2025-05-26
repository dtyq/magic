<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence\Model;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * 知识库文档模型.
 * @property int $id 主键ID
 * @property string $organization_code 组织编码
 * @property string $knowledge_base_code 知识库编码
 * @property string $name 文档名称
 * @property string $code 文档编码
 * @property int $version 版本号
 * @property bool $enabled 是否启用
 * @property int $doc_type 文档类型
 * @property array $doc_metadata 文档元数据
 * @property DocumentFileInterface $document_file 文档文件信息
 * @property string $third_platform_type 第三方平台类型
 * @property string $third_file_id 第三方文件ID
 * @property int $sync_status 同步状态
 * @property int $sync_times 同步次数
 * @property string $sync_status_message 同步状态消息
 * @property string $embedding_model 嵌入模型
 * @property string $vector_db 向量数据库
 * @property array $retrieve_config 检索配置
 * @property array $fragment_config 片段配置
 * @property array $embedding_config 嵌入配置
 * @property array $vector_db_config 向量数据库配置
 * @property string $created_uid 创建者UID
 * @property string $updated_uid 更新者UID
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property null|string $deleted_at 删除时间
 * @property int $word_count 字数统计
 */
class KnowledgeBaseDocumentModel extends Model
{
    use SoftDeletes;
    use Snowflake;

    /**
     * 是否自增.
     */
    public bool $incrementing = true;

    /**
     * 表名.
     */
    protected ?string $table = 'knowledge_base_documents';

    /**
     * 主键名.
     */
    protected string $primaryKey = 'id';

    /**
     * 可填充字段.
     */
    protected array $fillable = [
        'organization_code',
        'knowledge_base_code',
        'name',
        'description',
        'code',
        'version',
        'enabled',
        'doc_type',
        'doc_metadata',
        'document_file',
        'third_platform_type',
        'third_file_id',
        'sync_status',
        'sync_times',
        'sync_status_message',
        'embedding_model',
        'vector_db',
        'retrieve_config',
        'fragment_config',
        'embedding_config',
        'vector_db_config',
        'created_uid',
        'updated_uid',
        'word_count',
    ];

    /**
     * 类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'version' => 'integer',
        'enabled' => 'boolean',
        'doc_type' => 'integer',
        'doc_metadata' => 'json',
        'document_file' => 'json',
        'sync_status' => 'integer',
        'sync_times' => 'integer',
        'retrieve_config' => 'json',
        'fragment_config' => 'json',
        'embedding_config' => 'json',
        'vector_db_config' => 'json',
        'word_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
