<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

enum ReferencedProjectAccessKind: string
{
    case Collaboration = 'collaboration';
    case PublishedShare = 'published_share';
}
