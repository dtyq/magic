<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\FileService;

class FileServiceRouteManager
{
    protected static array $routes = [
        'temporary-credential' => [
            'route' => '/file/temporary-credential',
            'internal_route' => '/file/temporary-credential/internal',
        ],
        'show' => [
            'route' => '/file/show',
            'internal_route' => '/file/show/internal',
        ],
        'links' => [
            'route' => '/file/links/path',
            'internal_route' => '/file/links/path/internal',
        ],
        'destroy' => [
            'route' => '/file/destroy',
            'internal_route' => '',
        ],
        'copy' => [
            'route' => '/file/copy',
            'internal_route' => '',
        ],
        'pre-signed-urls' => [
            'route' => '/file/pre-signed-urls',
            'internal_route' => '',
        ],
    ];

    public static function get(string $key, array $options): string
    {
        $route = self::$routes[$key]['route'] ?? '';
        if (isset($options['internal']) && $options['internal'] === true) {
            if (isset(self::$routes[$key]['internal_route'])) {
                $route = self::$routes[$key]['internal_route'];
            }
        }
        return $route;
    }
}
