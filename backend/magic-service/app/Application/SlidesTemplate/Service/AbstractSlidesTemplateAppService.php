<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Service\SlidesTemplateDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Qbhy\HyperfAuth\Authenticatable;

abstract class AbstractSlidesTemplateAppService extends AbstractKernelAppService
{
    private const FILE_LINKS_BATCH_SIZE = 200;

    public function __construct(
        protected readonly SlidesTemplateDomainService $slidesTemplateDomainService,
    ) {
    }

    protected function createSlidesTemplateDataIsolation(Authenticatable|BaseDataIsolation $authorization): SlidesTemplateDataIsolation
    {
        if ($authorization instanceof SlidesTemplateDataIsolation) {
            return $authorization;
        }

        $dataIsolation = new SlidesTemplateDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            $dataIsolation->setOfficialOrganizationCodes($authorization->getOfficialOrganizationCodes());
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createListPage(int $page, int $pageSize): Page
    {
        $page = new Page($page, $pageSize);
        if ($page->getPage() > 1) {
            $page->setTotal(false);
        }
        return $page;
    }

    /**
     * @param SlidesTemplateEntity[] $templates
     */
    protected function resolveAssetUrls(array $templates, bool $includeTemplateFileUrl = false): void
    {
        if ($templates === []) {
            return;
        }

        $publicPathsByOrg = [];
        $privatePathsByOrg = [];
        foreach ($templates as $template) {
            $this->appendFilePath($publicPathsByOrg, $template->getOrganizationCode(), $template->getThumbnailFileKey());
            $this->appendFilePath($publicPathsByOrg, $template->getOrganizationCode(), $template->getCollageFileKey());
            $this->appendFilePaths($publicPathsByOrg, $template->getOrganizationCode(), $template->getPreviewImageFileKeys());
            if ($includeTemplateFileUrl) {
                $this->appendFilePath($privatePathsByOrg, $template->getOrganizationCode(), $template->getTemplateFileKey());
            }
        }
        $publicLinksByOrg = [];
        foreach ($publicPathsByOrg as $organizationCode => $paths) {
            $publicLinksByOrg[$organizationCode] = $this->getPublicFileLinksInBatches($organizationCode, array_values(array_unique($paths)));
        }
        $privateLinksByOrg = [];
        foreach ($privatePathsByOrg as $organizationCode => $paths) {
            $privateLinksByOrg[$organizationCode] = $this->getPrivateFileLinksInBatches($organizationCode, array_values(array_unique($paths)));
        }

        foreach ($templates as $template) {
            $organizationCode = $template->getOrganizationCode();
            $template->setThumbnailUrl($this->resolveUrl($publicLinksByOrg, $organizationCode, $template->getThumbnailFileKey()));
            $template->setCollageUrl($this->resolveUrl($publicLinksByOrg, $organizationCode, $template->getCollageFileKey()));
            $template->setPreviewImageUrls($this->resolveUrls($publicLinksByOrg, $organizationCode, $template->getPreviewImageFileKeys()));
            if ($includeTemplateFileUrl) {
                $template->setTemplateFileUrl($this->resolveUrl($privateLinksByOrg, $organizationCode, $template->getTemplateFileKey()));
            }
        }
    }

    /**
     * @param SlidesTemplateEntity[] $templates
     */
    protected function resolveListImageUrls(array $templates): void
    {
        if ($templates === []) {
            return;
        }

        $publicPathsByOrg = [];
        foreach ($templates as $template) {
            $this->appendFilePath($publicPathsByOrg, $template->getOrganizationCode(), $template->getThumbnailFileKey());
            $this->appendFilePath($publicPathsByOrg, $template->getOrganizationCode(), $template->getCollageFileKey());
        }

        $publicLinksByOrg = [];
        foreach ($publicPathsByOrg as $organizationCode => $paths) {
            $publicLinksByOrg[$organizationCode] = $this->getPublicFileLinksInBatches($organizationCode, array_values(array_unique($paths)));
        }

        foreach ($templates as $template) {
            $organizationCode = $template->getOrganizationCode();
            $template->setThumbnailUrl($this->resolveUrl($publicLinksByOrg, $organizationCode, $template->getThumbnailFileKey()));
            $template->setCollageUrl($this->resolveUrl($publicLinksByOrg, $organizationCode, $template->getCollageFileKey()));
        }
    }

    protected function resolveTemplateFileUrl(SlidesTemplateEntity $template): void
    {
        $fileLinks = $this->getPrivateFileLinks($template->getOrganizationCode(), [$template->getTemplateFileKey()]);
        $fileLink = $fileLinks[$template->getTemplateFileKey()] ?? null;
        if (! $fileLink instanceof FileLink || trim($fileLink->getUrl()) === '') {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::FILE_URL_GENERATE_FAILED);
        }
        $template->setTemplateFileUrl($fileLink->getUrl());
    }

    private function appendFilePath(array &$pathsByOrg, string $organizationCode, ?string $fileKey): void
    {
        if ($organizationCode === '' || $fileKey === null || $fileKey === '') {
            return;
        }
        $pathsByOrg[$organizationCode][] = $fileKey;
    }

    private function appendFilePaths(array &$pathsByOrg, string $organizationCode, array $fileKeys): void
    {
        foreach ($fileKeys as $fileKey) {
            $this->appendFilePath($pathsByOrg, $organizationCode, $fileKey);
        }
    }

    private function getPublicFileLinksInBatches(string $organizationCode, array $fileLinks): array
    {
        return $this->getFileLinksInBatches(
            $organizationCode,
            $fileLinks,
            fn (string $organizationCode, array $fileLinks): array => $this->getPublicFileLinks($organizationCode, $fileLinks)
        );
    }

    private function getPrivateFileLinksInBatches(string $organizationCode, array $fileLinks): array
    {
        return $this->getFileLinksInBatches(
            $organizationCode,
            $fileLinks,
            fn (string $organizationCode, array $fileLinks): array => $this->getPrivateFileLinks($organizationCode, $fileLinks)
        );
    }

    private function getFileLinksInBatches(string $organizationCode, array $fileLinks, callable $resolver): array
    {
        $fileLinksMap = [];
        foreach (array_chunk($fileLinks, self::FILE_LINKS_BATCH_SIZE) as $fileLinksBatch) {
            $fileLinksMap = array_replace($fileLinksMap, $resolver($organizationCode, $fileLinksBatch));
        }
        return $fileLinksMap;
    }

    private function resolveUrl(array $linksByOrg, string $organizationCode, ?string $fileKey): ?string
    {
        if ($fileKey === null || $fileKey === '') {
            return null;
        }

        $fileLink = $linksByOrg[$organizationCode][$fileKey] ?? null;
        return $fileLink instanceof FileLink ? $fileLink->getUrl() : null;
    }

    private function resolveUrls(array $linksByOrg, string $organizationCode, array $fileKeys): array
    {
        $urls = [];
        foreach ($fileKeys as $fileKey) {
            $url = $this->resolveUrl($linksByOrg, $organizationCode, $fileKey);
            if ($url !== null) {
                $urls[] = $url;
            }
        }
        return $urls;
    }
}
