<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SuperMagicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchSaveFileContentRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveFileContentRequestDTO;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

/**
 * 沙箱文件编辑应用服务
 * 负责协调沙箱文件编辑的完整流程.
 */
class FileSaveContentAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly AgentDomainService $agentDomainService,
        private readonly SuperMagicDomainService $superMagicDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
    ) {
        $this->logger = $loggerFactory->get('sandbox-file-edit');
    }

    /**
     * 通过沙箱保存文件内容
     * 主要流程：
     * 1. 根据文件ID获取项目信息
     * 2. 查询项目的活跃话题
     * 3. 确保沙箱环境就绪
     * 4. 调用沙箱文件保存接口
     * 5. 返回统一格式的响应.
     */
    public function batchSaveFileContentViaSandbox(
        BatchSaveFileContentRequestDTO $dto,
        MagicUserAuthorization $userAuth
    ): array {
        $this->logger->info('[SandboxFileEdit] Starting batch file save via sandbox', [
            'user_id' => $userAuth->getId(),
            'organization_code' => $userAuth->getOrganizationCode(),
            'file_count' => count($dto->getFiles()),
        ]);

        try {
            // 1. 准备文件数据，获取项目信息
            $fileDataList = $this->prepareFileData($dto->getFiles(), $userAuth);

            // 2. 获取话题项目
            if (count($fileDataList) == 0) {
                return [];
            }
            $projectId = $fileDataList[0]['project_id'];
            $projectEntity = $this->getAccessibleProject((int) $projectId, $userAuth->getId(), $userAuth->getOrganizationCode());

            // 3. 根据项目创建一个沙箱
            $projectId = (string) $projectId;
            $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId($projectId);
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($userAuth->getOrganizationCode());
            $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());
            $dataIsolation = $this->createDataIsolation($userAuth);
            $this->agentDomainService->createSandbox($dataIsolation, $projectId, $sandboxId, $fullWorkdir);

            // 4. 检查沙箱是否就绪
            $this->agentDomainService->waitForSandboxReady($sandboxId);

            // 5, 调用文件接口
            $result = $this->superMagicDomainService->saveFileData($sandboxId, $fileDataList, $projectEntity->getWorkDir());

            // 6. 发布文件内容已保存事件
            foreach ($dto->getFiles() as $fileDto) {
                // 获取文件实体以发布事件
                $fileEntity = $this->taskFileDomainService->getById((int) $fileDto->getFileId());
                if ($fileEntity) {
                    $fileContentSavedEvent = new FileContentSavedEvent($fileEntity, $userAuth->getId(), $userAuth->getOrganizationCode());
                    $this->eventDispatcher->dispatch($fileContentSavedEvent);
                }
            }

            $this->logger->info('[SandboxFileEdit] File save completed', [
                'user_id' => $userAuth->getId(),
                'organization_code' => $userAuth->getOrganizationCode(),
                'file_count' => count($dto->getFiles()),
                'result' => $result,
            ]);
            return $result;
        } catch (SandboxOperationException $e) {
            $this->logger->error('[SandboxFileEdit] Sandbox operation failed', [
                'user_id' => $userAuth->getId(),
                'error' => $e->getMessage(),
                'operation' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Exception $e) {
            $this->logger->error('[SandboxFileEdit] Unexpected error during file save', [
                'user_id' => $userAuth->getId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw new SandboxOperationException(
                'Save files via sandbox',
                'Unexpected error: ' . $e->getMessage(),
                5000
            );
        }
    }

    /**
     * 准备文件数据，获取必要的元信息.
     * @param $files SaveFileContentRequestDTO[]
     */
    private function prepareFileData(array $files, MagicUserAuthorization $userAuth): array
    {
        $fileDataList = [];

        foreach ($files as $fileDto) {
            // 获取文件实体信息
            $taskFile = $this->taskFileRepository->getById((int) $fileDto->getFileId());

            if (! $taskFile) {
                throw new SandboxOperationException(
                    'Prepare file data',
                    'File not found: ' . $fileDto->getFileId(),
                    4001
                );
            }

            // 验证文件所有权
            if ($taskFile->getUserId() !== $userAuth->getId()) {
                throw new SandboxOperationException(
                    'Prepare file data',
                    'Access denied for file: ' . $fileDto->getFileId(),
                    4003
                );
            }

            $fileDataList[] = [
                'file_id' => $fileDto->getFileId(),
                'project_id' => $taskFile->getProjectId(),
                'topic_id' => $taskFile->getTopicId(),
                'file_key' => $taskFile->getFileKey(),
                'content' => $fileDto->getContent(),
                'user_id' => $userAuth->getId(),
                'organization_code' => $userAuth->getOrganizationCode(),
                'is_encrypted' => $fileDto->getEnableShadow(),
            ];
        }

        // 验证所有文件是否属于同一个项目
        $projectIds = array_unique(array_column($fileDataList, 'project_id'));
        if (count($projectIds) > 1) {
            throw new SandboxOperationException(
                'Prepare file data',
                'Files must belong to the same project',
                4002
            );
        }

        return $fileDataList;
    }
}
