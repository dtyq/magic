<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Facade\Agent;

use App\Application\SuperMagic\Task\Service\UserInfoAppService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class UserApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly UserInfoAppService $userInfoAppService,
    ) {
        parent::__construct($request);
    }

    public function show(): array
    {
        $authorization = $this->getAuthorization();
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }

        $query = $this->request->query();
        $fields = $query['include_sensitive_fields'] ?? [];
        // me 只表示已认证主体；拒绝身份覆盖参数和未知敏感字段。
        if (array_diff(array_keys($query), ['include_sensitive_fields'])
            || ! is_array($fields) || ! array_is_list($fields)
            || array_filter($fields, static fn ($field): bool => $field !== 'phone')) {
            ExceptionBuilder::throw(UserErrorCode::INPUT_PARAM_ERROR);
        }

        return $this->userInfoAppService->getUserInfo($authorization, $fields)->toArray();
    }
}
