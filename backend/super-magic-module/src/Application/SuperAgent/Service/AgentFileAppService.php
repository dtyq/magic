<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\UserInfoValueObject;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InitAgentRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * Agent消息应用服务
 * 提供高级Agent通信功能，包括自动初始化和状态管理.
 */
class AgentFileAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway,
        private SandboxAgentInterface $agent,
        private readonly FileAppService $fileAppService,
        private readonly MagicUserInfoAppService $userInfoAppService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TopicDomainService $topicDomainService,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 获取沙箱状态
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        $this->logger->info('[Sandbox][App] Getting sandbox status', [
            'sandbox_id' => $sandboxId,
        ]);

        $result = $this->gateway->getSandboxStatus($sandboxId);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to get sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Get sandbox status', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][App] Sandbox status retrieved', [
            'sandbox_id' => $sandboxId,
            'status' => $result->getStatus(),
        ]);

        return $result;
    }


    public function getFileVersions(int $fileId,$topicId)
    {
        $taskFileEntity = $this->taskDomainService->getTaskFile($fileId);
        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        $sandboxId = $this->topicDomainService->getSandboxIdByTopicId($topicId);


        // $fileKey = $taskFileEntity->getFileKey();
        $fileKey = "hello.html";


        $result = $this->gateway->getFileVersions($sandboxId, $fileKey, $this->getWorkspaceDir());

        var_dump($result->getData(),"getFileVersions ==============");
        return $result->getData();
    }


    public function getWorkspaceDir(){
       return ".workspace";
    }


    public function getFileVersionContent(int $fileId,string $commitHash,$topicId)
    {
        $taskFileEntity = $this->taskDomainService->getTaskFile($fileId);
        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        $fileKey = "index.html";
        $commitHash = "0204935a68ba0afacd8b60caeacce85ae4e0bf53";
        $sandboxId = "1234567890";
        // $sandboxId = $this->topicDomainService->getSandboxIdByTopicId($topicId);

        $result=$this->gateway->getFileVersionContent($sandboxId, $fileKey, $commitHash,$this->getWorkspaceDir());

        var_dump($result->getData(),"getFileVersionContent ==============");
        return $result->getData();
    }




}
