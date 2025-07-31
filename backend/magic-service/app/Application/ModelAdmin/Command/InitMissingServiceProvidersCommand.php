<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderCode;
use App\Domain\ModelAdmin\Service\ServiceProviderDomainService;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsEnvironmentRepositoryInterface;
use Exception;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * @Command
 */
#[Command]
class InitMissingServiceProvidersCommand extends HyperfCommand
{
    /**
     * 命令描述.
     */
    protected string $description = '检测并初始化缺少 Magic 服务商（LLM 或 VLM 类型）的组织';

    protected ServiceProviderDomainService $serviceProviderDomainService;

    protected OrganizationsEnvironmentRepositoryInterface $organizationsEnvironmentRepository;

    protected LoggerInterface $logger;

    protected ContainerInterface $container;

    /**
     * 构造函数，注入依赖.
     */
    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->serviceProviderDomainService = $container->get(ServiceProviderDomainService::class);
        $this->organizationsEnvironmentRepository = $container->get(OrganizationsEnvironmentRepositoryInterface::class);
        $this->logger = $container->get(LoggerInterface::class);

        parent::__construct('service-provider:init-missing');
    }

    /**
     * 命令处理方法.
     */
    public function handle()
    {
        $startTime = microtime(true);
        $isDryRun = $this->input->getOption('dry-run');
        $categoryOption = $this->input->getOption('category');
        $organizationOption = $this->input->getOption('organization');

        $this->line('=== 组织服务商初始化检测工具 ===', 'info');
        $this->line('开始检测组织服务商配置...', 'info');

        if ($isDryRun) {
            $this->line('【DRY RUN 模式】- 仅检测，不执行初始化', 'comment');
        }

        try {
            // 获取组织列表
            $organizationCodes = $this->getOrganizationCodes($organizationOption);
            $this->line(sprintf('获取到 %d 个组织', count($organizationCodes)), 'info');

            // 确定要检查的服务商类型
            $categoriesToCheck = $this->getCategoriesToCheck($categoryOption);
            $this->line(sprintf('检查服务商类型: %s', implode(', ', array_map(fn ($cat) => $cat->value, $categoriesToCheck))), 'info');

            // 统计信息
            $stats = [
                'total_organizations' => count($organizationCodes),
                'missing_organizations' => [],
                'initialized_count' => 0,
                'error_count' => 0,
                'errors' => [],
            ];

            // 检测和初始化
            foreach ($organizationCodes as $organizationCode) {
                $this->processOrganization($organizationCode, $categoriesToCheck, $isDryRun, $stats);
            }

            // 输出统计结果
            $this->outputStatistics($stats, microtime(true) - $startTime);
        } catch (Exception $e) {
            $this->line('执行过程中发生错误: ' . $e->getMessage(), 'error');
            $this->logger->error('InitMissingServiceProvidersCommand 执行失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return 1;
        }

        return 0;
    }

    /**
     * 配置命令选项.
     */
    protected function configure()
    {
        parent::configure();

        $this->addOption(
            'dry-run',
            null,
            InputOption::VALUE_NONE,
            '仅检测，不执行初始化'
        );

        $this->addOption(
            'category',
            'c',
            InputOption::VALUE_REQUIRED,
            '指定服务商类型（llm/vlm），默认检查两种类型',
            null
        );

        $this->addOption(
            'organization',
            'o',
            InputOption::VALUE_REQUIRED,
            '指定特定组织编码',
            null
        );
    }

    /**
     * 获取组织编码列表.
     */
    private function getOrganizationCodes(?string $organizationOption): array
    {
        if ($organizationOption) {
            $this->line(sprintf('指定组织: %s', $organizationOption), 'comment');
            // 检查是否是官方组织
            if ($this->isOfficialOrganization($organizationOption)) {
                $this->line(sprintf('跳过官方组织: %s', $organizationOption), 'comment');
                return [];
            }
            return [$organizationOption];
        }

        $allOrganizations = $this->organizationsEnvironmentRepository->getAllOrganizationCodes();

        // 过滤掉官方组织
        $filteredOrganizations = array_filter($allOrganizations, function ($orgCode) {
            return ! $this->isOfficialOrganization($orgCode);
        });

        $officialOrgCount = count($allOrganizations) - count($filteredOrganizations);
        if ($officialOrgCount > 0) {
            $this->line(sprintf('已过滤 %d 个官方组织', $officialOrgCount), 'comment');
        }

        return array_values($filteredOrganizations);
    }

    /**
     * 获取要检查的服务商类型.
     */
    private function getCategoriesToCheck(?string $categoryOption): array
    {
        if ($categoryOption) {
            $category = ServiceProviderCategory::tryFrom(strtolower($categoryOption));
            if (! $category) {
                throw new Exception('无效的服务商类型，支持: llm, vlm');
            }
            return [$category];
        }

        return [ServiceProviderCategory::LLM, ServiceProviderCategory::VLM];
    }

    /**
     * 处理单个组织.
     */
    private function processOrganization(
        string $organizationCode,
        array $categoriesToCheck,
        bool $isDryRun,
        array &$stats
    ): void {
        $this->line(sprintf('检查组织: %s', $organizationCode), 'info');

        foreach ($categoriesToCheck as $category) {
            try {
                // 检查是否缺少服务商
                if ($this->isServiceProviderMissing($organizationCode, $category)) {
                    $categoryName = $category->label();
                    $this->line(sprintf('  组织 %s 缺少 %s Magic服务商', $organizationCode, $categoryName), 'comment');

                    // 记录缺失的组织和类型
                    if (! isset($stats['missing_organizations'][$organizationCode])) {
                        $stats['missing_organizations'][$organizationCode] = [];
                    }
                    $stats['missing_organizations'][$organizationCode][] = $category->value;

                    // 如果不是 dry-run 模式，执行初始化
                    if (! $isDryRun) {
                        $this->initializeServiceProvider($organizationCode, $category);
                        ++$stats['initialized_count'];
                        $this->line(sprintf('  ✓ 已初始化组织 %s 的 %s 服务商', $organizationCode, $categoryName), 'info');
                    }
                } else {
                    $this->line(sprintf('  组织 %s 已有 %s Magic服务商', $organizationCode, $category->label()), 'comment');
                }
            } catch (Exception $e) {
                ++$stats['error_count'];
                $stats['errors'][] = sprintf('组织 %s (%s类型): %s', $organizationCode, $category->value, $e->getMessage());
                $this->line(sprintf('  ✗ 处理组织 %s 时出错: %s', $organizationCode, $e->getMessage()), 'error');
                $this->logger->error('处理组织时出错', [
                    'organization' => $organizationCode,
                    'category' => $category->value,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * 检查组织是否缺少指定类型的 Magic 服务商.
     */
    private function isServiceProviderMissing(string $organizationCode, ServiceProviderCategory $category): bool
    {
        try {
            // 获取组织的服务商配置
            $serviceProviderConfigs = $this->serviceProviderDomainService->getServiceProviderConfigs($organizationCode, $category);

            // 检查是否有 Magic 服务商
            foreach ($serviceProviderConfigs as $config) {
                if (ServiceProviderCode::from($config->getProviderCode()) === ServiceProviderCode::Magic) {
                    return false; // 找到了 Magic 服务商，不缺少
                }
            }

            return true; // 没有找到 Magic 服务商，缺少
        } catch (Exception $e) {
            $this->logger->warning('检查服务商时出错', [
                'organization' => $organizationCode,
                'category' => $category->value,
                'error' => $e->getMessage(),
            ]);
            // 出错时认为缺少，以便尝试初始化
            return true;
        }
    }

    /**
     * 初始化组织的服务商.
     */
    private function initializeServiceProvider(string $organizationCode, ServiceProviderCategory $category): void
    {
        Db::beginTransaction();
        try {
            $this->serviceProviderDomainService->initOrganizationServiceProviders($organizationCode, $category);
            Db::commit();

            $this->logger->info('成功初始化组织服务商', [
                'organization' => $organizationCode,
                'category' => $category->value,
            ]);
        } catch (Exception $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * 判断是否为官方组织.
     */
    private function isOfficialOrganization(string $organizationCode): bool
    {
        $officialOrganization = config('service_provider.office_organization');
        return ! empty($officialOrganization) && $organizationCode === $officialOrganization;
    }

    /**
     * 输出统计结果.
     */
    private function outputStatistics(array $stats, float $executionTime): void
    {
        $this->line('', 'info');
        $this->line('=== 执行结果统计 ===', 'info');
        $this->line(sprintf('总组织数量: %d', $stats['total_organizations']), 'info');
        $this->line(sprintf('缺少服务商的组织数量: %d', count($stats['missing_organizations'])), 'info');
        $this->line(sprintf('已初始化的服务商数量: %d', $stats['initialized_count']), 'info');
        $this->line(sprintf('处理错误数量: %d', $stats['error_count']), 'info');
        $this->line(sprintf('执行时间: %.2f 秒', $executionTime), 'info');

        // 显示缺少服务商的组织详情
        if (! empty($stats['missing_organizations'])) {
            $this->line('', 'info');
            $this->line('缺少服务商的组织详情:', 'comment');
            foreach ($stats['missing_organizations'] as $orgCode => $categories) {
                $this->line(sprintf('  %s: %s', $orgCode, implode(', ', $categories)), 'comment');
            }
        }

        // 显示错误详情
        if (! empty($stats['errors'])) {
            $this->line('', 'info');
            $this->line('错误详情:', 'error');
            foreach ($stats['errors'] as $error) {
                $this->line(sprintf('  %s', $error), 'error');
            }
        }
    }
}
