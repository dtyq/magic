<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Command;

use App\Domain\Agent\Constant\InstructDisplayType;
use App\Domain\Agent\Constant\InstructType;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Repository\Persistence\MagicAgentRepository;
use App\Domain\Agent\Repository\Persistence\MagicAgentVersionRepository;
use Hyperf\Codec\Json;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class EnsureSwitchResidencyCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container, public MagicAgentRepository $agentRepository, public MagicAgentVersionRepository $agentVersionRepository)
    {
        parent::__construct('agent:ensure-switch-residency');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('确保所有助理的开关指令都有 residency=true 属性')
            ->addOption('test', 't', InputOption::VALUE_OPTIONAL, '测试模式：提供JSON格式的测试数据进行处理', '')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, '空运行模式：只检查但不更新到数据库');
    }

    public function handle()
    {
        // 检查是否运行在测试模式
        $testData = $this->input->getOption('test');
        $isDryRun = $this->input->getOption('dry-run');

        if (! empty($testData)) {
            return $this->handleTestMode($testData, $isDryRun);
        }

        if ($isDryRun) {
            $this->output->writeln('<info>运行在空运行模式，将不会实际更新数据库</info>');
        }

        $batchSize = 20;
        $offset = 0;
        $total = 0;
        $updated = 0;

        $this->output->writeln('开始处理助理开关指令...');

        while (true) {
            // 分批获取助理
            $agents = $this->agentRepository->getAgentsByBatch($offset, $batchSize);
            if (empty($agents)) {
                break;
            }
            foreach ($agents as $agent) {
                ++$total;
                // 获取当前指令
                $instructs = $agent['instructs'] ?? [];
                if (empty($instructs)) {
                    continue;
                }

                // 检查并修复开关指令的 residency 属性
                $hasChanges = $this->ensureSwitchResidency($instructs);

                // 如果指令有变化，保存更新
                if ($hasChanges) {
                    if (! $isDryRun) {
                        $this->agentRepository->updateInstruct(
                            $agent['organization_code'],
                            $agent['id'],
                            $instructs
                        );
                    }
                    ++$updated;
                    $this->output->writeln(sprintf('已%s助理 [%s] 的开关指令', $isDryRun ? '检测到需要更新' : '更新', $agent['id']));
                }
            }

            $offset += $batchSize;
            $this->output->writeln(sprintf('已处理 %d 个助理...', $total));
        }

        $this->output->writeln(sprintf(
            '处理完成！共处理 %d 个助理，%s %d 个助理的开关指令',
            $total,
            $isDryRun ? '发现需要更新' : '更新了',
            $updated
        ));

        // 处理助理版本
        $offset = 0;
        $versionTotal = 0;
        $versionUpdated = 0;

        $this->output->writeln('\n开始处理助理版本开关指令...');

        while (true) {
            // 分批获取助理版本
            $versions = $this->agentVersionRepository->getAgentVersionsByBatch($offset, $batchSize);
            if (empty($versions)) {
                break;
            }

            foreach ($versions as $version) {
                ++$versionTotal;

                // 获取当前指令
                $instructs = $version['instructs'] ?? [];
                if (empty($instructs)) {
                    continue;
                }

                // 检查并修复开关指令的 residency 属性
                $hasChanges = $this->ensureSwitchResidency($instructs);

                // 如果指令有变化，保存更新
                if ($hasChanges) {
                    if (! $isDryRun) {
                        $this->agentVersionRepository->updateById(
                            new MagicAgentVersionEntity(array_merge($version, ['instructs' => $instructs]))
                        );
                    }
                    ++$versionUpdated;
                    $this->output->writeln(sprintf('已%s助理版本 [%s] 的开关指令', $isDryRun ? '检测到需要更新' : '更新', $version['id']));
                }
            }

            $offset += $batchSize;
            $this->output->writeln(sprintf('已处理 %d 个助理版本...', $versionTotal));
        }

        $this->output->writeln(sprintf(
            '处理完成！共处理 %d 个助理版本，%s %d 个助理版本的开关指令',
            $versionTotal,
            $isDryRun ? '发现需要更新' : '更新了',
            $versionUpdated
        ));
    }

    /**
     * 处理测试模式.
     *
     * @param string $testData JSON格式的测试数据
     * @param bool $isDryRun 是否为空运行模式
     */
    private function handleTestMode(string $testData, bool $isDryRun): int
    {
        $this->output->writeln('<info>运行在测试模式</info>');

        try {
            $data = Json::decode($testData);
        } catch (Throwable $e) {
            $this->output->writeln('<error>解析测试数据失败: ' . $e->getMessage() . '</error>');
            return 1;
        }

        $this->output->writeln('测试数据处理开始...');

        // 显示原始指令
        $this->output->writeln('<comment>原始指令:</comment>');
        $this->output->writeln(Json::encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // 检查并修复开关指令的 residency 属性
        $hasChanges = $this->ensureSwitchResidency($data);

        // 显示处理结果
        $this->output->writeln('<comment>处理后的指令:</comment>');
        $this->output->writeln(Json::encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->output->writeln(sprintf(
            '处理完成！指令集%s更新',
            $hasChanges ? '已' : '无需'
        ));

        return 0;
    }

    /**
     * 确保开关指令都有 residency=true 属性.
     * @param array &$instructs 指令数组
     * @return bool 是否有修改
     */
    private function ensureSwitchResidency(array &$instructs): bool
    {
        $hasChanges = false;

        foreach ($instructs as &$group) {
            if (! isset($group['items']) || ! is_array($group['items'])) {
                continue;
            }

            foreach ($group['items'] as &$item) {
                // 跳过系统指令处理
                if (isset($item['display_type']) && (int) $item['display_type'] === InstructDisplayType::SYSTEM) {
                    continue;
                }

                // 检查是否是开关指令(type = 2)
                if (isset($item['type']) && (int) $item['type'] === InstructType::SWITCH->value) {
                    // 如果没有 residency 属性，添加 residency = true
                    if (! isset($item['residency'])) {
                        $item['residency'] = true;
                        $hasChanges = true;
                        $this->output->writeln(sprintf(
                            '发现开关指令 [%s](%s) 缺少 residency 属性，已添加',
                            $item['name'] ?? '未命名',
                            $item['id'] ?? '无ID'
                        ));
                    }
                }
            }
        }

        return $hasChanges;
    }
}
