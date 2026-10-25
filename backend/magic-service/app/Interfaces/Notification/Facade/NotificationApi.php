<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Notification\Facade;

use App\Application\Notification\Service\NotificationAppService;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\NotificationErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\PersonalAccessToken\PersonalAccessTokenAuthorization;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
final class NotificationApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly NotificationAppService $service,
    ) {
        parent::__construct($request);
    }

    /** @return array<string,mixed> */
    public function list(): array
    {
        return $this->service->list(
            $this->isolation(),
            $this->optionalString('category'),
            $this->optionalString('cursor'),
            $this->pageSize()
        );
    }

    /** @return array{total:int,system_unread:int,authorization_pending:int} */
    public function counts(): array
    {
        return $this->service->counts($this->isolation());
    }

    /** @return array{notification_id:string,read_status:string,read_at:?string} */
    public function read(string $notificationId): array
    {
        return $this->service->markRead($this->isolation(), $notificationId);
    }

    private function isolation(): NotificationDataIsolation
    {
        $authorization = $this->getAuthorization();
        if (! $authorization instanceof MagicUserAuthorization && ! $authorization instanceof PersonalAccessTokenAuthorization) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        $organizationCode = trim($authorization->getOrganizationCode());
        if ($organizationCode === '') {
            ExceptionBuilder::throw(NotificationErrorCode::ORGANIZATION_CONTEXT_REQUIRED);
        }
        return NotificationDataIsolation::create(
            $organizationCode,
            $authorization->getId(),
            $authorization->getMagicId()
        );
    }

    private function optionalString(string $key): ?string
    {
        $value = $this->request->input($key);
        return $value === null ? null : trim((string) $value);
    }

    private function pageSize(): int
    {
        $value = $this->request->input('page_size', 10);
        if (is_array($value) || is_object($value) || (! is_int($value) && ! is_string($value) && ! is_float($value))) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'page_size is invalid');
        }
        return (int) $value;
    }
}
