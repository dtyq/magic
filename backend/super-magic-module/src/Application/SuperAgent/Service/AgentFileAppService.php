<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
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
        private readonly TaskDomainService $taskDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
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

    public function getFileVersions(int $fileId, int $topicId)
    {
        $taskFileEntity = $this->taskDomainService->getTaskFile($fileId);
        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        if (empty($topicId)) {
            $topicId = $taskFileEntity->getTopicId();
        }

        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        $sandboxId = $this->topicDomainService->getSandboxIdByTopicId($taskFileEntity->getTopicId());

        $fileKey = $taskFileEntity->getFileKey();
        $workDir = $topicEntity->getWorkDir() . '/';
        // $fileKey="DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_3715ce50bc02d7e72ba7891649b7f1da/topic_796071554826489856/index.html";
        // $workDir="/SUPER_MAGIC/usi_3715ce50bc02d7e72ba7891649b7f1da/topic_796071554826489856/";

        # 截取文件名,取filekey 的 workDir 后面的字符串
        $fileKey = substr($fileKey, strrpos($fileKey, $workDir) + strlen($workDir));

        $result = $this->gateway->getFileVersions($sandboxId, $fileKey, $this->getWorkspaceDir());

        $versions = [];
        $total = 0;
        if (empty($result->getData()['versions']) || empty($result->getData()['version_count'])) {
            return ['versions' => $versions, 'version_count' => $total];
        }

        # 获取tag号
        foreach ($result->getData()['versions'] as $key => $item) {
            $tag = $this->workspaceDomainService->getTagByCommitHashAndProjectId($item['commit_hash'], $topicEntity->getProjectId());
            $item['tag'] = $tag;
            $versions[] = $item;
        }
        $total = $result->getData()['version_count'];
        return ['versions' => $versions, 'version_count' => $total];
    }

    public function getWorkspaceDir()
    {
        return '.workspace';
    }

    public function getFileVersionContent(int $fileId, string $commitHash, int $topicId)
    {
        $taskFileEntity = $this->taskDomainService->getTaskFile($fileId);
        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }
        if (empty($topicId)) {
            $topicId = $taskFileEntity->getTopicId();
        }

        $topicEntity = $this->topicDomainService->getTopicById($topicId);

        # workDir是 /usi_753aef2eb5e4c059f55149abf1289d63/766041277198622720 file_key 是 DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/usi_753aef2eb5e4c059f55149abf1289d63/766041277198622720/browser_screenshot_比亚迪 357.51(-..._1743838443.png
        # 使用workDir 截取 file_key 的 文件名, 取后面一串 browser_screenshot_比亚迪 357.51(-..._1743838443.png
        $workDir = $topicEntity->getWorkDir() . '/';
        $fileKey = $taskFileEntity->getFileKey();
        // $fileKey="DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_3715ce50bc02d7e72ba7891649b7f1da/topic_796071554826489856/generate_image/friendly-dog.jpg";
        // $workDir="/SUPER_MAGIC/usi_3715ce50bc02d7e72ba7891649b7f1da/topic_796071554826489856/";
        // $taskFileEntity->setFileKey("DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ecgenerate_image/friendly-dog.jpg");

        # 截取文件名,取filekey 的 workDir 后面的字符串
        $fileKey = substr($fileKey, strrpos($fileKey, $workDir) + strlen($workDir));

        // $fileKey="index.html";
        // $commitHash = "0204935a68ba0afacd8b60caeacce85ae4e0bf53";
        $sandboxId = $this->topicDomainService->getSandboxIdByTopicId($topicId);

        $result = $this->gateway->getFileVersionContent($sandboxId, $fileKey, $commitHash, $this->getWorkspaceDir());

        $data['temporary_url'] = '';
        $data['file_size'] = '';
        $data['file_hash'] = '';
        $data['expires_in'] = 0;

        if (! empty($result->getData())) {
            $data['temporary_url'] = $result->getData()['temporary_url'];
            $data['file_size'] = $result->getData()['file_size'];
            $data['file_hash'] = $result->getData()['file_hash'];
            $data['expires_in'] = $result->getData()['expires_in'];
        }
        return $data;
    }
}
