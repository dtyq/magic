<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\Share\Facade\InternalShareApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/internal', static function () {
    // Get share title by resource ID
    Router::get('/{resource_id}/share_title', [InternalShareApi::class, 'getShareTitle']);
});
