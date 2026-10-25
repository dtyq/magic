<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Facade\Open;

use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Domain\Contact\Entity\ValueObject\UserQueryType;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Contact\Assembler\OpenUserSearchAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class MagicUserOpenApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly MagicUserContactAppService $magicUserContactAppService,
    ) {
        parent::__construct($request);
    }

    public function search(): array
    {
        $keyword = trim((string) $this->request->input('query', ''));
        if ($keyword === '') {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR, 'chat.common.param_error', ['param' => 'query']);
        }

        $query = new UserQueryDTO();
        $query->setQuery($keyword);
        $query->setPageToken((string) $this->request->input('page_token', ''));
        $query->setQueryType(UserQueryType::User);
        $query->setFilterAgent(true);

        $result = $this->magicUserContactAppService->searchDepartmentUser(
            $query,
            $this->getUserAuthorization(),
            includeEmployeeNo: true
        );

        return OpenUserSearchAssembler::createPageResponse($result);
    }

    private function getUserAuthorization(): MagicUserAuthorization
    {
        $authorization = RequestCoContext::getUserAuthorization();
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied);
        }

        return $authorization;
    }
}
