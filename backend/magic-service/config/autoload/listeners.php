<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Application\Kernel\Event\Subscribe\MagicWatchDogSubscriber;
use App\Application\SuperMagic\File\Event\Subscribe\FileTreeChangeTransactionSubscriber;
use App\Infrastructure\Core\I18nLoad\PackageI18nLoadListener;
use App\Infrastructure\Rpc\Listener\StartRpcClientListener;
use Hyperf\Command\Listener\FailToHandleListener;
use Hyperf\ExceptionHandler\Listener\ErrorExceptionHandler;

return [
    ErrorExceptionHandler::class,
    FailToHandleListener::class,
    MagicWatchDogSubscriber::class,
    // 文件树变更推送：事务提交后才 emit，回滚则丢弃（顺序保证见类注释）
    FileTreeChangeTransactionSubscriber::class,
    // 通用包翻译加载监听器
    PackageI18nLoadListener::class => 1,
    // RPC 客户端生命周期监听器（只负责启动与停止 PHP 侧 RPC 客户端）
    StartRpcClientListener::class,
];
