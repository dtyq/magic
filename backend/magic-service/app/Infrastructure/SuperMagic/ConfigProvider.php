<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic;

use App\Application\SuperMagic\Common\Contract\AllowAllPromptContentValidator;
use App\Application\SuperMagic\Common\Contract\DefaultUserAiWatermarkPolicy;
use App\Application\SuperMagic\Common\Contract\PromptContentValidatorInterface;
use App\Application\SuperMagic\Common\Contract\UserAiWatermarkPolicyInterface;
use App\Application\SuperMagic\Common\Share\Adapter\SingleFileShareableResource;
use App\Application\SuperMagic\Common\Share\Adapter\TopicShareableResource;
use App\Application\SuperMagic\Common\Share\Factory\ShareableResourceFactory;
use App\Application\SuperMagic\Common\Share\Service\ResourceShareAppService;
use App\Application\SuperMagic\File\Service\FileProcessAppService;
use App\Application\SuperMagic\File\Service\MagicFSChangePublisher;
use App\Application\SuperMagic\Message\Service\HandleAgentMessageAppService;
use App\Application\SuperMagic\Message\Service\MessageQueueAppService;
use App\Application\SuperMagic\Message\Service\MessageScheduleAppService;
use App\Application\SuperMagic\Task\Contract\SandboxRebuildPortInterface;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Application\SuperMagic\Task\Service\AgentSandboxRebuildAdapter;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentCategoryRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentSkillRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\MagicClawRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\UserAgentRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Persistence\AgentCategoryRelationRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\AgentCategoryRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\AgentMarketRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\AgentPlaybookRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\AgentSkillRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\AgentVersionRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\MagicClawRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\SuperMagicAgentRepository;
use App\Domain\SuperMagic\Agent\Repository\Persistence\UserAgentRepository;
use App\Domain\SuperMagic\Common\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;
use App\Domain\SuperMagic\Common\RecycleBin\Repository\Persistence\RecycleBinRepository;
use App\Domain\SuperMagic\Common\Share\Repository\Facade\ResourceShareAccessLogRepositoryInterface;
use App\Domain\SuperMagic\Common\Share\Repository\Facade\ResourceShareCopyLogRepositoryInterface;
use App\Domain\SuperMagic\Common\Share\Repository\Facade\ResourceShareRepositoryInterface;
use App\Domain\SuperMagic\Common\Share\Repository\Persistence\ResourceShareAccessLogRepository;
use App\Domain\SuperMagic\Common\Share\Repository\Persistence\ResourceShareCopyLogRepository;
use App\Domain\SuperMagic\Common\Share\Repository\Persistence\ResourceShareRepository;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareAccessLogDomainService;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareCopyLogDomainService;
use App\Domain\SuperMagic\File\Contract\FileTreeChangePublisherInterface;
use App\Domain\SuperMagic\File\Repository\Facade\AudioMarkerRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\AudioProjectRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\BatchDownloadPackRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\FileCollectionItemRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\FileCollectionRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileCleanupRecordRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileVersionRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Persistence\AudioMarkerRepository;
use App\Domain\SuperMagic\File\Repository\Persistence\AudioProjectRepository;
use App\Domain\SuperMagic\File\Repository\Persistence\FileCollectionItemRepository;
use App\Domain\SuperMagic\File\Repository\Persistence\FileCollectionRepository;
use App\Domain\SuperMagic\File\Repository\Persistence\TaskFileCleanupRecordRepository;
use App\Domain\SuperMagic\File\Repository\Persistence\TaskFileRepository;
use App\Domain\SuperMagic\File\Repository\Persistence\TaskFileVersionRepository;
use App\Domain\SuperMagic\File\Service\TaskFileVersionDomainService;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageQueueRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageScheduleLogRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageScheduleRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Facade\TaskMessageRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Facade\TokenUsageRecordRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Persistence\MessageQueueRepository;
use App\Domain\SuperMagic\Message\Repository\Persistence\MessageScheduleLogRepository;
use App\Domain\SuperMagic\Message\Repository\Persistence\MessageScheduleRepository;
use App\Domain\SuperMagic\Message\Repository\Persistence\TaskMessageRepository;
use App\Domain\SuperMagic\Message\Repository\Persistence\TokenUsageRecordRepository;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppVisitRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectForkRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectMemberRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectMemberSettingRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectOperationLogRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\TransferLogRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppVisitRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectForkRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectMemberRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectMemberSettingRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectOperationLogRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\TransferLogRepository;
use App\Domain\SuperMagic\Project\Service\ProjectOperationLogDomainService;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillMarketRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\UserSkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Persistence\SkillCategoryRelationRepository;
use App\Domain\SuperMagic\Skill\Repository\Persistence\SkillCategoryRepository;
use App\Domain\SuperMagic\Skill\Repository\Persistence\SkillMarketRepository;
use App\Domain\SuperMagic\Skill\Repository\Persistence\SkillRepository;
use App\Domain\SuperMagic\Skill\Repository\Persistence\SkillVersionRepository;
use App\Domain\SuperMagic\Skill\Repository\Persistence\UserSkillRepository;
use App\Domain\SuperMagic\Task\Repository\Facade\SandboxKeepAliveRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Facade\WarmPoolSandboxRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Persistence\SandboxKeepAliveRepository;
use App\Domain\SuperMagic\Task\Repository\Persistence\TaskRepository;
use App\Domain\SuperMagic\Task\Repository\Persistence\WarmPoolSandboxRepository;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\Domain\SuperMagic\Topic\Repository\Persistence\TopicRepository;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceVersionRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Persistence\WorkspaceRepository;
use App\Domain\SuperMagic\Workspace\Repository\Persistence\WorkspaceVersionRepository;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\SandboxAgentService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\BatchDownloadPack\BatchDownloadPackRepository;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\FileConverter\FileConverterInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\FileConverter\FileConverterService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceExporterInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceExporterService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceImporterInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceImporterService;

