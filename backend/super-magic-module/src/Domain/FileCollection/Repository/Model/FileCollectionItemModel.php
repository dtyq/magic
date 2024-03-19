<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\FileCollection\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * 文件集项模型.
 *
 * @property int $id
 * @property int $collection_id
 * @property string $file_id
 * @property string $created_at
 * @property string $updated_at
 * @property null|string $deleted_at
 */
class FileCollectionItemModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * 表名.
     */
    protected ?string $table = 'magic_file_collection_items';

    /**
     * 主键.
     */
    protected string $primaryKey = 'id';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id',
        'collection_id',
        'file_id',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 自动类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'collection_id' => 'integer',
        'created_at' => 'string',
        'updated_at' => 'string',
        'deleted_at' => 'string',
    ];
}
