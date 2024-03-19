<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Application\Kernel\Event\Subscribe\MagicWatchDogSubscriber;
use App\Infrastructure\Core\I18nLoad\PackageI18nLoadListener;
use Hyperf\Command\Listener\FailToHandleListener;
use Hyperf\ExceptionHandler\Listener\ErrorExceptionHandler;

return [
    ErrorExceptionHandler::class,
    FailToHandleListener::class,
    MagicWatchDogSubscriber::class,
    // 通用包翻译加载监听器
    PackageI18nLoadListener::class => 1,
];
