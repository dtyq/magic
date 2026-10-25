const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const clientPath = path.resolve(__dirname, '../../../static/http_client/js/client.js');
const clientSource = fs.readFileSync(clientPath, 'utf8');

/** 从调试面板源码中提取一个具名函数，确保测试执行的就是生产逻辑。 */
function extractFunction(name) {
    const start = clientSource.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `找不到函数 ${name}`);
    const bodyStart = clientSource.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < clientSource.length; index += 1) {
        if (clientSource[index] === '{') depth += 1;
        if (clientSource[index] === '}') depth -= 1;
        if (depth === 0) return clientSource.slice(start, index + 1);
    }
    throw new Error(`函数 ${name} 结构不完整`);
}

/** 加载 Canvas 预览纯函数，不执行调试面板的 DOM 初始化代码。 */
function loadContract() {
    const names = [
        'isApiCanvasUserDetail',
        'selectApiCanvasContentDetail',
        'getApiCanvasHeavyFields',
        'pickApiCanvasHeavyFields',
        'hydrateApiCanvasElementDetails',
        'selectCanvasPreviewContent',
        'formatCanvasGenerationDateTime',
        'formatCanvasGenerationDuration',
    ];
    const context = {};
    vm.runInNewContext(
        `${names.map(extractFunction).join('\n')}\nthis.contract = { ${names.join(', ')} };`,
        context,
    );
    return context.contract;
}

test('调试面板默认选择 active Content，main 只作为标记', () => {
    const { selectCanvasPreviewContent } = loadContract();
    const element = {
        activeContentId: 'content-active',
        mainContentId: 'content-main',
        contents: [
            { contentId: 'content-first' },
            { contentId: 'content-main' },
            { contentId: 'content-active' },
        ],
    };

    assert.equal(selectCanvasPreviewContent(element).contentId, 'content-active');
    assert.equal(selectCanvasPreviewContent(element, 'content-main').contentId, 'content-main');
    assert.equal(selectCanvasPreviewContent({ contents: element.contents }).contentId, 'content-first');
});

test('调试面板只按前端白名单回填 Sidecar 字段', () => {
    const { hydrateApiCanvasElementDetails } = loadContract();
    const config = {
        canvas: {
            elements: [{
                id: 'video-1',
                type: 'video',
                contents: [{ contentId: 'content-1', videoGenerationResultMeta: { billing: { points: 1 } } }],
            }],
        },
    };
    const agentDoc = {
        elements: {
            'video-1': {
                generateVideoRequest: { prompt: 'legacy prompt' },
                contentDetails: {
                    'content-1': {
                        generateVideoRequest: { prompt: 'agent prompt' },
                        videoGenerationResultMeta: { billing: { points: 99 } },
                    },
                },
            },
        },
    };
    const userDoc = {
        elements: {
            'video-1': {
                source: 'user',
                contentDetails: {
                    'content-1': { generateVideoRequest: { prompt: 'user prompt' } },
                },
            },
        },
    };

    hydrateApiCanvasElementDetails(config, agentDoc, userDoc);

    const content = config.canvas.elements[0].contents[0];
    assert.equal(content.generateVideoRequest.prompt, 'user prompt');
    assert.deepEqual(content.videoGenerationResultMeta, { billing: { points: 1 } });
});

test('调试面板时间和耗时文本适合直接展示', () => {
    const { formatCanvasGenerationDateTime, formatCanvasGenerationDuration } = loadContract();

    assert.match(formatCanvasGenerationDateTime('2026-09-14T10:00:00+08:00'), / UTC[+-]\d{2}:\d{2}$/);
    assert.equal(formatCanvasGenerationDuration(90061), '1天1小时1分1秒');
});
