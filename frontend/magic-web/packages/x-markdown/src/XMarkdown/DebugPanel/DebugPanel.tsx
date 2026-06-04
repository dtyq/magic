import React, { useCallback, useEffect, useRef, useState } from 'react';
import './DebugPanel.css';

interface PerformanceSnapshot {
  timestamp: number;
  fps: number;
  memory: number;
}

interface Position {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

const CONSTANTS = {
  FPS_THRESHOLD: { GOOD: 55, WARNING: 40 },
  COLORS: { GOOD: '#52c41a', WARNING: '#faad14', DANGER: '#ff4d4f' },
  CHART: { WIDTH: 750, HEIGHT: 400, PADDING: 80 },
} as const;

const getInitialPosition = (): Position => {
  if (typeof window === 'undefined') {
    return { x: 12, y: 12 };
  }
  return {
    x: window.innerWidth - 220,
    y: window.innerHeight / 2 - 100,
  };
};

const DebugPanel: React.FC = () => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [records, setRecords] = useState<PerformanceSnapshot[]>([]);
  const [position, setPosition] = useState<Position>(getInitialPosition());
  const [isMounted, setIsMounted] = useState(false);

  const recordingRef = useRef<PerformanceSnapshot[]>([]);
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  useEffect(() => {
    // 仅在客户端运行
    if (typeof window === 'undefined') return;

    // 仅在客户端初始化
    if (!isMounted) {
      setIsMounted(true);
      lastTimeRef.current = performance.now();
    }

    const update = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) frameTimesRef.current.shift();

      frameCountRef.current++;
      if (delta >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / delta);
        const currentMemory = getMemoryUsage();

        setFps(currentFps);
        setMemory(currentMemory);

        if (isRecording) {
          recordingRef.current.push({
            timestamp: Date.now(),
            fps: currentFps,
            memory: currentMemory,
          });
        }

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationRef.current = requestAnimationFrame(update);
    };

