import { test } from '@playwright/experimental-ct-react';
import fs from 'fs';
import path from 'path';
import React from 'react';
import {
  Empty,
  MarkdownItRenderer,
  MarkedRenderer,
  ReactMarkdownRenderer,
  StreamdownRenderer,
  XMarkdownRenderer,
} from '../components/MarkdownRenderer';
import { BENCHMARK_CONFIG, RENDERERS, TEST_FILE_PATH, TEXT_CATEGORIES } from './benchmark.config';

// --- 类型定义和配置 ---
interface BenchmarkResult {
  name: string;
  textLength: number;
  textType: 'short' | 'medium' | 'long';
  duration: number;
  fcp: number; // 新增：FCP (First Contentful Paint)
  avgFPS: number;
  stdDevFPS: number;
  maxMemory: number;
  avgAvgMemory: number;
  memoryDelta: number;
  systemInfo: {
    userAgent: string;
    deviceMemory: number;
    hardwareConcurrency: number;
  };
  timeline: {
    fps: number[];
    memory: number[];
    timestamps: number[];
  };
}

interface RunResult {
  duration: number;
  fcp: number;
  avgFPS: number;
  minFPS: number;
  maxFPS: number;
  maxMemory: number;
  avgMemory: number;
  totalFrames: number;
  fpsSamples: number[];
  memorySamples: number[];
  timestamps: number[];
}

const fullText = fs.readFileSync(path.resolve(__dirname, TEST_FILE_PATH), 'utf-8');
const { CHUNK_SIZE, UPDATE_INTERVAL, RUN_COUNT, TEST_TEXT_LENGTHS } = BENCHMARK_CONFIG;

// 根据文本长度生成测试文本
function generateTextByLength(length: number): string {
  if (length <= fullText.length) {
    return fullText.substring(0, length);
  }

  // 如果需要的文本长度超过现有文本，则重复内容
  let result = '';
  while (result.length < length) {
    result += fullText;
  }
  return result.substring(0, length);
}

// 获取不同长度的测试文本
const testTexts = {
  short: generateTextByLength(TEST_TEXT_LENGTHS.short),
  medium: generateTextByLength(TEST_TEXT_LENGTHS.medium),
  long: generateTextByLength(TEST_TEXT_LENGTHS.long),
};

const getRenderer = (name: string, md = '') => {
  switch (name) {
    case 'marked': {
      return <MarkedRenderer md={md} />;
    }
    case 'markdown-it': {
      return <MarkdownItRenderer md={md} />;
    }
    case 'react-markdown': {
      return <ReactMarkdownRenderer md={md} />;
    }
    case 'x-markdown': {
      return <XMarkdownRenderer md={md} />;
    }
    case 'streamdown': {
      return <StreamdownRenderer md={md} />;
    }
    default: {
      return <Empty />;
    }
  }
};

