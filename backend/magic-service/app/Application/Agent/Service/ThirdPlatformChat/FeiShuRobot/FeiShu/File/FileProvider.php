<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShu\File;

use Pimple\Container;
use Pimple\ServiceProviderInterface;

class FileProvider implements ServiceProviderInterface
{
    public function register(Container $pimple): void
    {
        $pimple['file'] = function ($pimple) {
            return new File($pimple['http'], $pimple['tenant_access_token']);
        };
    }
}
