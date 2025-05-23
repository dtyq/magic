<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic;

use App\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessageInterface;
use App\Domain\Chat\Event\Agent\AgentExecuteInterface;
use Dtyq\SuperMagic\Application\Share\Adapter\TopicShareableResource;
use Dtyq\SuperMagic\Application\Share\Factory\ShareableResourceFactory;
use Dtyq\SuperMagic\Application\Share\Service\ResourceShareAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe\SuperAgentMessageSubscriberV2;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileProcessAppService;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessage;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareRepositoryInterface;
use Dtyq\SuperMagic\Domain\Share\Repository\Persistence\ResourceShareRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TaskFileRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TaskMessageRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TaskRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TopicRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\WorkspaceRepository;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine\SandboxService;
use Dtyq\SuperMagic\Listener\AddRouteListener;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

class ConfigProvider
{
    public function __invoke(): array
    {
        $publishConfigs = [];

        // 遍历 publish/route 文件夹下的所有文件
        $routeDir = __DIR__ . '/../publish/route/';
        if (is_dir($routeDir)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($routeDir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $relativePath = $file->getSubPath() . '/' . $file->getFilename();
                    $publishConfigs[] = [
                        'id' => 'route_' . str_replace('/', '_', $relativePath),
                        'description' => 'Route file: ' . $relativePath,
                        'source' => $file->getPathname(),
                        'destination' => BASE_PATH . '/config/' . $relativePath,
                    ];
                }
            }
        }

        return [
            'dependencies_priority' => [
                // 助理执行事件
                AgentExecuteInterface::class => SuperAgentMessageSubscriberV2::class,
                SuperAgentMessageInterface::class => SuperAgentMessage::class,
            ],
            'dependencies' => [
                // 添加接口到实现类的映射
                TaskFileRepositoryInterface::class => TaskFileRepository::class,
                TopicRepositoryInterface::class => TopicRepository::class,
                TaskRepositoryInterface::class => TaskRepository::class,
                WorkspaceRepositoryInterface::class => WorkspaceRepository::class,
                TaskMessageRepositoryInterface::class => TaskMessageRepository::class,
                SandboxInterface::class => SandboxService::class,
                // 添加FileProcessAppService的依赖注入
                FileProcessAppService::class => FileProcessAppService::class,
                // 添加分享相关服务
                ShareableResourceFactory::class => ShareableResourceFactory::class,
                TopicShareableResource::class => TopicShareableResource::class,
                ResourceShareRepositoryInterface::class => ResourceShareRepository::class,
                ResourceShareAppService::class => ResourceShareAppService::class,
            ],
            'listeners' => [
                AddRouteListener::class,
            ],
            'commands' => [],
            'annotations' => [
                'scan' => [
                    'paths' => [
                        __DIR__,
                    ],
                ],
            ],
            'publish' => $publishConfigs,
        ];
    }

    public function getRoutes(): array
    {
        return [
            'routes' => [
                'path' => __DIR__ . '/../publish/route',
            ],
        ];
    }
}
