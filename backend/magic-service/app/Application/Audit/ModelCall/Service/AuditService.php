<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Service;

use App\Application\Audit\ModelCall\Event\AuditLogEvent;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\StringMaskUtil;
use App\Interfaces\Chat\DTO\UserDetailDTO;
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
     * @param array $userInfo 用户信息 ['organization_code' => '', 'user_id' => '', 'user_name' => '']（落库仅 user_id、organization_code）
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
        array $businessParams = [],
        ModelAuditAccessScope $accessScope = ModelAuditAccessScope::Magic,
    ): void {
        try {
            $ip = $this->normalizeClientIpForAudit($ip);
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
                businessParams: $businessParams,
                accessScope: $accessScope,
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
     * 审计落库 IP：逗号分隔链（X-Forwarded-For / 多来源拼接）只保留第一个非空段，避免重复段落库.
     */
    private function normalizeClientIpForAudit(string $ip): string
    {
        $ip = trim($ip);
        if ($ip === '') {
            return '';
        }
        foreach (explode(',', $ip) as $segment) {
            $segment = trim($segment);
            if ($segment !== '') {
                return $segment;
            }
        }

        return '';
    }

    /**
     * 管理端查询模型调用审计列表（行内为表字段 + 反查得到的 user_info）.
     *
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
            'list' => $this->enrichUserInfoForAdminList($list),
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
}
