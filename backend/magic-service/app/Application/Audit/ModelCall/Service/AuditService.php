<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Service;

use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\StringMaskUtil;
use App\Interfaces\Chat\DTO\UserDetailDTO;
use DateTimeImmutable;
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
        $raw = $this->modelCallAuditDomainService->statistics(
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );

        return [
            'summary' => $this->buildSummary($raw['summary']),
            'trend' => $this->buildTrend($raw['trend']),
            'breakdown' => $this->buildBreakdown($raw['breakdown']),
        ];
    }

    /**
     * 计费侧按 event_id 回写积分（供计费组件包直接注入调用，不对外暴露 HTTP 接口）.
     */
    public function recordPointsByEventId(string $eventId, int $points): void
    {
        $this->modelCallAuditDomainService->recordPointsByEventId($eventId, $points);
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
        $real = trim($detail->getRealName());
        if ($real !== '') {
            return $real;
        }

        return $detail->getNickname();
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

        $startHourMs = (int) (floor($startMs / 3600000) * 3600000);
        $endHourMs = (int) (floor($endMs / 3600000) * 3600000);

        $points = [];
        for ($ms = $startHourMs; $ms <= $endHourMs; $ms += 3600000) {
            $dt = new DateTimeImmutable('@' . intdiv($ms, 1000));
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

        $start = (new DateTimeImmutable('@' . intdiv($startMs, 1000)))->setTime(0, 0, 0);
        $end = (new DateTimeImmutable('@' . intdiv($endMs, 1000)))->setTime(0, 0, 0);

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
}
