<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command\Flow;

use App\Application\Flow\Service\MagicFlowExportImportAppService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use GuzzleHttp\Client;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputArgument;
use Throwable;

#[Command]
class ImportAgentWithFlowCommand extends HyperfCommand
{
    protected ContainerInterface $container;

    protected MagicFlowExportImportAppService $exportImportService;

    public function __construct(
        ContainerInterface $container
    ) {
        $this->container = $container;
        $this->exportImportService = $container->get(MagicFlowExportImportAppService::class);
        parent::__construct('agent:import');
        $this->setDescription('从OSS导入助理（包含主流程、工具、子流程等）');
        $this->addArgument('file_url', InputArgument::REQUIRED, '导出助理数据文件的URL');
        $this->addArgument('user_id', InputArgument::REQUIRED, '用户id');
        $this->addArgument('organization_code', InputArgument::REQUIRED, '组织编码');
    }

    public function handle()
    {
        $fileUrl = $this->input->getArgument('file_url');

        // 下载文件内容
        try {
            $client = new Client();
            $response = $client->get($fileUrl);
            $content = $response->getBody()->getContents();

            // 解析JSON内容
            $importData = json_decode($content, true);
            if (! $importData || ! is_array($importData)) {
                $this->output->error('文件中的JSON数据无效');
                return 1;
            }

            // 从导入数据中获取组织代码和用户ID
            $orgCode = $this->input->getArgument('organization_code');
            $userId = $this->input->getArgument('user_id');

            if (empty($orgCode) || empty($userId)) {
                $this->output->error('导入数据中缺少组织代码或用户ID');
                return 1;
            }

            // 创建数据隔离对象
            $dataIsolation = new FlowDataIsolation($orgCode, $userId);

            // 导入流程及助理信息
            $result = $this->exportImportService->importFlowWithAgent($dataIsolation, $importData);
            $this->output->success('助理导入成功。' . $result['agent_name']);
            return 0;
        } catch (Throwable $e) {
            $this->output->error("导入助理失败: {$e->getMessage()}");
            return 1;
        }
    }
}