    animationRef.current = requestAnimationFrame(update);
    return () => {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, isMounted]);

  const getMemoryUsage = (): number => {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1024 / 1024) : 0;
  };

  const formatMemory = (mb: number): string => {
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  const getFpsColor = (value: number): string => {
    if (value >= CONSTANTS.FPS_THRESHOLD.GOOD) return CONSTANTS.COLORS.GOOD;
    if (value >= CONSTANTS.FPS_THRESHOLD.WARNING) return CONSTANTS.COLORS.WARNING;
    return CONSTANTS.COLORS.DANGER;
  };

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      setRecords([...recordingRef.current]);
      setShowModal(true);
    } else {
      recordingRef.current = [];
      setIsRecording(true);
    }
  }, [isRecording]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.x-markdown-debug-action')) return;

      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        initialX: position.x,
        initialY: position.y,
      };
    },
    [position],
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({ x: dragRef.current.initialX + dx, y: dragRef.current.initialY + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  useEffect(() => {
    // 仅在客户端运行
    if (typeof window === 'undefined') return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const PerformanceChart = () => {
    if (!records.length) return null;

    const { WIDTH, HEIGHT, PADDING } = CONSTANTS.CHART;
    const chartWidth = WIDTH - PADDING * 2;
    const chartHeight = HEIGHT - PADDING * 2;

    const startTime = records[0]?.timestamp ?? 0;
    const endTime = records[records.length - 1]?.timestamp ?? 0;
    const duration = endTime - startTime || 1;

    const maxFps = Math.max(...records.map((r) => r.fps), 60);
    const maxMemory = Math.max(...records.map((r) => r.memory), 0) * 1.1;

    const avgFps =
      records.length > 0 ? records.reduce((sum, r) => sum + r.fps, 0) / records.length : 0;
    const avgMemory =
      records.length > 0 ? records.reduce((sum, r) => sum + r.memory, 0) / records.length : 0;
    const minFps = records.length > 0 ? Math.min(...records.map((r) => r.fps)) : 0;
    const maxFpsValue = records.length > 0 ? Math.max(...records.map((r) => r.fps)) : 0;

    const createPoints = (key: 'fps' | 'memory', max: number) =>
      records
        .map((r) => {
          const x = PADDING + ((r.timestamp - startTime) / duration) * chartWidth;
          const y = PADDING + chartHeight - (r[key] / max) * chartHeight;
          return `${x},${y}`;
        })
        .join(' ');

    return (
      <div className="x-markdown-debug-modal-content">
        <div className="x-markdown-debug-stats-summary">
          <div className="x-markdown-debug-stat-item">
            <div className="x-markdown-debug-stat-label">Duration</div>
            <div className="x-markdown-debug-stat-value">{(duration / 1000).toFixed(2)}s</div>
          </div>
          <div className="x-markdown-debug-stat-item">
            <div className="x-markdown-debug-stat-label">FPS Avg</div>
            <div className="x-markdown-debug-stat-value" style={{ color: getFpsColor(avgFps) }}>
              {avgFps.toFixed(1)}
            </div>
          </div>
          <div className="x-markdown-debug-stat-item">
            <div className="x-markdown-debug-stat-label">FPS Range</div>
            <div className="x-markdown-debug-stat-value">
              {minFps} - {maxFpsValue}
            </div>
          </div>
          <div className="x-markdown-debug-stat-item">
            <div className="x-markdown-debug-stat-label">Memory Avg</div>
            <div className="x-markdown-debug-stat-value">{formatMemory(avgMemory)}</div>
          </div>
        </div>

        <svg
          width={WIDTH}
          height={HEIGHT}
          className="x-markdown-debug-chart-full"
          role="img"
          aria-label="Performance chart showing FPS and memory usage over time"
        >
          <title>Performance Chart</title>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1={PADDING}
                y1={PADDING + chartHeight * ratio}
                x2={WIDTH - PADDING}
                y2={PADDING + chartHeight * ratio}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
              <line
                x1={PADDING + chartWidth * ratio}
                y1={PADDING}
                x2={PADDING + chartWidth * ratio}
                y2={HEIGHT - PADDING}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            </g>
          ))}

          <polyline
            points={createPoints('fps', maxFps)}
            fill="none"
            stroke={CONSTANTS.COLORS.GOOD}
            strokeWidth="2"
            className="fps-line"
          />
          <polyline
            points={createPoints('memory', maxMemory)}
            fill="none"
            stroke="#1890ff"
            strokeWidth="2"
            className="memory-line"
          />

          <text
            x={PADDING - 10}
            y={PADDING}
            fill={CONSTANTS.COLORS.GOOD}
            fontSize="12"
            textAnchor="end"
          >
            {maxFps.toFixed(0)}
          </text>
          <text
            x={PADDING - 10}
            y={HEIGHT - PADDING}
            fill={CONSTANTS.COLORS.GOOD}
            fontSize="12"
            textAnchor="end"
          >
            0
          </text>
          <text
            x={PADDING - 10}
            y={PADDING - 15}
            fill={CONSTANTS.COLORS.GOOD}
            fontSize="14"
            fontWeight="bold"
            textAnchor="end"
          >
            FPS
          </text>

          <text
            x={WIDTH - PADDING + 10}
            y={PADDING + 20}
            fill="#1890ff"
            fontSize="12"
            textAnchor="start"
          >
            {formatMemory(maxMemory)}
          </text>
          <text
            x={WIDTH - PADDING + 10}
            y={HEIGHT - PADDING}
            fill="#1890ff"
            fontSize="12"
            textAnchor="start"
          >
            {formatMemory(0)}
          </text>
          <text
            x={WIDTH - PADDING + 10}
            y={PADDING + 5}
            fill="#1890ff"
            fontSize="14"
            fontWeight="bold"
            textAnchor="start"
          >
            Memory
          </text>

          <text
            x={PADDING}
            y={HEIGHT - PADDING + 20}
            fill="rgba(255,255,255,0.6)"
            fontSize="12"
            textAnchor="middle"
          >
            0s
          </text>
          <text
            x={WIDTH - PADDING}
            y={HEIGHT - PADDING + 20}
            fill="rgba(255,255,255,0.6)"
            fontSize="12"
            textAnchor="middle"
          >
            {(duration / 1000).toFixed(1)}s
          </text>
        </svg>

        <div className="x-markdown-debug-legend">
          <div className="x-markdown-debug-legend-item">
            <span
              className="x-markdown-debug-legend-color"
              style={{ backgroundColor: CONSTANTS.COLORS.GOOD }}
            />
            <span>FPS</span>
          </div>
          <div className="x-markdown-debug-legend-item">
            <span
              className="x-markdown-debug-legend-color"
              style={{ backgroundColor: '#1890ff' }}
            />
            <span>Memory</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="x-markdown-debug-panel"
        style={{
          left: position.x,
          top: position.y,
          cursor: dragRef.current.isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="x-markdown-debug-row">
          <span className="x-markdown-debug-label">FPS</span>
          <span className="x-markdown-debug-value" style={{ color: getFpsColor(fps) }}>
            {fps}
          </span>
        </div>
        <div className="x-markdown-debug-row">
          <span className="x-markdown-debug-label">Memory</span>
          <span className="x-markdown-debug-value">{formatMemory(memory)}</span>
        </div>
        <div className="x-markdown-debug-actions">
          <button
            type="button"
            className={`x-markdown-debug-action x-markdown-debug-record-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
          >
            {isRecording ? '⏹ Stop' : '⏺ Record'}
          </button>
          {records.length > 0 && !isRecording && (
            <button
              type="button"
              className="x-markdown-debug-action"
              onClick={() => setShowModal(true)}
            >
              📊 View
            </button>
          )}
        </div>
      </div>

      {showModal && records.length > 0 ? (
        <div className="x-markdown-debug-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="x-markdown-debug-modal" onClick={(e) => e.stopPropagation()}>
            <div className="x-markdown-debug-modal-header">
              <span style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                Performance Recording
              </span>
              <button
                type="button"
                className="x-markdown-debug-close-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <PerformanceChart />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default DebugPanel;
