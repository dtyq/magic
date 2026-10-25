<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\DTO;

use App\Infrastructure\Core\AbstractDTO;
use DateTimeImmutable;
use DateTimeZone;
use Hyperf\HttpServer\Contract\RequestInterface;

use function Hyperf\Config\config;

/**
 * 模型调用审计列表请求.
 */
class ModelCallAuditListRequestDTO extends AbstractDTO
{
    /** 无有效筛选条件时的默认查询天数：今天往前推 29 天，与今天共 30 个自然日 */
    private const int DEFAULT_RANGE_DAYS = 30;

    public string $type = '';

    public string $status = '';

    public string $productCode = '';

    public string $modelVersion = '';

    public string $providerName = '';

    public string $serviceProviderConfigId = '';

    public string $userId = '';

    public string $accessScope = '';

    public string $magicTopicId = '';

    public string $requestId = '';

    public string $eventId = '';

    public string $organizationCode = '';

    public string $startDate = '';

    public string $endDate = '';

    public int $pageSize = 20;

    public ?string $cursorId = null;

    public string $direction = 'next';

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->type = (string) $request->input('type', '');
        $dto->status = (string) $request->input('status', '');
        $dto->productCode = (string) $request->input('product_code', '');
        $dto->modelVersion = trim((string) $request->input('model_version', ''));
        $dto->providerName = trim((string) $request->input('provider_name', ''));
        $dto->serviceProviderConfigId = trim((string) $request->input('service_provider_config_id', ''));
        $dto->userId = (string) $request->input('user_id', '');
        $dto->accessScope = trim((string) $request->input('access_scope', ''));
        $dto->magicTopicId = trim((string) $request->input('magic_topic_id', ''));
        $dto->requestId = trim((string) $request->input('request_id', ''));
        $dto->eventId = trim((string) $request->input('event_id', ''));
        $dto->organizationCode = trim((string) $request->input('organization_code', ''));
        $dto->startDate = (string) $request->input('start_date', '');
        $dto->endDate = (string) $request->input('end_date', '');
        $dto->pageSize = (int) $request->input('page_size', 20);

        $cursorId = $request->input('cursor_id');
        $dto->cursorId = is_string($cursorId) && $cursorId !== '' ? $cursorId : null;

        $direction = (string) $request->input('direction', 'next');
        $dto->direction = in_array($direction, ['next', 'prev'], true) ? $direction : 'next';

        return $dto;
    }

    /**
     * @return array<string, mixed>
     */
    public function toFilters(bool $isOfficialOrganization): array
    {
        $filters = [];
        $this->putIfNotEmpty($filters, 'type', $this->type);
        $this->putIfNotEmpty($filters, 'status', $this->status);
        $this->putIfNotEmpty($filters, 'product_code', $this->productCode);
        $this->putIfNotEmpty($filters, 'model_version', $this->modelVersion);
        $this->putIfNotEmpty($filters, 'provider_name', $this->providerName);
        $this->putIfNotEmpty($filters, 'service_provider_config_id', $this->serviceProviderConfigId);
        $this->putIfNotEmpty($filters, 'user_id', $this->userId);
        $this->putIfNotEmpty($filters, 'access_scope', $this->accessScope);
        $this->putIfNotEmpty($filters, 'magic_topic_id', $this->magicTopicId);
        $this->putIfNotEmpty($filters, 'request_id', $this->requestId);
        $this->putIfNotEmpty($filters, 'event_id', $this->eventId);
        if ($isOfficialOrganization) {
            $this->putIfNotEmpty($filters, 'organization_code', $this->organizationCode);
        }

        $startDateMs = $this->parseDateToMs($this->startDate, '00:00:00');
        $endDateMs = $this->parseDateToMs($this->endDate, '23:59:59');
        if ($startDateMs !== null) {
            $filters['start_operation_time'] = $startDateMs;
        }
        if ($endDateMs !== null) {
            $filters['end_operation_time'] = $endDateMs;
        }
        if ($filters === []) {
            $filters['start_operation_time'] = $this->defaultStartOperationTimeMs();
            $filters['end_operation_time'] = $this->defaultEndOperationTimeMs();
        }

        return $filters;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function putIfNotEmpty(array &$filters, string $key, string $value): void
    {
        if ($value !== '') {
            $filters[$key] = $value;
        }
    }

    private function parseDateToMs(string $date, string $defaultTime): ?int
    {
        if ($date === '') {
            return null;
        }

        $timezone = $this->displayTimezone();
        $value = strlen($date) === 10 ? $date . ' ' . $defaultTime : $date;
        $dateTime = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if (! $dateTime
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $dateTime->format('Y-m-d H:i:s') !== $value
        ) {
            return null;
        }

        return $dateTime->getTimestamp() * 1000;
    }

    private function defaultEndOperationTimeMs(): int
    {
        return (new DateTimeImmutable('today', $this->displayTimezone()))
            ->setTime(23, 59, 59)
            ->getTimestamp() * 1000 + 999;
    }

    private function defaultStartOperationTimeMs(): int
    {
        return (new DateTimeImmutable('today', $this->displayTimezone()))
            ->modify('-' . (self::DEFAULT_RANGE_DAYS - 1) . ' days')
            ->setTime(0, 0, 0)
            ->getTimestamp() * 1000;
    }

    private function displayTimezone(): DateTimeZone
    {
        return new DateTimeZone((string) config('app.default_timezone', 'Asia/Shanghai'));
    }
}
