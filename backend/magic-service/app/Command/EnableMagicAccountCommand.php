<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Service\MagicAccountStatusService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class EnableMagicAccountCommand extends HyperfCommand
{
    public function __construct(
        private readonly MagicAccountStatusService $statusService,
    ) {
        parent::__construct('account:enable');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('启用 Magic 账号');
        $this->addOption('magic-id', null, InputOption::VALUE_REQUIRED, '要启用的 Magic ID');
        $this->addOption('phone', null, InputOption::VALUE_REQUIRED, '要启用的手机号（必须唯一匹配账号）');
        $this->addOption('email', null, InputOption::VALUE_REQUIRED, '要启用的邮箱域名（例如 example.com）');
        $this->addOption('execute', null, InputOption::VALUE_NONE, '确认执行账号启用');
    }

    public function handle(): int
    {
        $magicId = trim((string) ($this->input->getOption('magic-id') ?? ''));
        $phone = trim((string) ($this->input->getOption('phone') ?? ''));
        $emailDomain = trim((string) ($this->input->getOption('email') ?? ''), " \t\n\r\0\x0B@");

        if (count(array_filter([$magicId, $phone, $emailDomain], static fn (string $value): bool => $value !== '')) !== 1) {
            $this->error('必须且只能提供 --magic-id、--phone 或 --email 其中一个参数。');
            return self::FAILURE;
        }
        if ($emailDomain !== '' && preg_match('/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/', $emailDomain) !== 1) {
            $this->error('--email 必须是合法的邮箱域名，例如 example.com。');
            return self::FAILURE;
        }

        try {
            $accounts = Db::table('magic_contact_accounts')
                ->select(['magic_id', 'phone', 'email', 'status'])
                ->whereNull('deleted_at')
                ->when($magicId !== '', static fn ($query) => $query->where('magic_id', $magicId))
                ->when($phone !== '', static fn ($query) => $query->where('phone', $phone))
                ->when($emailDomain !== '', static fn ($query) => $query->where('email', 'like', '%@' . $emailDomain))
                ->get();
            $accounts = $accounts->map(static fn ($account): object => is_array($account) ? (object) $account : $account);
        } catch (Throwable $e) {
            $this->error('查询账号失败: ' . $e->getMessage());
            return self::FAILURE;
        }

        if ($accounts->isEmpty()) {
            $this->error('未找到可操作的账号（账号不存在或已删除）。');
            return self::FAILURE;
        }
        if ($phone !== '' && $accounts->count() > 1) {
            $magicIds = $accounts->pluck('magic_id')->implode(', ');
            $this->error("手机号匹配到多个账号（{$magicIds}），请改用 --magic-id 精确指定。");
            return self::FAILURE;
        }

        foreach ($accounts as $account) {
            $status = (int) $account->status;
            if ($status !== AccountStatus::Disable->value && $status !== AccountStatus::Normal->value) {
                $this->error("账号 {$account->magic_id} 的状态值 {$status} 不受支持，已停止操作。");
                return self::FAILURE;
            }
        }

        if ($emailDomain !== '') {
            $this->line("目标邮箱域名: {$emailDomain}");
            $this->line("匹配账号数: {$accounts->count()}");
        }
        $this->line('预检查账号信息:');
        foreach ($accounts as $account) {
            $status = (int) $account->status === AccountStatus::Normal->value ? '正常' : '已禁用';
            $this->line(sprintf(
                '  magic_id=%s, phone=%s, email=%s, status=%s, target=正常',
                (string) $account->magic_id,
                (string) ($account->phone ?? ''),
                (string) ($account->email ?? ''),
                $status
            ));
        }

        if (! $this->input->getOption('execute')) {
            $this->info('预检查完成，未执行启用。确认后请追加 --execute。');
            return self::SUCCESS;
        }

        try {
            $enabledCount = 0;
            foreach ($accounts as $account) {
                if ($this->statusService->enable((string) $account->magic_id)) {
                    ++$enabledCount;
                }
            }
        } catch (Throwable $e) {
            $this->error('启用账号失败: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info(sprintf('执行完成，启用 %d 个账号，已是正常状态 %d 个。', $enabledCount, $accounts->count() - $enabledCount));
        return self::SUCCESS;
    }
}
