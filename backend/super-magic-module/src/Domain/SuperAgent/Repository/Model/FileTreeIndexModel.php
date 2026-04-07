<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

class FileTreeIndexModel extends AbstractModel
{
    protected ?string $table = 'magic_super_agent_file_tree_indexes';

    protected string $primaryKey = 'id';

    /**
     * 可填充字段列表.
     */
    protected array $fillable = [
        'id',
        'ancestor_id',
        'descendant_id',
        'distance',
        'organization_code',
        'created_at',
        'updated_at',
    ];

    /**
     * 类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'ancestor_id' => 'integer',
        'descendant_id' => 'integer',
        'distance' => 'integer',
        'organization_code' => 'string',
    ];

    public function getDates(): array
    {
        return [];
    }
}
