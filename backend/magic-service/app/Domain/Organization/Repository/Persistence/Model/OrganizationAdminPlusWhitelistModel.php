<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Organization\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id
 * @property string $organization_code
 * @property int $enabled
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 */
class OrganizationAdminPlusWhitelistModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_organization_adminplus_whitelist';

    protected array $fillable = [
        'id',
        'organization_code',
        'enabled',
    ];

    protected array $casts = [
        'id' => 'integer',
        'enabled' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
