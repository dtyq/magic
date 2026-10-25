<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Facade\Agent;

use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class ProjectFileApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService,
    ) {
        parent::__construct($request);
    }

    public function index(RequestContext $requestContext, string $id): array
    {
        $authorization = $this->getAuthorization();
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }

        $body = $this->request->all();
        $allowed = ['parent_id', 'page_size', 'next_parent_ids'];
        if (! self::isPositiveId($id)
            || array_diff(array_keys($body), $allowed)
            || (array_key_exists('page_size', $body)
                && (! is_int($body['page_size']) || $body['page_size'] < 1 || $body['page_size'] > 100))
            || (array_key_exists('next_parent_ids', $body)
                && (! is_array($body['next_parent_ids']) || ! array_is_list($body['next_parent_ids']) || count($body['next_parent_ids']) > 10000))
            || (array_key_exists('parent_id', $body)
                && $body['parent_id'] !== null
                && (! is_string($body['parent_id']) || ! self::isPositiveId($body['parent_id'])))) {
            ExceptionBuilder::throw(UserErrorCode::INPUT_PARAM_ERROR);
        }

        $requestContext->setUserAuthorization($authorization);
        $body['page_size'] ??= 50;
        $dto = new GetProjectAttachmentsV2RequestDTO($body, $id);
        return $this->projectAppService->getProjectAttachmentsV2($requestContext, $dto);
    }

    private static function isPositiveId(string $id): bool
    {
        return preg_match('/^[1-9][0-9]*$/D', $id) === 1
            && (strlen($id) < strlen((string) PHP_INT_MAX)
                || (strlen($id) === strlen((string) PHP_INT_MAX) && strcmp($id, (string) PHP_INT_MAX) <= 0));
    }
}
