<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Service\MagicAccountRevocationService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class DisableMagicAccountCommand extends HyperfCommand
{
    public function __construct(
        private readonly MagicAccountRevocationService $revocationService,
    ) {
        parent::__construct('account:disable');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('封禁 Magic 账号，禁止该账号继续登录使用');
        $this->addOption('magic-id', null, InputOption::VALUE_REQUIRED, '要封禁的 Magic ID');
        $this->addOption('phone', null, InputOption::VALUE_REQUIRED, '要封禁的手机号（必须唯一匹配账号）');
        $this->addOption('email', null, InputOption::VALUE_REQUIRED, '要封禁的邮箱域名（例如 example.com）');
        $this->addOption('execute', null, InputOption::VALUE_NONE, '确认执行禁用及凭证撤销');
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
                ->leftJoin('magic_environments as e', 'e.id', '=', 'magic_contact_accounts.magic_environment_id')
                ->select([
                    'magic_contact_accounts.magic_id',
                    'magic_contact_accounts.phone',
                    'magic_contact_accounts.email',
                    'magic_contact_accounts.real_name',
                    'magic_contact_accounts.magic_environment_id',
                    'magic_contact_accounts.status',
                    'e.deployment as environment_deployment',
                    'e.environment as environment_name',
                    'e.environment_code',
                ])
                ->whereNull('magic_contact_accounts.deleted_at')
                ->when($magicId !== '', static fn ($query) => $query->where('magic_contact_accounts.magic_id', $magicId))
                ->when($phone !== '', static fn ($query) => $query->where('magic_contact_accounts.phone', $phone))
                ->when($emailDomain !== '', static fn ($query) => $query->where('magic_contact_accounts.email', 'like', '%@' . $emailDomain))
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

        $userNames = Db::table('magic_contact_users')
            ->select(['magic_id', 'nickname'])
            ->whereIn('magic_id', $accounts->pluck('magic_id')->all())
            ->whereNull('deleted_at')
            ->get()
            ->groupBy('magic_id')
            ->map(static fn ($users): string => $users
                ->pluck('nickname')
                ->filter(static fn ($nickname): bool => trim((string) $nickname) !== '')
                ->unique()
                ->implode(', '));

        if ($emailDomain !== '') {
            $this->line("目标邮箱域名: {$emailDomain}");
            $this->line("匹配账号数: {$accounts->count()}");
        }
        $this->line('预检查账号信息:');
        $this->printAccountTable($accounts, $userNames);

        if ($phone !== '' && $accounts->count() > 1) {
            $this->error('手机号匹配到多个账号，预检查已完成；请改用 --magic-id 精确指定后再执行。');
            return $this->input->getOption('execute') ? self::FAILURE : self::SUCCESS;
        }

        foreach ($accounts as $account) {
            $currentStatus = (int) $account->status;
            if ($currentStatus !== AccountStatus::Disable->value && $currentStatus !== AccountStatus::Normal->value) {
                $this->error("账号 {$account->magic_id} 的状态值 {$currentStatus} 不受支持，已停止操作。");
                return self::FAILURE;
            }
        }

        if (! $this->input->getOption('execute')) {
            $this->info('预检查完成，未执行禁用。确认后请追加 --execute。');
            return self::SUCCESS;
        }

        $this->line('开始执行禁用及凭证撤销。');

        try {
            $summary = ['account_tokens' => 0, 'user_tokens' => 0, 'api_keys' => 0];
            foreach ($accounts as $account) {
                $result = $this->revocationService->revoke((string) $account->magic_id);
                $summary['account_tokens'] += $result['account_tokens'];
                $summary['user_tokens'] += $result['user_tokens'];
                $summary['api_keys'] += $result['api_keys'];
            }
        } catch (Throwable $e) {
            $this->error('封禁账号失败: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info(sprintf(
            $emailDomain === ''
                ? '账号 %s 已封禁，撤销 Account Token %d 条、用户 Token %d 条、API Key %d 条。'
                : '邮箱域名 %s 下的 %d 个账号已封禁，撤销 Account Token %d 条、用户 Token %d 条、API Key %d 条。',
            ...($emailDomain === ''
                ? [(string) $accounts->first()->magic_id, $summary['account_tokens'], $summary['user_tokens'], $summary['api_keys']]
                : [$emailDomain, $accounts->count(), $summary['account_tokens'], $summary['user_tokens'], $summary['api_keys']])
        ));
        return self::SUCCESS;
    }

    private function printAccountTable($accounts, $userNames): void
    {
        $headers = ['magic-id', '用户名', '手机号', '邮箱', '关联环境', '状态'];
        $rows = [];
        foreach ($accounts as $account) {
            $status = (int) $account->status === AccountStatus::Normal->value ? '正常' : '已禁用';
            $username = trim((string) ($account->real_name ?? ''));
            if ($username === '') {
                $username = (string) ($userNames->get((string) $account->magic_id) ?? '');
            }
            $environment = trim(implode('/', array_filter([
                (string) ($account->environment_deployment ?? ''),
                (string) ($account->environment_name ?? ''),
                (string) ($account->environment_code ?? ''),
            ])), '/');
            if ($environment === '') {
                $environment = 'id=' . (string) ($account->magic_environment_id ?? 0);
            }
            $rows[] = [
                (string) $account->magic_id,
                $username,
                (string) ($account->phone ?? ''),
                (string) ($account->email ?? ''),
                $environment,
                $status,
            ];
        }

        $widths = array_map(fn (string $value): int => $this->displayWidth($value), $headers);
        foreach ($rows as $row) {
            foreach ($row as $index => $value) {
                $widths[$index] = max($widths[$index], $this->displayWidth($value));
            }
        }
        $separator = '+' . implode('+', array_map(static fn (int $width): string => str_repeat('-', $width + 2), $widths)) . '+';
        $this->line($separator);
        $this->line($this->formatTableRow($headers, $widths));
        $this->line($separator);
        foreach ($rows as $row) {
            $this->line($this->formatTableRow($row, $widths));
        }
        $this->line($separator);
    }

    private function formatTableRow(array $values, array $widths): string
    {
        $cells = [];
        foreach ($values as $index => $value) {
            $padding = max(0, $widths[$index] - $this->displayWidth($value));
            $cells[] = ' ' . $value . str_repeat(' ', $padding) . ' ';
        }
        return '|' . implode('|', $cells) . '|';
    }

    private function displayWidth(string $value): int
    {
        return function_exists('mb_strwidth') ? mb_strwidth($value, 'UTF-8') : strlen($value);
    }
}
