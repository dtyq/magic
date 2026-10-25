<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Service;

use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderVirtualIdentity;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Infrastructure\Util\StringMaskUtil;
use App\Interfaces\Chat\DTO\UserDetailDTO;
use DateTimeImmutable;
use DateTimeZone;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class AuditService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly ModelCallAuditDomainService $modelCallAuditDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly ProviderConfigDomainService $providerConfigDomainService,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * 管理端查询模型调用审计列表（游标分页，行内为表字段 + 反查得到的 user_info）.
     *
     * @param array<string, mixed> $filters
     * @return array{list: array, page_size: int, next_cursor_id: ?string, prev_cursor_id: ?string, has_more: bool}
     */
    public function listForAdmin(
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false,
        ?string $cursorId = null,
        string $direction = 'next'
    ): array {
        $pageSize = ($pageSize <= 0 || $pageSize > 100) ? 20 : $pageSize;
        $filters = $this->normalizeProviderFilters($filters);
        $result = $this->modelCallAuditDomainService->queries(
            $pageSize,
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization,
            $cursorId,
            $direction
        );
        $list = is_array($result['list'] ?? null) ? $result['list'] : [];

        return [
            'list' => $this->enrichUserInfoForAdminList($list),
            'page_size' => $pageSize,
            'next_cursor_id' => $result['next_cursor_id'] ?? null,
            'prev_cursor_id' => $result['prev_cursor_id'] ?? null,
            'has_more' => (bool) ($result['has_more'] ?? false),
        ];
    }

    /**
     * 模型调用审计统计：summary + trend + breakdown.
     *
     * @param array<string, mixed> $filters
     * @return array{summary: array, trend: array, breakdown: array}
     */
    public function statistics(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): array {
        $filters = $this->normalizeProviderFilters($filters);
        $raw = $this->queryStatistics(
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );

        $breakdown = $this->buildBreakdown($raw['breakdown']);
        $breakdown = $this->fillProviderNames($breakdown, $isOfficialOrganization);

        return [
            'summary' => $this->buildSummary($raw['summary']),
            'trend' => $this->buildTrend($raw['trend']),
            'breakdown' => $breakdown,
        ];
    }

    /**
     * 计费侧按 event_id 回写积分（供计费组件包直接注入调用，不对外暴露 HTTP 接口）.
     */
    public function recordPointsByEventId(string $eventId, int $points): void
    {
        $this->modelCallAuditDomainService->recordPointsByEventId($eventId, $points);
    }

    /** @param array<string, mixed> $filters */
    private function queryStatistics(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): array {
        $startMs = (int) ($filters['start_operation_time'] ?? 0);
        $endMs = (int) ($filters['end_operation_time'] ?? 0);
        $timezone = $this->statisticsDisplayTimezone();
        $window = $this->splitStatisticsWindow($startMs, $endMs, $timezone);

        $historyRaw = $this->loadHistoryFromHourly(
            $filters,
            $window,
            $timezone,
            $currentOrganizationCode,
            $isOfficialOrganization
        );
        $todayRaw = $this->loadTodayFromLogs(
            $filters,
            $window,
            $timezone,
            $currentOrganizationCode,
            $isOfficialOrganization
        );

        if ($historyRaw === null) {
            if ($todayRaw === null) {
                return $this->mergeStatisticsRaw(null, null, $startMs, $endMs, $window['byHour']);
            }
            $todayRaw['trend']['start_ms'] = $startMs;
            $todayRaw['trend']['end_ms'] = $endMs;

            return $todayRaw;
        }

        return $this->mergeStatisticsRaw($historyRaw, $todayRaw, $startMs, $endMs, $window['byHour']);
    }

    /**
     * @return array{
     *     byHour: bool,
     *     historyStartMs: ?int,
     *     historyEndMs: ?int,
     *     todayStartMs: ?int,
     *     todayEndMs: ?int
     * }
     */
    private function splitStatisticsWindow(int $startMs, int $endMs, DateTimeZone $timezone): array
    {
        $todayStart = (new DateTimeImmutable('today', $timezone))->getTimestamp() * 1000;
        $tomorrowStart = (new DateTimeImmutable('tomorrow', $timezone))->getTimestamp() * 1000;
        $historyEndMs = min($endMs, $todayStart);
        $todayStartMs = max($startMs, $todayStart);
        $todayEndMs = min($endMs, $tomorrowStart);

        return [
            'byHour' => ($endMs - $startMs) <= 86400000,
            'historyStartMs' => $startMs < $historyEndMs ? $startMs : null,
            'historyEndMs' => $startMs < $historyEndMs ? $historyEndMs : null,
            'todayStartMs' => $todayStartMs < $todayEndMs ? $todayStartMs : null,
            'todayEndMs' => $todayStartMs < $todayEndMs ? $todayEndMs : null,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @param array{byHour: bool, historyStartMs: ?int, historyEndMs: ?int, todayStartMs: ?int, todayEndMs: ?int} $window
     */
    private function loadHistoryFromHourly(
        array $filters,
        array $window,
        DateTimeZone $timezone,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): ?array {
        if ($window['historyStartMs'] === null || $window['historyEndMs'] === null) {
            return null;
        }

        $historyFilters = $filters;
        $historyFilters['start_bucket_at'] = $this->formatDateTime($window['historyStartMs'], $timezone);
        $historyFilters['end_bucket_at'] = $this->formatDateTime($window['historyEndMs'], $timezone);

        return $this->modelCallAuditDomainService->statisticsFromHourlyRecords(
            $historyFilters,
            $currentOrganizationCode,
            $isOfficialOrganization,
            $window['byHour']
        );
    }

    /**
     * @param array<string, mixed> $filters
     * @param array{byHour: bool, historyStartMs: ?int, historyEndMs: ?int, todayStartMs: ?int, todayEndMs: ?int} $window
     */
    private function loadTodayFromLogs(
        array $filters,
        array $window,
        DateTimeZone $timezone,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): ?array {
        if ($window['todayStartMs'] === null || $window['todayEndMs'] === null) {
            return null;
        }

        $todayFilters = $filters;
        $todayFilters['start_operation_time'] = $window['todayStartMs'];
        $todayFilters['end_operation_time'] = $window['todayEndMs'];
        $todayRaw = $this->modelCallAuditDomainService->statistics(
            $todayFilters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );
        if ($window['byHour']) {
            return $todayRaw;
        }

        return $this->normalizeRawTrendToDay($todayRaw, $timezone);
    }

    private function formatDateTime(int $timestampMs, DateTimeZone $timezone): string
    {
        return (new DateTimeImmutable('@' . intdiv($timestampMs, 1000)))
            ->setTimezone($timezone)
            ->format('Y-m-d H:i:s');
    }

    /** @param array{summary: array, trend: array, breakdown: array} $raw */
    private function normalizeRawTrendToDay(array $raw, DateTimeZone $timezone): array
    {
        $days = [];
        foreach ($raw['trend']['rows'] ?? [] as $row) {
            $bucketMs = (int) ($row['bucket_ms'] ?? 0);
            $day = (new DateTimeImmutable('@' . intdiv($bucketMs, 1000)))
                ->setTimezone($timezone)
                ->format('Y-m-d');
            $days[$day]['requests'] = ($days[$day]['requests'] ?? 0) + (int) ($row['requests'] ?? 0);
            $days[$day]['errors'] = ($days[$day]['errors'] ?? 0) + (int) ($row['errors'] ?? 0);
        }
        $raw['trend']['bucket_type'] = 'day';
        $raw['trend']['rows'] = array_map(
            static fn (string $day, array $value): array => [
                'bucket_day' => $day,
                'requests' => $value['requests'],
                'errors' => $value['errors'],
            ],
            array_keys($days),
            array_values($days)
        );
        return $raw;
    }

    private function mergeStatisticsRaw(
        ?array $left,
        ?array $right,
        int $startMs,
        int $endMs,
        bool $byHour
    ): array {
        $summary = [
            'total' => 0,
            'error' => 0,
            'input_tokens' => 0,
            'output_tokens' => 0,
            'total_tokens' => 0,
        ];
        $trend = [];
        $breakdown = [];

        foreach ([$left, $right] as $raw) {
            if ($raw === null) {
                continue;
            }
            foreach (array_keys($summary) as $key) {
                $summary[$key] += (int) ($raw['summary'][$key] ?? 0);
            }
            foreach ($raw['trend']['rows'] ?? [] as $row) {
                $key = $byHour
                    ? (int) ($row['bucket_ms'] ?? 0)
                    : (string) ($row['bucket_day'] ?? '');
                if (! isset($trend[$key])) {
                    $trend[$key] = ['requests' => 0, 'errors' => 0];
                }
                $trend[$key]['requests'] += (int) ($row['requests'] ?? 0);
                $trend[$key]['errors'] += (int) ($row['errors'] ?? 0);
            }
            foreach ($raw['breakdown'] ?? [] as $row) {
                $key = (string) ($row['service_provider_config_id'] ?? '') . '||' . (string) ($row['product_code'] ?? '');
                if (! isset($breakdown[$key])) {
                    $breakdown[$key] = [
                        'service_provider_config_id' => (string) ($row['service_provider_config_id'] ?? ''),
                        'product_code' => (string) ($row['product_code'] ?? ''),
                        'total_requests' => 0,
                        'error_requests' => 0,
                    ];
                }
                $breakdown[$key]['total_requests'] += (int) ($row['total_requests'] ?? 0);
                $breakdown[$key]['error_requests'] += (int) ($row['error_requests'] ?? 0);
            }
        }

        $breakdown = array_values($breakdown);
        usort($breakdown, static function (array $a, array $b): int {
            return $b['total_requests'] <=> $a['total_requests']
                ?: $a['service_provider_config_id'] <=> $b['service_provider_config_id']
                ?: $a['product_code'] <=> $b['product_code'];
        });

        ksort($trend);
        $trendRows = array_map(
            static fn (int|string $bucket, array $value): array => $byHour
                ? ['bucket_ms' => (int) $bucket, 'requests' => $value['requests'], 'errors' => $value['errors']]
                : ['bucket_day' => (string) $bucket, 'requests' => $value['requests'], 'errors' => $value['errors']],
            array_keys($trend),
            array_values($trend)
        );

        return [
            'summary' => $summary,
            'trend' => [
                'bucket_type' => $byHour ? 'hour' : 'day',
                'rows' => $trendRows,
                'start_ms' => $startMs,
                'end_ms' => $endMs,
            ],
            'breakdown' => $breakdown,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $list
     * @return array<int, array<string, mixed>>
     */
    private function enrichUserInfoForAdminList(array $list): array
    {
        $userIds = [];
        foreach ($list as $item) {
            $uid = (string) ($item['user_id'] ?? '');
            if ($uid !== '') {
                $userIds[] = $uid;
            }
        }
        $userIds = array_values(array_unique($userIds));

        /** @var array<string, UserDetailDTO> $detailMap */
        $detailMap = [];
        if ($userIds !== []) {
            try {
                $details = $this->magicUserDomainService->getUserDetailByUserIdsInMagic($userIds, true);
                foreach ($details as $detail) {
                    $detailMap[$detail->getUserId()] = $detail;
                }
            } catch (Throwable $throwable) {
                $this->logger->warning('Model audit list enrich user info failed', [
                    'user_ids_count' => count($userIds),
                    'error' => $throwable->getMessage(),
                ]);
            }
        }

        foreach ($list as &$item) {
            $uid = (string) ($item['user_id'] ?? '');
            $rowOrg = (string) ($item['organization_code'] ?? '');

            if ($uid !== '' && isset($detailMap[$uid])) {
                $d = $detailMap[$uid];
                $detailOrg = $d->getOrganizationCode();
                $item['user_info'] = [
                    'user_id' => $d->getUserId(),
                    'user_name' => $this->resolveUserDisplayNameFromDetail($d),
                    'organization_code' => $detailOrg !== '' ? $detailOrg : $rowOrg,
                    'phone' => $d->getPhone(),
                    'email' => $this->maskEmail((string) ($d->getEmail() ?? '')),
                ];
            } else {
                $item['user_info'] = [
                    'user_id' => $uid,
                    'user_name' => '',
                    'organization_code' => $rowOrg,
                    'phone' => '',
                    'email' => '',
                ];
            }
        }
        unset($item);

        return $list;
    }

    private function resolveUserDisplayNameFromDetail(UserDetailDTO $detail): string
    {
        $nickname = trim($detail->getNickname());
        if ($nickname !== '') {
            return $nickname;
        }

        return trim($detail->getRealName());
    }

    private function maskEmail(string $email): string
    {
        if ($email === '') {
            return '';
        }

        $parts = explode('@', $email, 2);
        if (count($parts) !== 2) {
            return StringMaskUtil::mask($email);
        }

        [$name, $domain] = $parts;
        if ($name === '') {
            return StringMaskUtil::mask($email);
        }

        if (mb_strlen($name) <= 2) {
            $maskedName = mb_substr($name, 0, 1) . '*';
        } else {
            $maskedName = mb_substr($name, 0, 1) . str_repeat('*', mb_strlen($name) - 2) . mb_substr($name, -1, 1);
        }

        return $maskedName . '@' . $domain;
    }

    private function buildSummary(array $raw): array
    {
        $total = (int) ($raw['total'] ?? 0);
        $error = (int) ($raw['error'] ?? 0);
        $errorRate = $total > 0 ? round($error / $total * 100, 4) : 0.0;

        return [
            'total_requests' => $total,
            'error_requests' => $error,
            'error_rate' => $errorRate,
            'input_tokens' => (string) ($raw['input_tokens'] ?? 0),
            'output_tokens' => (string) ($raw['output_tokens'] ?? 0),
            'total_tokens' => (string) ($raw['total_tokens'] ?? 0),
        ];
    }

    private function buildTrend(array $raw): array
    {
        $bucketType = (string) ($raw['bucket_type'] ?? 'hour');
        $startMs = (int) ($raw['start_ms'] ?? 0);
        $endMs = (int) ($raw['end_ms'] ?? 0);
        $rows = $raw['rows'] ?? [];

        if ($bucketType === 'hour') {
            return $this->buildHourlyTrend($startMs, $endMs, $rows);
        }
        return $this->buildDailyTrend($startMs, $endMs, $rows);
    }

    private function buildHourlyTrend(int $startMs, int $endMs, array $rows): array
    {
        $indexed = [];
        foreach ($rows as $r) {
            $indexed[(int) ($r['bucket_ms'] ?? 0)] = $r;
        }

        $tz = $this->statisticsDisplayTimezone();

        $points = [];
        for ($ms = $startMs; $ms < $endMs; $ms += 3600000) {
            // @ 为 UTC 瞬时；转为 app 时区后再格式化，避免「本地日当天」在 JSON 里显示成前一日的 UTC 整点
            $dt = (new DateTimeImmutable('@' . intdiv($ms, 1000)))->setTimezone($tz);
            $bucketLabel = $dt->format('Y-m-d H:i:s');

            $r = $indexed[$ms] ?? null;
            $requests = (int) ($r['requests'] ?? 0);
            $errors = (int) ($r['errors'] ?? 0);
            $errRate = $requests > 0 ? round($errors / $requests * 100, 4) : 0.0;

            $points[] = [
                'bucket_start' => $bucketLabel,
                'requests' => $requests,
                'error_rate' => $errRate,
            ];
        }

        return ['bucket' => 'hour', 'points' => $points];
    }

    private function buildDailyTrend(int $startMs, int $endMs, array $rows): array
    {
        $indexed = [];
        foreach ($rows as $r) {
            $indexed[(string) ($r['bucket_day'] ?? '')] = $r;
        }

        $tz = $this->statisticsDisplayTimezone();
        $start = (new DateTimeImmutable('@' . intdiv($startMs, 1000)))->setTimezone($tz)->modify('today');
        $end = (new DateTimeImmutable('@' . intdiv(max($startMs, $endMs - 1), 1000)))->setTimezone($tz)->modify('today');

        $points = [];
        $cur = $start;
        while ($cur <= $end) {
            $day = $cur->format('Y-m-d');
            $r = $indexed[$day] ?? null;
            $requests = (int) ($r['requests'] ?? 0);
            $errors = (int) ($r['errors'] ?? 0);
            $errRate = $requests > 0 ? round($errors / $requests * 100, 4) : 0.0;

            $points[] = [
                'bucket_start' => $cur->format('Y-m-d 00:00:00'),
                'requests' => $requests,
                'error_rate' => $errRate,
            ];
            $cur = $cur->modify('+1 day');
        }

        return ['bucket' => 'day', 'points' => $points];
    }

    private function buildBreakdown(array $rows): array
    {
        $result = [];
        foreach ($rows as $r) {
            $total = (int) ($r['total_requests'] ?? 0);
            $errors = (int) ($r['error_requests'] ?? 0);
            $errRate = $total > 0 ? round($errors / $total * 100, 4) : 0.0;

            $result[] = [
                'service_provider_config_id' => (string) ($r['service_provider_config_id'] ?? ''),
                'product_code' => (string) ($r['product_code'] ?? ''),
                'total_requests' => $total,
                'error_requests' => $errors,
                'error_rate' => $errRate,
            ];
        }
        return $result;
    }

    private function statisticsDisplayTimezone(): DateTimeZone
    {
        return new DateTimeZone((string) config('app.default_timezone', 'Asia/Shanghai'));
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    private function normalizeProviderFilters(array $filters): array
    {
        $configId = trim((string) ($filters['service_provider_config_id'] ?? ''));
        $hasVirtualId = ProviderVirtualIdentity::isPlatformOfficialId($configId);

        unset($filters['service_provider_config_id']);

        if ($configId === '') {
            return $filters;
        }

        $filters['service_provider_config_ids'] = $hasVirtualId
            ? $this->providerConfigDomainService->getOfficialOrganizationConfigIds()
            : ($this->isPositiveConfigId($configId) ? [(int) $configId] : []);

        return $filters;
    }

    /**
     * @param array<int, array<string, mixed>> $breakdown
     * @return array<int, array<string, mixed>>
     */
    private function fillProviderNames(array $breakdown, bool $isOfficialOrganization): array
    {
        $configIds = [];
        foreach ($breakdown as $row) {
            $configId = (string) ($row['service_provider_config_id'] ?? '');
            if ($configId !== '' && ctype_digit($configId)) {
                $configIds[] = (int) $configId;
            }
        }

        $configIds = array_values(array_unique($configIds));
        if ($configIds === []) {
            foreach ($breakdown as &$row) {
                $row['provider_name'] = '';
                $row['provider_alias'] = '';
            }
            unset($row);
            return $breakdown;
        }

        $identityMetadata = $this->providerConfigDomainService->getProviderConfigIdentityMetadataByIds($configIds);
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();

        foreach ($breakdown as &$row) {
            $configId = (int) ($row['service_provider_config_id'] ?? 0);
            $metadata = $identityMetadata[$configId] ?? null;
            if ($metadata === null) {
                $row['provider_name'] = '';
                $row['provider_alias'] = '';
                continue;
            }

            if (! $isOfficialOrganization
                && $metadata['organization_code'] === $officialOrganizationCode
            ) {
                $row['provider_name'] = ProviderVirtualIdentity::PLATFORM_OFFICIAL_NAME;
                $row['provider_alias'] = ProviderVirtualIdentity::PLATFORM_OFFICIAL_NAME;
                continue;
            }

            $row['provider_name'] = $metadata['provider_name'];
            $row['provider_alias'] = $metadata['provider_alias'];
        }
        unset($row);

        return $breakdown;
    }

    private function isPositiveConfigId(string $configId): bool
    {
        return ctype_digit($configId) && (int) $configId > 0;
    }
}
