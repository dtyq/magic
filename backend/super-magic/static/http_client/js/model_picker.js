(function () {
    const TYPE_CONFIGS = [
        {
            key: 'text',
            label: '文本模型',
            badge: '文本',
            storageKey: 'availableModels',
            selectId: 'modelIdSelect',
            inputId: 'modelIdInput',
            searchId: 'unifiedModelSearchText',
            listId: 'unifiedModelListText',
            selectedId: 'unifiedModelSelectedText',
            defaultLabel: '默认文本模型',
        },
        {
            key: 'image',
            label: '图片模型',
            badge: '图片',
            storageKey: 'availableImageModels',
            selectId: 'imageModelSelect',
            searchId: 'unifiedModelSearchImage',
            listId: 'unifiedModelListImage',
            selectedId: 'unifiedModelSelectedImage',
            defaultLabel: '不指定图片模型',
        },
        {
            key: 'video',
            label: '视频模型',
            badge: '视频',
            storageKey: 'availableVideoModels',
            selectId: 'videoModelSelect',
            searchId: 'unifiedModelSearchVideo',
            listId: 'unifiedModelListVideo',
            selectedId: 'unifiedModelSelectedVideo',
            defaultLabel: '不指定视频模型',
        },
    ];

    let elements = null;
    let initialized = false;
    let previewKey = '';

    function readModelList(storageKey) {
        try {
            const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            return [];
        }
    }

    function getModelAttributes(model) {
        return model?.info?.attributes || {};
    }

    function getModelOptions(model) {
        return model?.info?.options || {};
    }

    function getModelLabel(model) {
        const attributes = getModelAttributes(model);
        return String(attributes.label || model?.name || model?.id || '').trim();
    }

    function getResolvedModelId(model) {
        return getModelAttributes(model).resolved_model_id || model?.id || '';
    }

    function getProvider(model) {
        const attributes = getModelAttributes(model);
        return attributes.provider_source || attributes.provider || model?.provider || '';
    }

    function filterTextModels(models) {
        return models
            .filter((model) => {
                const options = getModelOptions(model);
                return options.chat === true && options.function_call === true;
            })
            .sort((a, b) => {
                const aDynamic = a.id !== getResolvedModelId(a) ? 1 : 0;
                const bDynamic = b.id !== getResolvedModelId(b) ? 1 : 0;
                return aDynamic - bDynamic;
            });
    }

    function getModelsForType(config) {
        const models = readModelList(config.storageKey);
        return config.key === 'text' ? filterTextModels(models) : models;
    }

    function createEntry(config, model = null) {
        return {
            key: `${config.key}:${model?.id || 'default'}`,
            type: config.key,
            typeLabel: config.label,
            badge: config.badge,
            id: model?.id || '',
            label: model ? getModelLabel(model) : config.defaultLabel,
            isDefault: !model,
            model,
        };
    }

    function getEntries(config) {
        return [createEntry(config), ...getModelsForType(config).map((model) => createEntry(config, model))];
    }

    function getTypeConfig(type) {
        return TYPE_CONFIGS.find((config) => config.key === type);
    }

    function getSelectedId(config) {
        const select = document.getElementById(config.selectId);
        if (config.key === 'text' && select?.style.display === 'none') {
            return document.getElementById(config.inputId)?.value.trim() || '';
        }
        return select?.value.trim() || '';
    }

    function findEntry(type, id) {
        const config = getTypeConfig(type);
        return config ? getEntries(config).find((entry) => entry.id === id) || null : null;
    }

    function findEntryByKey(key) {
        const type = key.split(':', 1)[0];
        return getTypeConfig(type) ? getEntries(getTypeConfig(type)).find((entry) => entry.key === key) || null : null;
    }

    function isEntrySelected(entry) {
        const config = getTypeConfig(entry.type);
        return config ? getSelectedId(config) === entry.id : false;
    }

    function getSelectedEntry(config) {
        const id = getSelectedId(config);
        return findEntry(config.key, id) || createEntry(config, id ? { id } : null);
    }

    function getEntrySearchText(entry) {
        return [entry.label, entry.id, getResolvedModelId(entry.model), getProvider(entry.model)]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    }

    function formatCompactNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) return '';
        if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
        if (number >= 1_000) return `${Math.round(number / 1_000)}K`;
        return String(Math.round(number));
    }

    function updateSelectionLabels() {
        const summaryParts = [];
        TYPE_CONFIGS.forEach((config) => {
            const selected = getSelectedEntry(config);
            const fallback = config.key === 'text' ? '默认' : '无';
            const label = selected.id ? selected.label : fallback;
            elements.columns[config.key].selected.textContent = selected.label;
            elements.columns[config.key].selected.title = selected.label;
            summaryParts.push(`${config.badge} ${label}`);
        });
        elements.summary.textContent = summaryParts.join(' · ');
        elements.summary.title = summaryParts.join('；');
    }

    function setPanelOpen(isOpen) {
        if (!elements) return;
        elements.panel.style.display = isOpen ? 'block' : 'none';
        elements.trigger.setAttribute('aria-expanded', String(isOpen));
        if (!isOpen) return;

        TYPE_CONFIGS.forEach((config) => {
            elements.columns[config.key].search.value = '';
        });
        renderAll();
        positionPanel();
        requestAnimationFrame(() => elements.columns.text.search.focus({ preventScroll: true }));
    }

    function close() {
        setPanelOpen(false);
    }

    function positionPanel() {
        if (!elements || elements.panel.style.display === 'none') return;
        const rect = elements.trigger.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const width = Math.min(920, viewportWidth - 24);
        const height = Math.min(560, viewportHeight - 32);
        const left = Math.min(Math.max(12, rect.left), viewportWidth - width - 12);
        const belowSpace = viewportHeight - rect.bottom - 8;
        const openAbove = belowSpace < height && rect.top > belowSpace;
        const top = openAbove
            ? Math.max(12, rect.top - height - 8)
            : Math.min(rect.bottom + 8, viewportHeight - height - 12);

        elements.panel.style.width = `${width}px`;
        elements.panel.style.height = `${height}px`;
        elements.panel.style.left = `${left}px`;
        elements.panel.style.top = `${top}px`;
    }

    function syncSelection(entry) {
        const config = getTypeConfig(entry.type);
        const select = config ? document.getElementById(config.selectId) : null;
        if (!config || !select) return;

        if (config.key === 'text') {
            const input = document.getElementById(config.inputId);
            const hasOption = Array.from(select.options).some((option) => option.value === entry.id);
            if (!entry.id || hasOption) {
                select.value = entry.id;
                select.style.display = '';
                if (input) {
                    input.value = '';
                    input.style.display = 'none';
                }
                select.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (input) {
                select.style.display = 'none';
                input.style.display = '';
                input.value = entry.id;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            select.value = entry.id;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function selectEntry(entry) {
        syncSelection(entry);
        previewKey = entry.key;
        updateSelectionLabels();
        renderColumn(entry.type);
        renderPreview(entry);
        updatePreviewingItems();
    }

    function createModelItem(entry) {
        const selected = isEntrySelected(entry);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'unified-model-item';
        item.dataset.modelKey = entry.key;
        item.classList.toggle('is-selected', selected);
        item.classList.toggle('is-previewing', entry.key === previewKey);
        item.setAttribute('aria-pressed', String(selected));

        const content = document.createElement('span');
        content.className = 'unified-model-item-content';
        const title = document.createElement('span');
        title.className = 'unified-model-item-title';
        title.textContent = entry.label;
        const id = document.createElement('span');
        id.className = 'unified-model-item-id';
        id.textContent = entry.isDefault ? '使用当前系统配置' : entry.id;
        content.append(title, id);

        const state = document.createElement('span');
        state.className = 'unified-model-item-state';
        state.setAttribute('aria-hidden', 'true');
        state.textContent = '✓';
        item.append(content, state);

        const preview = () => {
            previewKey = entry.key;
            renderPreview(entry);
            updatePreviewingItems();
        };
        item.addEventListener('mouseenter', preview);
        item.addEventListener('focus', preview);
        item.addEventListener('click', () => selectEntry(entry));
        return item;
    }

    function updatePreviewingItems() {
        elements.columnsContainer.querySelectorAll('.unified-model-item').forEach((item) => {
            item.classList.toggle('is-previewing', item.dataset.modelKey === previewKey);
        });
    }

    function renderColumn(type) {
        const config = getTypeConfig(type);
        const column = elements.columns[type];
        if (!config || !column) return;

        const keyword = column.search.value.trim().toLowerCase();
        const entries = getEntries(config);
        const visibleEntries = entries.filter((entry) => entry.isDefault || !keyword || getEntrySearchText(entry).includes(keyword));
        const matchedModels = visibleEntries.filter((entry) => !entry.isDefault);
        column.list.innerHTML = '';

        const count = document.createElement('div');
        count.className = 'unified-model-list-count';
        count.textContent = keyword ? `${matchedModels.length} 个匹配` : `${matchedModels.length} 个可用`;
        column.list.appendChild(count);
        visibleEntries.forEach((entry) => column.list.appendChild(createModelItem(entry)));

        if (keyword && matchedModels.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'unified-model-column-empty';
            empty.textContent = '没有匹配的模型';
            column.list.appendChild(empty);
        }
    }

    function renderAll() {
        updateSelectionLabels();
        TYPE_CONFIGS.forEach((config) => renderColumn(config.key));

        const previewEntry = findEntryByKey(previewKey)
            || TYPE_CONFIGS.map(getSelectedEntry).find((entry) => !entry.isDefault)
            || getSelectedEntry(TYPE_CONFIGS[0]);
        previewKey = previewEntry.key;
        renderPreview(previewEntry);
        updatePreviewingItems();
    }

    function appendPreviewRow(list, label, value) {
        if (!value || (Array.isArray(value) && value.length === 0)) return;
        const term = document.createElement('dt');
        term.textContent = label;
        const detail = document.createElement('dd');
        if (Array.isArray(value)) {
            detail.className = 'unified-model-preview-value-list';
            detail.title = value.join('、');
            value.forEach((item) => appendCapability(detail, item));
        } else {
            detail.textContent = value;
            detail.title = value;
        }
        list.append(term, detail);
    }

    function appendCapability(container, label) {
        if (!label) return;
        const tag = document.createElement('span');
        tag.className = 'unified-model-preview-capability';
        tag.textContent = label;
        container.appendChild(tag);
    }

    function formatPreviewValue(value, depth = 0) {
        if (value === null || value === undefined || value === '') return '';
        if (Array.isArray(value)) {
            return value.map((item) => formatPreviewValue(item, depth + 1)).filter(Boolean).join('、');
        }
        if (typeof value !== 'object') return String(value);

        const label = value.label || value.name || value.value || '';
        if (label) {
            const details = [value.value, value.resolution, value.scale]
                .filter((item, index, items) => item && item !== label && items.indexOf(item) === index);
            return [label, ...details].join(' / ');
        }
        if (depth >= 2) return '';

        return Object.entries(value)
            .slice(0, 6)
            .map(([key, item]) => {
                const formatted = formatPreviewValue(item, depth + 1);
                return formatted ? `${key}: ${formatted}` : '';
            })
            .filter(Boolean)
            .join('；');
    }

    function formatSizeOptions(sizes) {
        return Array.isArray(sizes) ? sizes.map((size) => formatPreviewValue(size)).filter(Boolean) : [];
    }

    function renderPreview(entry) {
        elements.preview.innerHTML = '';
        if (!entry) {
            const empty = document.createElement('div');
            empty.className = 'unified-model-preview-empty';
            empty.textContent = '没有可预览的模型';
            elements.preview.appendChild(empty);
            return;
        }

        const main = document.createElement('div');
        main.className = 'unified-model-preview-main';
        const type = document.createElement('span');
        type.className = 'unified-model-preview-type';
        type.textContent = entry.typeLabel;
        const title = document.createElement('h3');
        title.textContent = entry.label;
        title.title = entry.label;
        const id = document.createElement('div');
        id.className = 'unified-model-preview-id';
        id.textContent = entry.isDefault ? '由服务端根据当前配置选择' : entry.id;
        id.title = id.textContent;
        main.append(type, title, id);
        elements.preview.appendChild(main);
        if (entry.isDefault) return;

        const model = entry.model;
        const options = getModelOptions(model);
        const info = model?.info || {};
        const details = document.createElement('dl');
        details.className = 'unified-model-preview-grid unified-model-preview-meta';
        appendPreviewRow(details, '服务商', getProvider(model));
        const resolvedId = getResolvedModelId(model);
        if (resolvedId && resolvedId !== entry.id) appendPreviewRow(details, '实际模型', resolvedId);
        appendPreviewRow(details, '上下文', formatCompactNumber(options.max_tokens));
        appendPreviewRow(details, '最大输出', formatCompactNumber(options.max_output_tokens));
        const sizes = info.image_size_config?.sizes;
        appendPreviewRow(details, '图片尺寸', formatSizeOptions(sizes));
        appendPreviewRow(details, '视频配置', formatPreviewValue(info.video_generation_config));
        elements.preview.appendChild(details);

        const capabilities = document.createElement('div');
        capabilities.className = 'unified-model-preview-capabilities';
        if (options.chat === true) appendCapability(capabilities, '对话');
        if (options.function_call === true) appendCapability(capabilities, '工具调用');
        if (options.multi_modal === true) appendCapability(capabilities, '多模态');
        if (Array.isArray(sizes) && sizes.length) appendCapability(capabilities, `${sizes.length} 种图片尺寸`);
        if (info.video_generation_config) appendCapability(capabilities, '视频生成');
        if (capabilities.childElementCount) elements.preview.appendChild(capabilities);
    }

    function refresh() {
        if (!elements) return;
        updateSelectionLabels();
        if (elements.panel.style.display !== 'none') {
            renderAll();
            positionPanel();
        }
    }

    function setVisible(visible) {
        if (!elements?.group) return;
        elements.group.style.display = visible ? '' : 'none';
        if (!visible) close();
    }

    function init() {
        if (initialized) return;
        const columns = Object.fromEntries(TYPE_CONFIGS.map((config) => [config.key, {
            search: document.getElementById(config.searchId),
            list: document.getElementById(config.listId),
            selected: document.getElementById(config.selectedId),
        }]));
        elements = {
            group: document.getElementById('unifiedModelGroup'),
            trigger: document.getElementById('unifiedModelTrigger'),
            summary: document.getElementById('unifiedModelSummary'),
            panel: document.getElementById('unifiedModelPanel'),
            close: document.getElementById('unifiedModelPanelClose'),
            columnsContainer: document.getElementById('unifiedModelColumns'),
            preview: document.getElementById('unifiedModelPreview'),
            columns,
        };
        const required = [elements.group, elements.trigger, elements.summary, elements.panel, elements.close,
            elements.columnsContainer, elements.preview, ...Object.values(columns).flatMap(Object.values)];
        if (required.some((element) => !element)) return;
        initialized = true;

        elements.trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            setPanelOpen(elements.panel.style.display === 'none');
        });
        elements.close.addEventListener('click', close);
        TYPE_CONFIGS.forEach((config) => {
            columns[config.key].search.addEventListener('input', () => renderColumn(config.key));
        });
        elements.panel.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', close);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
        window.addEventListener('resize', positionPanel);
        window.addEventListener('scroll', positionPanel, true);
        refresh();
    }

    window.HttpClientModelPicker = { close, init, refresh, setVisible };
})();
