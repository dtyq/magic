<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse;

use Dtyq\ApiResponse\Exception\ApiResponseException;
use Dtyq\ApiResponse\Response\ResponseInterface;
use Dtyq\ApiResponse\Response\StandardResponse;

class ResponseFactory
{
    public static array $config = [
        'standard' => StandardResponse::class,
    ];

    public static function setConfig(array $config): void
    {
        self::$config = array_merge(self::$config, $config);
    }

    /**
     * @param null|mixed $version
     * @throws ApiResponseException
     */
    public static function create(?string $version = null): ResponseInterface
    {
        $version = $version ?: 'standard';
        if (! isset(self::$config[$version])) {
            throw new ApiResponseException('No Configuration Was Found:' . $version);
        }

        $abstract = self::$config[$version];
        if (! class_exists($abstract)) {
            throw new ApiResponseException('Class Does Not Exist:' . $abstract);
        }

        if (! is_a($abstract, ResponseInterface::class, true)) {
            throw new ApiResponseException('Class Must Inherit From ResponseInterface');
        }

        return new $abstract();
    }
}
