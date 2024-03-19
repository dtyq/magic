<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Audit\Listener;

use App\Domain\Audit\Contract\PermissionLabelProviderInterface;
use App\Domain\Audit\Event\AdminOperationLogEvent;
use App\Domain\Audit\Factory\AdminOperationLogFactory;
use App\Domain\Audit\Service\AdminOperationLogDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;
use Throwable;

/**
 * 管理员操作日志监听器.
 * 监听权限验证通过的事件，记录操作日志.
 * 注意：通过本地事件分发器同步调用，但内部异常不会影响业务流程.
 */
#[Listener]
class AdminOperationLogListener implements ListenerInterface
{
    public function __construct(
        protected ContainerInterface $container
    ) {
    }

    public function listen(): array
    {
        return [
            AdminOperationLogEvent::class,
        ];
    }

    /**
     * 处理事件.
     * 关键：整个方法用 try-catch 包裹，确保任何异常都不会影响业务流程.
     * 注意：此方法在当前进程中同步执行，但异常被完全捕获.
     */
    public function process(object $event): void
    {
        try {
            if (! $event instanceof AdminOperationLogEvent) {
                return;
            }

            // 获取权限标签提供者（通过接口获取，符合依赖倒置原则）
            $labelProvider = $this->container->get(PermissionLabelProviderInterface::class);

            // 从事件创建日志实体
            $logEntity = AdminOperationLogFactory::createFromEvent($event, $labelProvider);

            // 构建数据隔离上下文
            $authorization = $event->getAuthorization();
            $dataIsolation = PermissionDataIsolation::create(
                $authorization->getOrganizationCode(),
                $authorization->getId()
            );

            // 保存日志 - Infrastructure层直接调用Domain层服务，符合DDD分层原则
            $domainService = $this->container->get(AdminOperationLogDomainService::class);
            $domainService->save($dataIsolation, $logEntity);
        } catch (Throwable $e) {
            // 关键：静默处理所有异常，绝对不能影响业务
            // 不记录错误日志，避免引入额外的依赖和失败点
        }
    }
}
