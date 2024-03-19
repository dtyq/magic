<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command\Flow;

use App\Application\Flow\Service\MagicFlowExportImportAppService;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputArgument;
use Throwable;

/**
 * @Command
 */
#[Command]
class ExportAgentWithFlowCommand extends HyperfCommand
{
    protected ContainerInterface $container;

    protected MagicFlowExportImportAppService $exportImportService;

    protected MagicAgentDomainService $agentDomainService;

    protected FileDomainService $fileDomainService;

    public function __construct(
        ContainerInterface $container
    ) {
        $this->container = $container;
        $this->exportImportService = $this->container->get(MagicFlowExportImportAppService::class);
        $this->agentDomainService = $this->container->get(MagicAgentDomainService::class);
        $this->fileDomainService = $this->container->get(FileDomainService::class);
        parent::__construct('agent:export');
        $this->setDescription('导出助理到OSS（包含主流程、工具、子流程等）');
        $this->addArgument('agent_id', InputArgument::REQUIRED, '助理ID');
    }

    /**
     * @throws CloudFileException
     */
    public function handle()
    {
        $agentId = $this->input->getArgument('agent_id');

        // 获取助理信息
        $agent = $this->agentDomainService->getById($agentId);

        $flowCode = $agent->getFlowCode();
        if (empty($flowCode)) {
            $this->output->error('助理没有关联的流程');
            return 1;
        }

        // 从助理实体中获取组织代码和用户ID
        $orgCode = $agent->getOrganizationCode();
        $userId = $agent->getCreatedUid();

        // 创建数据隔离对象
        $dataIsolation = new FlowDataIsolation($orgCode, $userId);

        // 导出流程及助理信息
        $exportData = $this->exportImportService->exportFlowWithAgent($dataIsolation, $flowCode, $agent);

        // 将数据保存为临时文件
        $filename = "agent-export-{$agentId}-" . time() . '.json';
        $tempFile = tempnam(sys_get_temp_dir(), 'flow_export_');
        file_put_contents($tempFile, json_encode($exportData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        chmod($tempFile, 0644);
        // 上传到OSS
        $uploadDir = $orgCode . '/open/' . md5(StorageBucketType::Public->value);
        $uploadFile = new UploadFile($tempFile, $uploadDir, $filename);

        // 使用已有的文件服务上传
        try {
            // 定义上传目录
            $subDir = 'open';

            // 创建上传文件对象（不自动重命名）
            $uploadFile = new UploadFile($tempFile, $subDir, '', false);

            // 上传文件（指定不自动创建目录）
            $this->fileDomainService->uploadByCredential($orgCode, $uploadFile);

            // 生成可访问的链接
            $fileLink = $this->fileDomainService->getLink($orgCode, $uploadFile->getKey(), StorageBucketType::Private);

            if ($fileLink) {
                // 使用这种方式点击链接是有效的链接
                return 0;
            }

            $this->output->error('生成文件链接失败');
            return 1;
        } catch (Throwable $e) {
            $this->output->error("上传文件失败: {$e->getMessage()}");
            return 1;
        } finally {
            // 删除临时文件
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
            // 释放上传文件资源
            $uploadFile->release();
        }
    }
}
