<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShu\Image;

use Pimple\Container;
use Pimple\ServiceProviderInterface;

class ImageProvider implements ServiceProviderInterface
{
    public function register(Container $pimple)
    {
        $pimple['image'] = function ($pimple) {
            return new Image($pimple['http'], $pimple['tenant_access_token']);
        };
    }
}
