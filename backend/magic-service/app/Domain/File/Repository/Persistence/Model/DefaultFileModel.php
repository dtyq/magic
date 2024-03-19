<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Repository\Persistence\Model;

use DateTime;
use Hyperf\Database\Model\Model;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 主键ID
 * @property int $business_type 模块类型，文件属于哪个模块
 * @property int $file_type 文件类型：0:官方添加，1:组织添加
 * @property string $key 文件key
 * @property int $file_size 文件大小
 * @property string $organization 组织编码
 * @property string $file_extension 文件后缀
 * @property string $user_id 上传者ID
 * @property DateTime $created_at 创建时间
 * @property DateTime $updated_at 更新时间
 * @property DateTime $deleted_at 删除时间
 */
class DefaultFileModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    /**
     * 与模型关联的表名.
     */
    protected ?string $table = 'default_files';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id',
        'business_type',
        'file_type',
        'key',
        'file_size',
        'organization',
        'file_extension',
        'user_id',
        'created_at',
        'updated_at',
        'deleted_at',
    ];
}