interface PerformanceWindow extends Window {
  fpsSamples: number[];
  memorySamples: number[];
  timestamps: number[];
  startTime: number;
  lastFrameTime: number;
  initialMemory: number;
  fcpTime: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

/**
 * 在浏览器环境中注入性能跟踪脚本
 */
async function injectPerformanceTracker(page: any) {
  await page.evaluate(() => {
    const perfWindow = window as unknown as PerformanceWindow;
    const perf = performance as ExtendedPerformance;

    perfWindow.fpsSamples = [];
    perfWindow.memorySamples = [];
    perfWindow.timestamps = [];
    perfWindow.startTime = performance.now();
    perfWindow.lastFrameTime = performance.now();
    perfWindow.initialMemory = perf.memory?.usedJSHeapSize || 0;
    perfWindow.fcpTime = 0;

    const trackFPS = () => {
      const now = performance.now();
      const frameTime = now - perfWindow.lastFrameTime;
      if (frameTime > 0) {
        const fps = 1000 / frameTime;
        perfWindow.fpsSamples.push(fps);
        perfWindow.timestamps.push(now - perfWindow.startTime);

        if (perf.memory) {
          perfWindow.memorySamples.push(perf.memory.usedJSHeapSize);
        }
      }
      perfWindow.lastFrameTime = now;
      requestAnimationFrame(trackFPS);
    };

    // FCP 测量逻辑
    const observer = new MutationObserver(() => {
      const containers = document.querySelectorAll('.markdown-container');
      const hasContent = Array.from(containers).some(
        (container) =>
          container.children.length > 0 ||
          (container.textContent && container.textContent.trim().length > 0),
      );

      if (perfWindow.fcpTime === 0 && hasContent) {
        perfWindow.fcpTime = performance.now();
        observer.disconnect();
      }
    });

    // 立即开始观察，确保能捕获到首次内容渲染
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // 设置超时保护，防止FCP永远不触发
    setTimeout(() => {
      if (perfWindow.fcpTime === 0) {
        perfWindow.fcpTime = performance.now();
        observer.disconnect();
      }
    }, 1000);

    requestAnimationFrame(trackFPS);
  });
}

/**
 * 单次运行的测量逻辑
 */
async function measureSingleRun({
  page,
  name,
  browserName,
  component,
  testText,
  textType,
}: {
  name: string;
  page: any;
  component: any;
  browserName: string;
  testText: string;
  textType: 'short' | 'medium' | 'long';
}): Promise<RunResult> {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    if ('caches' in window) {
      caches.keys().then((keys) =>
        keys.forEach((key) => {
          caches.delete(key);
        }),
      );
    }
    if ('gc' in window) {
      (window as any).gc();
    }

    // 确保 performance.memory 可用
    if (!('memory' in performance)) {
      (performance as any).memory = {
        usedJSHeapSize: 0,
      };
    }
  });

  await page.context().tracing.start({
    screenshots: false, // 禁用截图以减少开销
    snapshots: false, // 禁用快照以减少开销
    title: `Markdown_Stream_Perf_${browserName}_${name}_${textType}`,
  });

  // 确保浏览器有performance.memory API
  await page.addInitScript(() => {
    if (!('memory' in performance)) {
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 0,
          totalJSHeapSize: 0,
          jsHeapSizeLimit: 0,
        },
        writable: true,
      });
    }
  });

  await injectPerformanceTracker(page);

  // 优化：等待第一次渲染完成，确保初始的 FPS 采样已启动
  await page.waitForTimeout(500);

  const startTime = await page.evaluate(() => (window as any).startTime);

  // 3. 流式渲染过程
  let currentText = '';
  for (let i = 0; i < testText.length; i += CHUNK_SIZE) {
    currentText = testText.substring(0, i + CHUNK_SIZE);

    // 关键优化：使用 setProps/update 触发更新
    await component.update(getRenderer(name, currentText));

    // 模拟网络延迟/流速
    await page.waitForTimeout(UPDATE_INTERVAL);
  }

  // 4. 等待内容完全稳定（例如，代码高亮等异步任务完成）
  // 使用更健壮的方式来等待内容渲染完成
  try {
    // 等待markdown容器出现
    await page.locator('.markdown-container').waitFor({ state: 'attached', timeout: 5000 });

    // 等待内容非空
    await page.waitForFunction(
      () => {
        const containers = document.querySelectorAll('.markdown-container');
        if (containers.length === 0) return false;

        // 检查任意一个容器是否有内容
        return Array.from(containers).some(
          (container) =>
            container.children.length > 0 ||
            (container.textContent && container.textContent.trim().length > 0),
        );
      },
      { timeout: 10000 },
    );

    // 额外等待一小段时间确保异步渲染完成
    await page.waitForTimeout(500);
  } catch (error) {
    console.warn(`Warning: Content stabilization wait failed for ${name}:`, error);
    // 打印当前页面状态用于调试
    const debugInfo = await page.evaluate(() => ({
      bodyContent: document.body?.innerHTML || 'empty',
      bodyText: document.body?.textContent?.trim() || 'empty',
      hasChildren: document.body?.children.length || 0,
      containers: document.querySelectorAll('.markdown-container').length,
      url: window.location.href,
    }));
    console.warn(`Debug info for ${name}:`, debugInfo);
    // 即使等待失败也继续，避免测试完全中断
  }

  const endTime = await page.evaluate(() => performance.now());
  const totalDuration = endTime - startTime;

  // 5. 停止跟踪并收集指标
  const finalMetrics = await page.evaluate((duration: number) => {
    const perfWindow = window as unknown as PerformanceWindow;
    const validFpsSamples = perfWindow.fpsSamples.filter((fps: number) => fps > 1 && fps < 120);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    return {
      duration,
      fcp: Math.max(0, perfWindow.fcpTime - perfWindow.startTime),
      avgFPS: validFpsSamples.length > 0 ? sum(validFpsSamples) / validFpsSamples.length : 0,
      minFPS: validFpsSamples.length > 0 ? Math.min(...validFpsSamples) : 0,
      maxFPS: validFpsSamples.length > 0 ? Math.max(...validFpsSamples) : 0,
      maxMemory: perfWindow.memorySamples.length > 0 ? Math.max(...perfWindow.memorySamples) : 0,
      avgMemory:
        perfWindow.memorySamples.length > 0
          ? sum(perfWindow.memorySamples) / perfWindow.memorySamples.length
          : 0,
      totalFrames: perfWindow.fpsSamples.length || 0,
      fpsSamples: validFpsSamples,
      memorySamples: perfWindow.memorySamples,
      timestamps: perfWindow.timestamps,
    };
  }, totalDuration);

  await page.context().tracing.stop({
    path: `test-results/trace-${name}-${Date.now()}.zip`,
  });

  return finalMetrics as RunResult;
}

