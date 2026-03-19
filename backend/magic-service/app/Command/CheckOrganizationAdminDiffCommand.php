<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use Hyperf\Codec\Json;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Redis\Redis;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class CheckOrganizationAdminDiffCommand extends HyperfCommand
{
    private const REDIS_KEY_PREFIX = 'magic_organization_whitelists:';

    public function __construct(
        private readonly MagicOrganizationEnvDomainService $organizationEnvDomainService,
        private readonly OrganizationAdminRepositoryInterface $organizationAdminRepository,
        private readonly MagicAccountDomainService $magicAccountDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly Redis $redis,
    ) {
        parent::__construct('magic:check-organization-admin-diff');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Check differences between legacy and new organization admins');
        $this->addOption('org', 'o', InputOption::VALUE_OPTIONAL, 'Organization codes, comma-separated');
        $this->addOption('format', 'f', InputOption::VALUE_OPTIONAL, 'Output format: text|json', 'text');
        $this->addOption('include-all', 'a', InputOption::VALUE_NONE, 'Include organizations without diffs');
    }

    public function handle(): int
    {
        $orgOption = (string) $this->input->getOption('org');
        $format = strtolower((string) $this->input->getOption('format'));
        $includeAll = (bool) $this->input->getOption('include-all');

        $organizationCodes = $this->resolveOrganizationCodes($orgOption);
        if (empty($organizationCodes)) {
            $this->line('No organization codes found.');
            return 0;
        }

        sort($organizationCodes);

        $results = [];
        $hasDiff = false;
        $checkedCount = 0;

        foreach ($organizationCodes as $organizationCode) {
            ++$checkedCount;
            $legacyPhones = $this->getLegacyAdminPhones($organizationCode);
            $newData = $this->getNewAdminPhones($organizationCode);
            $newPhones = $newData['phones'];

            $onlyInLegacy = array_values(array_diff($legacyPhones, $newPhones));
            $onlyInNew = array_values(array_diff($newPhones, $legacyPhones));
            sort($onlyInLegacy);
            sort($onlyInNew);

            $diffForOrg = ! empty($onlyInLegacy) || ! empty($onlyInNew);
            if ($diffForOrg) {
                $hasDiff = true;
            }

            if ($diffForOrg || $includeAll || $format === 'json') {
                $results[] = [
                    'organization_code' => $organizationCode,
                    'legacy_count' => count($legacyPhones),
                    'new_count' => count($newPhones),
                    'only_in_legacy' => $onlyInLegacy,
                    'only_in_new' => $onlyInNew,
                    'new_missing_magic_ids' => $newData['missing_magic_ids'],
                    'new_missing_accounts' => $newData['missing_accounts'],
                ];
            }
        }

        if ($format === 'json') {
            $this->line(Json::encode([
                'checked' => $checkedCount,
                'diff_found' => $hasDiff,
                'results' => $results,
            ], JSON_UNESCAPED_SLASHES));
            return $hasDiff ? 1 : 0;
        }

        if (empty($results)) {
            $this->line('No differences found.');
            return 0;
        }

        foreach ($results as $result) {
            $this->line(sprintf('Organization: %s', $result['organization_code']));
            $this->line(sprintf('  legacy_count: %d', $result['legacy_count']));
            $this->line(sprintf('  new_count: %d', $result['new_count']));

            if (! empty($result['only_in_legacy'])) {
                $this->line(sprintf('  only_in_legacy: %s', implode(', ', $result['only_in_legacy'])));
            }
            if (! empty($result['only_in_new'])) {
                $this->line(sprintf('  only_in_new: %s', implode(', ', $result['only_in_new'])));
            }
            if (! empty($result['new_missing_magic_ids'])) {
                $this->line(sprintf('  new_missing_magic_ids: %s', implode(', ', $result['new_missing_magic_ids'])));
            }
            if (! empty($result['new_missing_accounts'])) {
                $this->line(sprintf('  new_missing_accounts: %s', implode(', ', $result['new_missing_accounts'])));
            }
            $this->line('');
        }

        $this->line(sprintf('Checked %d organization(s). Diff found: %s', $checkedCount, $hasDiff ? 'yes' : 'no'));

        return $hasDiff ? 1 : 0;
    }

    private function resolveOrganizationCodes(string $orgOption): array
    {
        if ($orgOption !== '') {
            return $this->uniqueValues(array_map('trim', explode(',', $orgOption)));
        }

        $codes = $this->organizationEnvDomainService->getAllOrganizationCodes();
        $codes = array_merge($codes, $this->getWhitelistOrganizationCodes(), $this->getRedisOrganizationCodes());

        return $this->uniqueValues($codes);
    }

    private function getLegacyAdminPhones(string $organizationCode): array
    {
        $phones = [];

        $whitelist = $this->getWhitelistPhones($organizationCode);
        if (! empty($whitelist)) {
            $phones = array_merge($phones, $whitelist);
        }

        $redisPhones = $this->getRedisPhones($organizationCode);
        if (! empty($redisPhones)) {
            $phones = array_merge($phones, $redisPhones);
        }

        return $this->normalizePhones($phones);
    }

    private function getWhitelistPhones(string $organizationCode): array
    {
        $whitelists = config('permission.organization_whitelists', []);
        $phones = $whitelists[$organizationCode] ?? [];
        return is_array($phones) ? $phones : [];
    }

    private function getRedisPhones(string $organizationCode): array
    {
        try {
            $data = $this->redis->get($this->getRedisKey($organizationCode));
        } catch (Throwable $e) {
            $this->line(sprintf('Redis read failed for %s: %s', $organizationCode, $e->getMessage()));
            return [];
        }

        if ($data === false || $data === '' || $data === null) {
            return [];
        }

        try {
            $decoded = Json::decode((string) $data);
        } catch (Throwable $e) {
            $this->line(sprintf('Redis decode failed for %s: %s', $organizationCode, $e->getMessage()));
            return [];
        }

        return is_array($decoded) ? $decoded : [];
    }

    private function getNewAdminPhones(string $organizationCode): array
    {
        $dataIsolation = DataIsolation::simpleMake($organizationCode);
        $admins = $this->organizationAdminRepository->getAllOrganizationAdmins($dataIsolation);

        $magicIds = [];
        $missingMagicIds = [];

        foreach ($admins as $admin) {
            if (! $admin instanceof OrganizationAdminEntity || ! $admin->isEnabled()) {
                continue;
            }

            $magicId = $admin->getMagicId();
            if (empty($magicId)) {
                $user = $this->magicUserDomainService->getUserById($admin->getUserId());
                $magicId = $user?->getMagicId();
            }

            if (empty($magicId)) {
                $missingMagicIds[] = $admin->getUserId();
                continue;
            }

            $magicIds[] = (string) $magicId;
        }

        $magicIds = $this->uniqueValues($magicIds);
        if (empty($magicIds)) {
            return [
                'phones' => [],
                'missing_magic_ids' => $this->uniqueValues($missingMagicIds),
                'missing_accounts' => [],
            ];
        }

        $accounts = $this->magicAccountDomainService->getAccountByMagicIds($magicIds);
        $accountByMagicId = [];
        foreach ($accounts as $account) {
            $accountByMagicId[(string) $account->getMagicId()] = $account;
        }

        $phones = [];
        $missingAccounts = [];
        foreach ($magicIds as $magicId) {
            $account = $accountByMagicId[$magicId] ?? null;
            if ($account === null) {
                $missingAccounts[] = $magicId;
                continue;
            }

            $phone = trim($account->getPhone());
            if ($phone !== '') {
                $phones[] = $phone;
            }
        }

        return [
            'phones' => $this->normalizePhones($phones),
            'missing_magic_ids' => $this->uniqueValues($missingMagicIds),
            'missing_accounts' => $this->uniqueValues($missingAccounts),
        ];
    }

    private function getWhitelistOrganizationCodes(): array
    {
        $whitelists = config('permission.organization_whitelists', []);
        return array_keys(is_array($whitelists) ? $whitelists : []);
    }

    private function getRedisOrganizationCodes(): array
    {
        $codes = [];
        $cursor = 0;

        try {
            do {
                $keys = $this->redis->scan($cursor, self::REDIS_KEY_PREFIX . '*', 200);
                if ($keys === false) {
                    break;
                }
                foreach ($keys as $key) {
                    $codes[] = substr($key, strlen(self::REDIS_KEY_PREFIX));
                }
            } while ($cursor !== 0);
        } catch (Throwable $e) {
            $this->line(sprintf('Redis scan failed: %s', $e->getMessage()));
        }

        return $codes;
    }

    private function getRedisKey(string $organizationCode): string
    {
        return self::REDIS_KEY_PREFIX . $organizationCode;
    }

    private function normalizePhones(array $phones): array
    {
        $normalized = [];
        foreach ($phones as $phone) {
            $phone = trim((string) $phone);
            if ($phone !== '') {
                $normalized[] = $phone;
            }
        }

        return $this->uniqueValues($normalized);
    }

    private function uniqueValues(array $values): array
    {
        $values = array_filter($values, static fn ($value) => $value !== '');
        return array_values(array_unique($values));
    }
}
