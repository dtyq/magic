<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Cache\Driver\FileSystemDriver;
use Hyperf\Cache\Driver\RedisDriver;
use Hyperf\Codec\Packer\PhpSerializerPacker;

/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'default' => [
        'driver' => RedisDriver::class,
        'packer' => PhpSerializerPacker::class,
        'prefix' => '',
    ],
    'file' => [
        'driver' => FileSystemDriver::class,
        'packer' => PhpSerializerPacker::class,
        'prefix' => '',
    ],
];
