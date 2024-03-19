<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * @property int $id
 * @property int $ancestor_id 祖先节点id, comments表的主键id
 * @property int $descendant_id 后代节点id, comments表的主键id
 * @property int $distance 祖先节点到后代节点的距离
 * @property string $organization_code 组织code
 * @property string $created_at
 * @property string $updated_at
 */
class AbstractTreeIndexModel extends AbstractModel
{
}
