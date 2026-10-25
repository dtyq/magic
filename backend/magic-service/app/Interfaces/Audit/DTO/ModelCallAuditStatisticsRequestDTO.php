<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\DTO;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTimeImmutable;
use DateTimeZone;
use Hyperf\HttpServer\Contract\RequestInterface;

use function Hyperf\Config\config;

/**
 * 模型调用审计统计请求.
 */
class ModelCallAuditStatisticsRequestDTO extends AbstractDTO
{
    public string $startDate = '';

    public string $endDate = '';

    public string $serviceProviderConfigId = '';

    public string $productCode = '';

    public string $accessScope = '';

    public string $organizationCode = '';

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->startDate = trim((string) $request->input('start_date', ''));
        $dto->endDate = trim((string) $request->input('end_date', ''));
        $dto->serviceProviderConfigId = trim((string) $request->input('service_provider_config_id', ''));
        $dto->productCode = trim((string) $request->input('product_code', ''));
        $dto->accessScope = trim((string) $request->input('access_scope', ''));
        $dto->organizationCode = trim((string) $request->input('organization_code', ''));

        if (($dto->startDate === '') !== ($dto->endDate === '')) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'start_date and end_date must be provided together'
            );
        }

        return $dto;
    }

    /**
     * @return array<string, mixed>
     */
    public function toFilters(): array
    {
        if ($this->startDate === '' && $this->endDate === '') {
            $today = (new DateTimeImmutable('today', $this->displayTimezone()))->format('Y-m-d');
            [$startMs, $endMs] = $this->parseRange($today . ' 00:00:00', $today . ' 23:59:59');
        } else {
            [$startMs, $endMs] = $this->parseRange($this->startDate, $this->endDate);
        }

        $filters = [
            'start_operation_time' => $startMs,
            'end_operation_time' => $endMs,
        ];
        if ($this->serviceProviderConfigId !== '') {
            $filters['service_provider_config_id'] = $this->serviceProviderConfigId;
        }
        if ($this->productCode !== '') {
            $filters['product_code'] = $this->productCode;
        }
        if ($this->accessScope !== '') {
            $filters['access_scope'] = $this->accessScope;
        }
        if ($this->organizationCode !== '') {
            $filters['organization_code'] = $this->organizationCode;
        }

        return $filters;
    }

    /** @return array{0: int, 1: int} */
    private function parseRange(string $startDate, string $endDate): array
    {
        $timezone = $this->displayTimezone();
        $start = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $startDate, $timezone);
        $startErrors = DateTimeImmutable::getLastErrors();
        $end = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $endDate, $timezone);
        $endErrors = DateTimeImmutable::getLastErrors();
        if (! $start || ! $end
            || ($startErrors !== false && ($startErrors['warning_count'] > 0 || $startErrors['error_count'] > 0))
            || ($endErrors !== false && ($endErrors['warning_count'] > 0 || $endErrors['error_count'] > 0))
            || $start->format('Y-m-d H:i:s') !== $startDate
            || $end->format('Y-m-d H:i:s') !== $endDate
            || $start > $end
        ) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'invalid statistics time range');
        }

        // 兼容旧后台传入分秒：校验原始范围后，扩展到完整小时供归档统计使用。
        $start = $start->setTime((int) $start->format('H'), 0, 0);
        $exclusiveEnd = $end->setTime((int) $end->format('H'), 0, 0)->modify('+1 hour');
        $tomorrowStart = new DateTimeImmutable('tomorrow', $timezone);
        if ($exclusiveEnd > $tomorrowStart) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'end_date cannot be later than today'
            );
        }

        return [$start->getTimestamp() * 1000, $exclusiveEnd->getTimestamp() * 1000];
    }

    private function displayTimezone(): DateTimeZone
    {
        return new DateTimeZone((string) config('app.default_timezone', 'Asia/Shanghai'));
    }
}
