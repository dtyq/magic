<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\OrganizationEnvironment\DTO;

use App\Domain\OrganizationEnvironment\Entity\ValueObject\OrganizationSearchField;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 组织搜索请求。
 */
class OrganizationSearchRequestDTO extends AbstractDTO
{
    /** 请求字段 search_type 对应的领域搜索字段。 */
    public OrganizationSearchField $searchField;

    /** 搜索内容；组织编码精确匹配，组织名称模糊匹配。 */
    public string $keyword;

    public int $page = 1;

    /** 单页最多 50 条。 */
    public int $pageSize = 20;

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $searchField = OrganizationSearchField::tryFrom(trim((string) $request->input('search_type', '')));
        if ($searchField === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'search_type']);
        }
        $dto->searchField = $searchField;
        $dto->keyword = trim((string) $request->input('keyword', ''));
        if ($dto->keyword === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.empty', ['label' => 'keyword']);
        }

        $dto->page = max(1, (int) $request->input('page', 1));
        $pageSize = (int) $request->input('page_size', 20);
        $dto->pageSize = $pageSize <= 0 ? 20 : min($pageSize, 50);

        return $dto;
    }
}