async function measure({
  page,
  name,
  browserName,
  mount,
  textType,
}: {
  name: string;
  page: any;
  mount: any;
  browserName: string;
  textType: 'short' | 'medium' | 'long';
}): Promise<BenchmarkResult> {
  const testText = testTexts[textType];
  const textLength = testText.length;

  console.log(
    `\n📊 ${browserName} · ${name} · ${TEXT_CATEGORIES[textType].name} · ${RUN_COUNT} 轮测试`,
  );

  const component = await mount(getRenderer(name));
  const runs: RunResult[] = [];
  for (let i = 0; i < RUN_COUNT; i++) {
    console.log(`  Iteration ${i + 1}/${RUN_COUNT}`);
    const result = await measureSingleRun({
      name,
      page,
      browserName,
      component,
      testText,
      textType,
    });
    runs.push(result);

    await page.evaluate(() => {
      if ('gc' in window) (window as any).gc();
    });
    await page.waitForTimeout(1000);
  }

  // 计算聚合统计值
  const avg = (key: keyof RunResult) =>
    runs.reduce((sum, r) => sum + (r[key] as number), 0) / runs.length;

  const avgDuration = avg('duration');
  const avgFCP = avg('fcp');
  const avgFPS = avg('avgFPS');
  const avgMaxMemory = avg('maxMemory');
  const avgAvgMemory = avg('avgMemory');

  // 标准差计算 - 添加保护避免除以0
  const fpsValues = runs.map((r) => r.avgFPS).filter((fps) => fps > 0);
  const meanFPS = avgFPS;
  const stdDevFPS =
    fpsValues.length > 0
      ? Math.sqrt(fpsValues.reduce((sum, fps) => sum + (fps - meanFPS) ** 2, 0) / fpsValues.length)
      : 0;

  // 收集系统信息
  const systemInfo = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    deviceMemory: (navigator as any).deviceMemory || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
  }));

  // 内存增量计算 (使用第一次运行的初始内存)
  const initialMemory = runs[0].memorySamples[0] || 0;
  const memoryDelta = Math.max(0, avgMaxMemory - initialMemory);

  return {
    name,
    textLength,
    textType,
    duration: avgDuration,
    fcp: avgFCP,
    avgFPS,
    stdDevFPS,
    maxMemory: avgMaxMemory,
    avgAvgMemory,
    memoryDelta,
    systemInfo,
    timeline: {
      fps: runs[0].fpsSamples,
      memory: runs[0].memorySamples,
      timestamps: runs[0].timestamps,
    },
  };
}

