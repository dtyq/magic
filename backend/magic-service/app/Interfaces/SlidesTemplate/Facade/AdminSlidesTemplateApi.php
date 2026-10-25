<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SlidesTemplate\Service\AdminSlidesTemplateAppService;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateAssembler;
use App\Interfaces\SlidesTemplate\DTO\Request\AdminQuerySlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\ReindexVectorIndexRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\SaveSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\UpdateSlidesTemplateSortRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\UpdateSlidesTemplateStatusRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\UpdateSlidesTemplateTagsRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse('low_code')]
class AdminSlidesTemplateApi extends AbstractApi
{
    public function __construct(
        private readonly AdminSlidesTemplateAppService $adminSlidesTemplateAppService,
    ) {
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::QUERY)]
    public function queries(AdminQuerySlidesTemplateRequest $request): array
    {
        $request->validated();
        $result = $this->adminSlidesTemplateAppService->queries($this->getAuthorization(), $request);

        return SlidesTemplateAssembler::createPageDTO(
            $result['list'],
            $result['page'],
            $result['total'],
            true,
            $result['categories']
        )->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::QUERY)]
    public function detail(string $id): array
    {
        $template = $this->adminSlidesTemplateAppService->detail($this->getAuthorization(), $id);

        return SlidesTemplateAssembler::createAdminDetailDTO($template)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function create(SaveSlidesTemplateRequest $request): array
    {
        $request->validated();
        $template = $this->adminSlidesTemplateAppService->create($this->getAuthorization(), $request);

        return SlidesTemplateAssembler::createAdminDetailDTO($template)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function update(SaveSlidesTemplateRequest $request, string $id): array
    {
        $request->validated();
        $template = $this->adminSlidesTemplateAppService->update($this->getAuthorization(), $id, $request);

        return SlidesTemplateAssembler::createAdminDetailDTO($template)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function updateTags(UpdateSlidesTemplateTagsRequest $request, string $id): array
    {
        $request->validated();
        $template = $this->adminSlidesTemplateAppService->updateTags($this->getAuthorization(), $id, $request);

        return SlidesTemplateAssembler::createAdminDetailDTO($template)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function updateStatus(UpdateSlidesTemplateStatusRequest $request, string $id): array
    {
        $request->validated();
        $this->adminSlidesTemplateAppService->updateStatus($this->getAuthorization(), $id, $request->getStatus());
        return [];
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function updateSort(UpdateSlidesTemplateSortRequest $request, string $id): array
    {
        $request->validated();
        $this->adminSlidesTemplateAppService->updateSort($this->getAuthorization(), $id, $request->getSort());
        return [];
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function delete(string $id): array
    {
        $this->adminSlidesTemplateAppService->delete($this->getAuthorization(), $id);
        return [];
    }

    /**
     * 重建幻灯片模板向量索引.
     *
     * 可选参数 force_re_embedding：为 true 时，若向量集合维度与模型实际输出维度不一致，会删除集合并按实际维度重建后全量重灌。
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_SLIDES_TEMPLATE], MagicOperationEnum::EDIT)]
    public function reindexVectorIndex(ReindexVectorIndexRequest $request): array
    {
        $request->validated();

        return $this->adminSlidesTemplateAppService->reindexVectorIndex(
            $this->getAuthorization(),
            $request->getForceReEmbedding(),
        );
    }
}
