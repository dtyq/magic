<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Service;

use App\Application\Audit\ModelCall\Event\AuditLogEvent;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\StringMaskUtil;
use DateTimeInterface;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class AuditService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly ModelCallAuditDomainService $modelCallAuditDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * 发布审计事件 - 统一入口方法.
     *
     * @param array $userInfo 用户信息 ['organization_code' => '', 'user_id' => '', 'user_name' => '']
     * @param string $ip 客户端 IP
     * @param AuditType $type 审计类型枚举
     * @param string $productCode 产品/模型标识
     * @param string $accessToken 原始 accessToken（内部自动脱敏）
     * @param float $startTime 请求开始时间（microtime(true) 格式）
     * @param int $latencyMs 耗时毫秒
     * @param AuditStatus $status 状态枚举
     * @param array $usage 用量信息
     * @param null|array $detailInfo 详情信息
     * @param array $businessParams 业务参数（透传给订阅者，不落库）
     */
    public function dispatchAuditEvent(
        array $userInfo,
        string $ip,
        AuditType $type,
        string $productCode,
        string $accessToken,
        float $startTime,
        int $latencyMs,
        AuditStatus $status,
        array $usage = [],
        ?array $detailInfo = null,
        array $businessParams = []
    ): void {
        try {
            $event = new AuditLogEvent(
                ip: $ip,
                type: $type->value,
                productCode: $productCode,
                status: $status->value,
                ak: StringMaskUtil::mask($accessToken),
                operationTime: (int) ($startTime * 1000),
                allLatency: $latencyMs,
                userInfo: $userInfo,
                usage: $usage,
                detailInfo: $detailInfo,
                businessParams: $businessParams
            );

            $this->eventDispatcher->dispatch($event);
        } catch (Throwable $throwable) {
            $this->logger->error('Model audit dispatchAuditEvent failed', [
                'type' => $type->value,
                'product_code' => $productCode,
                'status' => $status->value,
                'operation_time' => (int) ($startTime * 1000),
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * 管理端查询模型调用审计列表.
     * @param array<string, mixed> $filters
     * @return array{total: int, page: int, page_size: int, list: array<int, array<string, mixed>>}
     */
    public function listForAdmin(
        int $page,
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false
    ): array {
        $pageVO = new Page($page, $pageSize);
        $result = $this->modelCallAuditDomainService->queries(
            $pageVO,
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );
        $list = is_array($result['list'] ?? null) ? $result['list'] : [];

        return [
            'total' => (int) ($result['total'] ?? 0),
            'page' => $pageVO->getPage(),
            'page_size' => $pageVO->getPageNum(),
            'list' => $this->appendAllDetailToListItems($this->enrichUserInfoForAdminList($list)),
        ];
    }

    /**
     * 列表每项补充 all_detail：与表 magic_model_audit_logs 列一致的快照（便于导出/对账）.
     *
     * @param array<int, mixed> $list
     * @return array<int, array<string, mixed>>
     */
    private function appendAllDetailToListItems(array $list): array
    {
        $out = [];
        foreach ($list as $item) {
            $row = $this->listItemToRowArray($item);
            $row['all_detail'] = $this->buildAllDetailPayload($row);
            $out[] = $row;
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function listItemToRowArray(mixed $item): array
    {
        if (is_array($item)) {
            return $item;
        }
        if ($item instanceof Model) {
            return $item->toArray();
        }

        return [];
    }

    /**
     * 仅收录审计表列，与列表行当前值一致（含 enrich 后的 user_info）.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function buildAllDetailPayload(array $row): array
    {
        $keys = [
            'id',
            'user_info',
            'ip',
            'type',
            'product_code',
            'status',
            'ak',
            'operation_time',
            'all_latency',
            'usage',
            'detail_info',
            'created_at',
            'updated_at',
        ];
        $detail = [];
        foreach ($keys as $key) {
            if (! array_key_exists($key, $row)) {
                continue;
            }
            $detail[$key] = $this->normalizeAllDetailValue($row[$key], $key);
        }

        return $detail;
    }

    private function normalizeAllDetailValue(mixed $value, string $key): mixed
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        if ($key === 'id' && $value !== null && $value !== '') {
            return (string) $value;
        }

        if ($key === 'operation_time' || $key === 'all_latency') {
            return (int) $value;
        }

        if ($key === 'user_info' || $key === 'usage') {
            return is_array($value) ? $value : [];
        }

        if ($key === 'detail_info') {
            return is_array($value) ? $value : null;
        }

        return $value;
    }

    /**
     * @param array<int, array<string, mixed>> $list
     * @return array<int, array<string, mixed>>
     */
    private function enrichUserInfoForAdminList(array $list): array
    {
        $userIds = [];
        foreach ($list as $item) {
            $uid = (string) ($item['user_info']['user_id'] ?? $item['user_info']['id'] ?? '');
            if ($uid !== '') {
                $userIds[] = $uid;
            }
        }
        $userIds = array_values(array_unique($userIds));
        if ($userIds === []) {
            return $list;
        }

        try {
            $details = $this->magicUserDomainService->getUserDetailByUserIdsInMagic($userIds, true);
            $detailMap = [];
            foreach ($details as $detail) {
                $detailMap[$detail->getUserId()] = [
                    'phone' => $detail->getPhone(),
                    'email' => $this->maskEmail((string) ($detail->getEmail() ?? '')),
                ];
            }

            foreach ($list as &$item) {
                $item['user_info'] = is_array($item['user_info'] ?? null) ? $item['user_info'] : [];
                $uid = (string) ($item['user_info']['user_id'] ?? $item['user_info']['id'] ?? '');
                $item['user_info']['email'] = '';
                if ($uid !== '' && isset($detailMap[$uid])) {
                    $phone = (string) ($detailMap[$uid]['phone'] ?? '');
                    $email = (string) ($detailMap[$uid]['email'] ?? '');
                    if ($phone !== '') {
                        $item['user_info']['phone'] = $phone;
                    }
                    $item['user_info']['email'] = $email;
                }
            }
        } catch (Throwable $throwable) {
            // 用户附加信息补全失败不影响主流程
            $this->logger->warning('Model audit list enrich user info failed', [
                'user_ids_count' => count($userIds),
                'error' => $throwable->getMessage(),
            ]);
        }

        return $list;
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
}
