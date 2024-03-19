<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\OrganizationEnvironment\Repository\Persistence\Model\OrganizationModel;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class BackfillPersonalOrganizationCreatorAdminCommand extends HyperfCommand
{
    private const int DEFAULT_BATCH_SIZE = 200;

    public function __construct(
        protected ContainerInterface $container,
        private readonly OrganizationAdminDomainService $organizationAdminDomainService,
    ) {
        parent::__construct('permission:backfill-personal-org-creator-admin');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('回填个人组织创建者为组织管理员（并标记为组织创建人）');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预览模式，不实际写入数据库');
        $this->addOption('organization-code', null, InputOption::VALUE_OPTIONAL, '仅处理指定组织');
        $this->addOption('batch-size', null, InputOption::VALUE_OPTIONAL, '批处理大小', self::DEFAULT_BATCH_SIZE);
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->input->getOption('dry-run');
        $organizationCode = (string) ($this->input->getOption('organization-code') ?? '');
        $batchSize = max(1, (int) $this->input->getOption('batch-size'));

        $query = OrganizationModel::query()
            ->where('type', 1)
            ->whereNotNull('creator_id')
            ->where('creator_id', '!=', '');

        if ($organizationCode !== '') {
            $query->where('magic_organization_code', $organizationCode);
        }

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('未找到可处理的个人组织数据');
            return 0;
        }

        $this->line(sprintf(
            '开始回填个人组织创建者管理员权限: total=%d, dry_run=%s, org=%s, batch_size=%d',
            $total,
            $dryRun ? 'true' : 'false',
            $organizationCode === '' ? 'ALL' : $organizationCode,
            $batchSize
        ));

        if (! $dryRun && ! $this->confirm('将写入数据库，是否继续？', false)) {
            $this->warn('已取消');
            return 0;
        }

        $processed = 0;
        $alreadyCreatorAdmin = 0;
        $createdAdmins = 0;
        $updatedAdmins = 0;
        $recreatedAdmins = 0;
        $failed = 0;

        $query->orderBy('id')->chunk($batchSize, function ($organizations) use (
            &$processed,
            &$alreadyCreatorAdmin,
            &$createdAdmins,
            &$updatedAdmins,
            &$recreatedAdmins,
            &$failed,
            $dryRun
        ) {
            foreach ($organizations as $organization) {
                ++$processed;

                $orgCode = (string) $organization->magic_organization_code;
                $creatorId = (string) $organization->creator_id;
                $dataIsolation = DataIsolation::simpleMake($orgCode, $creatorId);

                try {
                    $existingAdmin = $this->organizationAdminDomainService->getByUserId($dataIsolation, $creatorId);

                    if ($existingAdmin !== null && $existingAdmin->isEnabled() && $existingAdmin->isOrganizationCreator()) {
                        ++$alreadyCreatorAdmin;
                        continue;
                    }

                    if ($dryRun) {
                        if ($existingAdmin === null) {
                            ++$createdAdmins;
                        } elseif (! $existingAdmin->isEnabled()) {
                            ++$recreatedAdmins;
                        } else {
                            ++$updatedAdmins;
                        }
                        continue;
                    }

                    if ($existingAdmin === null) {
                        $this->organizationAdminDomainService->grant(
                            $dataIsolation,
                            $creatorId,
                            $creatorId,
                            '个人组织创建者自动获得管理员权限（回填）',
                            true
                        );
                        ++$createdAdmins;
                        continue;
                    }

                    if (! $existingAdmin->isEnabled()) {
                        $this->organizationAdminDomainService->grant(
                            $dataIsolation,
                            $creatorId,
                            $creatorId,
                            '个人组织创建者自动获得管理员权限（回填）',
                            true
                        );
                        $existingAdmin->enable();
                        $existingAdmin->markAsOrganizationCreator();
                        if ($existingAdmin->getRemarks() === null || $existingAdmin->getRemarks() === '') {
                            $existingAdmin->setRemarks('个人组织创建者自动获得管理员权限（回填）');
                        }
                        $this->organizationAdminDomainService->save($dataIsolation, $existingAdmin);
                        ++$recreatedAdmins;
                        continue;
                    }

                    $existingAdmin->markAsOrganizationCreator();
                    if ($existingAdmin->getRemarks() === null || $existingAdmin->getRemarks() === '') {
                        $existingAdmin->setRemarks('个人组织创建者自动获得管理员权限（回填）');
                    }
                    $this->organizationAdminDomainService->save($dataIsolation, $existingAdmin);
                    ++$updatedAdmins;
                } catch (Throwable $throwable) {
                    ++$failed;
                    $this->warn(sprintf(
                        '处理失败: org=%s creator=%s error=%s',
                        $orgCode,
                        $creatorId,
                        $throwable->getMessage()
                    ));
                }
            }

            $this->line(sprintf(
                '处理进度: %d, 已是创建者管理员: %d, %s新增管理员: %d, %s重建管理员: %d, %s更新创建者标记: %d, failed: %d',
                $processed,
                $alreadyCreatorAdmin,
                $dryRun ? '将' : '已',
                $createdAdmins,
                $dryRun ? '将' : '已',
                $recreatedAdmins,
                $dryRun ? '将' : '已',
                $updatedAdmins,
                $failed
            ));
        });

        $this->info(sprintf(
            '回填完成: processed=%d, already_creator_admin=%d, %screated=%d, %srecreated=%d, %supdated=%d, failed=%d',
            $processed,
            $alreadyCreatorAdmin,
            $dryRun ? 'would_' : '',
            $createdAdmins,
            $dryRun ? 'would_' : '',
            $recreatedAdmins,
            $dryRun ? 'would_' : '',
            $updatedAdmins,
            $failed
        ));

        return $failed > 0 ? 1 : 0;
    }
}
