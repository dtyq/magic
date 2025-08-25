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
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileProcessAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileSaveContentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleAgentMessageAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\MessageQueueAppService;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessage;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareRepositoryInterface;
use Dtyq\SuperMagic\Domain\Share\Repository\Persistence\ResourceShareRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectForkRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TokenUsageRecordRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\ProjectForkRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\ProjectMemberRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageQueueRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\ProjectRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TaskFileRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TaskMessageRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TaskRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TokenUsageRecordRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\TopicRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\WorkspaceRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\WorkspaceVersionRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence\MessageQueueRepository;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine\SandboxService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\SandboxAgentService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\FileConverterInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\FileConverterService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayService;
use Dtyq\SuperMagic\Listener\AddRouteListener;
use Dtyq\SuperMagic\Listener\I18nLoadListener;
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
                ProjectRepositoryInterface::class => ProjectRepository::class,
                SandboxInterface::class => SandboxService::class,
                ProjectMemberRepositoryInterface::class => ProjectMemberRepository::class,
                // 添加SandboxOS相关服务的依赖注入
                SandboxGatewayInterface::class => SandboxGatewayService::class,
                SandboxAgentInterface::class => SandboxAgentService::class,
                FileConverterInterface::class => FileConverterService::class,
                AgentAppService::class => AgentAppService::class,
                // 添加FileProcessAppService的依赖注入
                FileProcessAppService::class => FileProcessAppService::class,
                // 添加HandleAgentMessageAppService的依赖注入
                HandleAgentMessageAppService::class => HandleAgentMessageAppService::class,
                // 添加MessageQueueAppService的依赖注入
                MessageQueueAppService::class => MessageQueueAppService::class,
                // 添加SandboxFileEditAppService的依赖注入
                FileSaveContentAppService::class => FileSaveContentAppService::class,
                // 添加分享相关服务
                ShareableResourceFactory::class => ShareableResourceFactory::class,
                TopicShareableResource::class => TopicShareableResource::class,
                ResourceShareRepositoryInterface::class => ResourceShareRepository::class,
                ResourceShareAppService::class => ResourceShareAppService::class,
                TokenUsageRecordRepositoryInterface::class => TokenUsageRecordRepository::class,
                WorkspaceVersionRepositoryInterface::class => WorkspaceVersionRepository::class,
                ProjectForkRepositoryInterface::class => ProjectForkRepository::class,
                MessageQueueRepositoryInterface::class => MessageQueueRepository::class,
            ],
            'listeners' => [
                AddRouteListener::class,
                I18nLoadListener::class,
            ],
            'error_message' => [
                'error_code_mapper' => [
                    SuperAgentErrorCode::class => [51000, 51299],
                    ShareErrorCode::class => [51300, 51400],
                ],
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