class ConfigProvider
{
    public function __invoke(): array
    {
        return [
            'dependencies' => [
                PromptContentValidatorInterface::class => AllowAllPromptContentValidator::class,
                UserAiWatermarkPolicyInterface::class => DefaultUserAiWatermarkPolicy::class,
                // 添加接口到实现类的映射
                TaskFileRepositoryInterface::class => TaskFileRepository::class,
                // magicfs change feed：journal 追加点只依赖 domain 端口，推送实现放在 application 层
                FileTreeChangePublisherInterface::class => MagicFSChangePublisher::class,
                TaskFileCleanupRecordRepositoryInterface::class => TaskFileCleanupRecordRepository::class,
                TaskFileVersionRepositoryInterface::class => TaskFileVersionRepository::class,
                TopicRepositoryInterface::class => TopicRepository::class,
                TaskRepositoryInterface::class => TaskRepository::class,
                WorkspaceRepositoryInterface::class => WorkspaceRepository::class,
                TaskMessageRepositoryInterface::class => TaskMessageRepository::class,
                ProjectRepositoryInterface::class => ProjectRepository::class,
                WarmPoolSandboxRepositoryInterface::class => WarmPoolSandboxRepository::class,
                ProjectOperationLogRepositoryInterface::class => ProjectOperationLogRepository::class,
                ProjectOperationLogDomainService::class => ProjectOperationLogDomainService::class,
                ProjectMemberRepositoryInterface::class => ProjectMemberRepository::class,
                ProjectMemberSettingRepositoryInterface::class => ProjectMemberSettingRepository::class,
                // 添加SandboxOS相关服务的依赖注入
                SandboxGatewayInterface::class => SandboxGatewayService::class,
                // 沙箱重启编排依赖"重建单话题沙箱"的能力端口，生产实现是 AgentAppService 适配器
                SandboxRebuildPortInterface::class => AgentSandboxRebuildAdapter::class,
                SandboxAgentInterface::class => SandboxAgentService::class,
                FileConverterInterface::class => FileConverterService::class,
                BatchDownloadPackRepositoryInterface::class => BatchDownloadPackRepository::class,
                WorkspaceExporterInterface::class => WorkspaceExporterService::class,
                WorkspaceImporterInterface::class => WorkspaceImporterService::class,
                AsrRecorderInterface::class => AsrRecorderService::class,
                AgentAppService::class => AgentAppService::class,
                // 添加FileProcessAppService的依赖注入
                FileProcessAppService::class => FileProcessAppService::class,
                // 添加HandleAgentMessageAppService的依赖注入
                HandleAgentMessageAppService::class => HandleAgentMessageAppService::class,
                // 添加MessageQueueAppService的依赖注入
                MessageQueueAppService::class => MessageQueueAppService::class,
                // 添加MessageScheduleAppService的依赖注入
                MessageScheduleAppService::class => MessageScheduleAppService::class,
                // 添加分享相关服务
                ShareableResourceFactory::class => ShareableResourceFactory::class,
                TopicShareableResource::class => TopicShareableResource::class,
                SingleFileShareableResource::class => SingleFileShareableResource::class,
                ResourceShareRepositoryInterface::class => ResourceShareRepository::class,
                ResourceShareAccessLogRepositoryInterface::class => ResourceShareAccessLogRepository::class,
                ResourceShareAccessLogDomainService::class => ResourceShareAccessLogDomainService::class,
                ResourceShareCopyLogRepositoryInterface::class => ResourceShareCopyLogRepository::class,
                ResourceShareCopyLogDomainService::class => ResourceShareCopyLogDomainService::class,
                ResourceShareAppService::class => ResourceShareAppService::class,
                TokenUsageRecordRepositoryInterface::class => TokenUsageRecordRepository::class,
                WorkspaceVersionRepositoryInterface::class => WorkspaceVersionRepository::class,
                ProjectForkRepositoryInterface::class => ProjectForkRepository::class,
                MessageQueueRepositoryInterface::class => MessageQueueRepository::class,
                SandboxKeepAliveRepositoryInterface::class => SandboxKeepAliveRepository::class,
                MessageScheduleLogRepositoryInterface::class => MessageScheduleLogRepository::class,
                MessageScheduleRepositoryInterface::class => MessageScheduleRepository::class,

                // file-collection
                FileCollectionRepositoryInterface::class => FileCollectionRepository::class,
                FileCollectionItemRepositoryInterface::class => FileCollectionItemRepository::class,

                // agent 管理
                MagicClawRepositoryInterface::class => MagicClawRepository::class,
                SuperMagicAgentRepositoryInterface::class => SuperMagicAgentRepository::class,
                TaskFileVersionDomainService::class => TaskFileVersionDomainService::class,
                MessageScheduleDomainService::class => MessageScheduleDomainService::class,
                AgentPlaybookRepositoryInterface::class => AgentPlaybookRepository::class,
                AgentMarketRepositoryInterface::class => AgentMarketRepository::class,
                AgentVersionRepositoryInterface::class => AgentVersionRepository::class,
                AgentCategoryRepositoryInterface::class => AgentCategoryRepository::class,
                AgentCategoryRelationRepositoryInterface::class => AgentCategoryRelationRepository::class,
                AgentSkillRepositoryInterface::class => AgentSkillRepository::class,
                UserAgentRepositoryInterface::class => UserAgentRepository::class,

                // transfer 转让
                TransferLogRepositoryInterface::class => TransferLogRepository::class,

                // audio marker 音频标记
                AudioMarkerRepositoryInterface::class => AudioMarkerRepository::class,
                AudioProjectRepositoryInterface::class => AudioProjectRepository::class,
                MicroAppRepositoryInterface::class => MicroAppRepository::class,
                MicroAppVisitRepositoryInterface::class => MicroAppVisitRepository::class,

                // Skill 相关 Repository
                SkillRepositoryInterface::class => SkillRepository::class,
                SkillVersionRepositoryInterface::class => SkillVersionRepository::class,
                SkillMarketRepositoryInterface::class => SkillMarketRepository::class,
                SkillCategoryRepositoryInterface::class => SkillCategoryRepository::class,
                SkillCategoryRelationRepositoryInterface::class => SkillCategoryRelationRepository::class,
                UserSkillRepositoryInterface::class => UserSkillRepository::class,

                // recycle bin 回收站
                RecycleBinRepositoryInterface::class => RecycleBinRepository::class,
            ],
        ];
    }

    public function getRoutes(): array
    {
        return [
            'routes' => [
                'path' => BASE_PATH . '/config/routes-v1',
            ],
        ];
    }
}