test.describe('Streaming Markdown Benchmark', async () => {
  const results: Array<BenchmarkResult> = [];

  // 为每个文本长度类别创建测试组
  for (const textType of ['short', 'medium', 'long'] as const) {
    test.describe(`${TEXT_CATEGORIES[textType].name}测试`, () => {
      for (const rendererName of RENDERERS) {
        test(`${rendererName}-${textType}`, async ({ page, mount, browserName }) => {
          try {
            test.setTimeout(BENCHMARK_CONFIG.TIMEOUT * RUN_COUNT);
            const result = await measure({
              name: rendererName,
              page,
              mount,
              browserName,
              textType,
            });
            results.push(result);
          } catch (error) {
            console.error(`Error in ${rendererName}-${textType}:`, error);
            results.push({
              name: rendererName,
              textLength: testTexts[textType].length,
              textType,
              duration: 0,
              fcp: 0,
              avgFPS: 0,
              stdDevFPS: 0,
              maxMemory: 0,
              avgAvgMemory: 0,
              memoryDelta: 0,
              systemInfo: { userAgent: '', deviceMemory: 0, hardwareConcurrency: 0 },
              timeline: { fps: [], memory: [], timestamps: [] },
            });
          }
        });
      }
    });
  }

  test.afterAll(async () => {
    if (results.length === 0) return;

    console.log('\n\n========================================================================');
    console.log('✅ 流式 Markdown 渲染 Benchmark 结果 (按文本长度分类)');
    console.log('========================================================================');

    // 按文本类型分组显示结果
    const groupedResults = {
      short: results.filter((r) => r.textType === 'short'),
      medium: results.filter((r) => r.textType === 'medium'),
      long: results.filter((r) => r.textType === 'long'),
    };

    for (const [type, typeResults] of Object.entries(groupedResults)) {
      if (typeResults.length === 0) continue;

      console.log(
        `\n📊 ${TEXT_CATEGORIES[type as keyof typeof TEXT_CATEGORIES].name} (${typeResults[0].textLength} 字符)`,
      );
      console.log('='.repeat(50));

      console.table(
        typeResults.map((r) => ({
          Renderer: r.name,
          'Duration(s) ↓': (r.duration / 1000).toFixed(2), // 总渲染时间，越低越好
          'FCP(s) ↓': (r.fcp / 1000).toFixed(2), // 首次内容绘制，越低越好
          'Avg FPS ↑': r.avgFPS.toFixed(1), // 平均帧率，越高越好
          'StdDev FPS ↓': r.stdDevFPS.toFixed(2), // 帧率标准差，越低越流畅
          'Memory Delta(MB) ↓': (r.memoryDelta / 1024 / 1024).toFixed(2), // 内存增量，越低越好
          'Avg Memory(MB) ↓': (r.avgAvgMemory / 1024 / 1024).toFixed(2), // 平均内存
        })),
      );
    }

    // 显示跨文本长度的性能对比
    console.log('\n\n📈 跨文本长度性能对比');
    console.log('='.repeat(50));

    const comparisonData = [];
    for (const renderer of RENDERERS) {
      const rendererResults = results.filter((r) => r.name === renderer);
      if (rendererResults.length === 0) continue;

      const shortResult = rendererResults.find((r) => r.textType === 'short');
      const mediumResult = rendererResults.find((r) => r.textType === 'medium');
      const longResult = rendererResults.find((r) => r.textType === 'long');

      comparisonData.push({
        Renderer: renderer,
        '短文本(ms)': shortResult ? Math.round(shortResult.duration) : '-',
        '中文本(ms)': mediumResult ? Math.round(mediumResult.duration) : '-',
        '长文本(ms)': longResult ? Math.round(longResult.duration) : '-',
        性能衰减:
          longResult && shortResult
            ? `${((longResult.duration / shortResult.duration - 1) * 100).toFixed(1)}%`
            : '-',
      });
    }

    console.table(comparisonData);

    console.log('\nℹ️ 提示:');
    console.log(`   - 分块大小: ${CHUNK_SIZE} 字符`);
    console.log(`   - 模拟流速: ${UPDATE_INTERVAL} ms/块`);
    console.log(`   - 测试配置: ${RUN_COUNT} 次运行取平均值`);
    console.log('   - 性能分析: 关注 **FCP** (用户等待时间) 和 **StdDev FPS** (卡顿程度)。');

    // Write benchmark results to JSON file
    const resultsDir = path.join(process.cwd(), 'test-results');
    const resultsPath = path.join(resultsDir, 'benchmark-results.json');

    // Ensure results directory exists
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Write results to JSON file
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n📊 Benchmark results saved to: ${resultsPath}`);
  });
});
