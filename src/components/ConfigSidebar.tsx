import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Box,
  Cylinder,
  Sparkles,
} from 'lucide-react';
import {
  ArrangementConfig,
  BackgroundStyle,
  ColorTheme,
  ContainerSpec,
  ItemSpec,
  PackingMode,
  PackingSummary,
  QUICK_PRESETS,
  QuickPreset,
  StackingPattern,
  ViewerConfig,
} from '../types/packing';

interface FreeNumberInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  unit?: string;
  integerOnly?: boolean;
  className?: string;
  onValidChange: (val: number) => void;
  onErrorChange?: (error: string | null) => void;
}

/**
 * Allows completely free numeric typing (including empty string & intermediate digits)
 * without clamping the user's keystrokes, while reporting clear validation errors.
 */
const FreeNumberInput: React.FC<FreeNumberInputProps> = ({
  value,
  min,
  max,
  step = 1,
  disabled = false,
  label,
  unit = '',
  integerOnly = false,
  className = '',
  onValidChange,
  onErrorChange,
}) => {
  const [raw, setRaw] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync external value changes (e.g., preset click or swap button) when not actively typing the same value
  useEffect(() => {
    if (!isFocused) {
      setRaw(String(value));
      setError(null);
      onErrorChange?.(null);
    } else {
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed) && parsed === value) {
        // Already in sync
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isFocused]);

  const validateAndCommit = (nextRaw: string) => {
    setRaw(nextRaw);
    const trimmed = nextRaw.trim();

    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      const msg = `${label}: 값을 입력해주세요 (${min.toLocaleString()}~${max.toLocaleString()}${unit})`;
      setError(msg);
      onErrorChange?.(msg);
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      const msg = `${label}: 유효한 숫자를 입력해주세요`;
      setError(msg);
      onErrorChange?.(msg);
      return;
    }

    if (integerOnly && !Number.isInteger(parsed)) {
      const msg = `${label}: 정수로 입력해주세요`;
      setError(msg);
      onErrorChange?.(msg);
      return;
    }

    if (parsed < min) {
      const msg = `${label}: 최소 ${min.toLocaleString()}${unit} 이상 입력해주세요 (현재 ${parsed}${unit})`;
      setError(msg);
      onErrorChange?.(msg);
      return;
    }

    if (parsed > max) {
      const msg = `${label}: 최대 ${max.toLocaleString()}${unit} 이하로 입력해주세요 (현재 ${parsed.toLocaleString()}${unit})`;
      setError(msg);
      onErrorChange?.(msg);
      return;
    }

    // Valid! Clear error and update 3D state
    setError(null);
    onErrorChange?.(null);
    onValidChange(integerOnly ? Math.round(parsed) : parsed);
  };

  return (
    <input
      type="text"
      inputMode={step < 1 ? 'decimal' : 'numeric'}
      disabled={disabled}
      value={raw}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={(e) => validateAndCommit(e.target.value)}
      aria-invalid={Boolean(error)}
      className={`${className} transition-colors ${
        error
          ? 'border-red-500 bg-red-950/25 text-red-200 focus:border-red-400'
          : 'border-slate-800 bg-slate-950 text-white focus:border-blue-500'
      }`}
    />
  );
};

interface ConfigSidebarProps {
  mode: PackingMode;
  activePresetId: string;
  item: ItemSpec;
  container: ContainerSpec;
  arrangement: ArrangementConfig;
  viewer: ViewerConfig;
  summary: PackingSummary;
  onSelectPreset: (preset: QuickPreset) => void;
  onUpdateMode: (mode: PackingMode) => void;
  onUpdateItem: (patch: Partial<ItemSpec>) => void;
  onUpdateContainer: (patch: Partial<ContainerSpec>) => void;
  onUpdateArrangement: (patch: Partial<ArrangementConfig>) => void;
  onUpdateViewer: (patch: Partial<ViewerConfig>) => void;
  onAutoFillContainer: () => void;
  onOpenOptimizer: () => void;
}

export const ConfigSidebar: React.FC<ConfigSidebarProps> = ({
  mode,
  activePresetId,
  item,
  container,
  arrangement,
  viewer,
  summary,
  onSelectPreset,
  onUpdateMode,
  onUpdateItem,
  onUpdateContainer,
  onUpdateArrangement,
  onUpdateViewer,
  onAutoFillContainer,
  onOpenOptimizer,
}) => {
  const [activeTab, setActiveTab] = useState<'item' | 'arrangement' | 'container' | 'style'>('item');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const setFieldError = (key: string, msg: string | null) => {
    setFieldErrors((prev) => {
      if (prev[key] === msg) return prev;
      return { ...prev, [key]: msg };
    });
  };

  const itemDimensionErrors = [
    item.shape === 'box' ? fieldErrors.itemWidth : null,
    item.shape === 'box' ? fieldErrors.itemDepth : null,
    item.shape === 'cylinder' ? fieldErrors.itemDiameter : null,
    fieldErrors.itemHeight,
  ].filter(Boolean) as string[];

  const itemMetaErrors = [fieldErrors.itemWeight, fieldErrors.padding].filter(Boolean) as string[];

  const arrangementErrors = [
    fieldErrors.cols,
    fieldErrors.rows,
    fieldErrors.layers,
  ].filter(Boolean) as string[];

  const containerErrors = [
    fieldErrors.contWidth,
    fieldErrors.contDepth,
    fieldErrors.contHeight,
    fieldErrors.palletHeight,
    fieldErrors.palletWeight,
  ].filter(Boolean) as string[];

  return (
    <aside className="w-[400px] shrink-0 h-full bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
      {/* 1. Quick Preset Selector Strip */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">
            빠른 규격 및 첨부 이미지 프리셋
          </span>
          <button
            onClick={onOpenOptimizer}
            className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>자동 최적 추천</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 max-h-[136px] overflow-y-auto pr-1">
          {QUICK_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setFieldErrors({});
                  onSelectPreset(preset);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/60 text-white'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{preset.label}</div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Section Navigation Tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-800 bg-slate-900">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
          {(
            [
              { id: 'item', label: '1. 물품 규격' },
              { id: 'arrangement', label: '2. 배열·패턴' },
              { id: 'container', label: '3. 용기·팔레트' },
              { id: 'style', label: '4. 테마·외관' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: 물품(아이템) 형태 및 치수 */}
        {activeTab === 'item' && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                포장할 물품 형태 (Shape)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onUpdateItem({ shape: 'box' });
                    if (arrangement.pattern === 'hex') {
                      onUpdateArrangement({ pattern: 'block' });
                    }
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    item.shape === 'box'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  <span>직육면체 상자 (Box)</span>
                </button>

                <button
                  onClick={() => {
                    onUpdateItem({ shape: 'cylinder' });
                    if (arrangement.pattern === 'pinwheel' || arrangement.pattern === 'brick') {
                      onUpdateArrangement({ pattern: 'block' });
                    }
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    item.shape === 'cylinder'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cylinder className="w-4 h-4" />
                  <span>원통/캔 용기 (Cylinder)</span>
                </button>
              </div>
            </div>

            {/* Dimensions Input (Free Typing + Validation Error Banner) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  물품 상세 크기 (단위: mm)
                </span>
                {item.shape === 'box' && (
                  <button
                    onClick={() =>
                      onUpdateItem({
                        width: item.depth,
                        depth: item.width,
                      })
                    }
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>가로·세로 맞바꾸기</span>
                  </button>
                )}
              </div>

              {item.shape === 'box' ? (
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      가로 (장변 L)
                    </label>
                    <FreeNumberInput
                      label="가로(L)"
                      unit="mm"
                      min={10}
                      max={3000}
                      value={item.width}
                      onValidChange={(v) => onUpdateItem({ width: v })}
                      onErrorChange={(err) => setFieldError('itemWidth', err)}
                      className="w-full border rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      세로 (단변 W)
                    </label>
                    <FreeNumberInput
                      label="세로(W)"
                      unit="mm"
                      min={10}
                      max={3000}
                      value={item.depth}
                      onValidChange={(v) => onUpdateItem({ depth: v })}
                      onErrorChange={(err) => setFieldError('itemDepth', err)}
                      className="w-full border rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      높이 (H)
                    </label>
                    <FreeNumberInput
                      label="높이(H)"
                      unit="mm"
                      min={10}
                      max={3000}
                      value={item.height}
                      onValidChange={(v) => onUpdateItem({ height: v })}
                      onErrorChange={(err) => setFieldError('itemHeight', err)}
                      className="w-full border rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      원통 직경 (Ø, mm)
                    </label>
                    <FreeNumberInput
                      label="원통 직경(Ø)"
                      unit="mm"
                      min={10}
                      max={2000}
                      value={item.diameter}
                      onValidChange={(v) =>
                        onUpdateItem({ diameter: v, width: v, depth: v })
                      }
                      onErrorChange={(err) => setFieldError('itemDiameter', err)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      원통 높이 (H, mm)
                    </label>
                    <FreeNumberInput
                      label="원통 높이(H)"
                      unit="mm"
                      min={10}
                      max={3000}
                      value={item.height}
                      onValidChange={(v) => onUpdateItem({ height: v })}
                      onErrorChange={(err) => setFieldError('itemHeight', err)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Validation Error Display for Item Dimensions */}
              {itemDimensionErrors.length > 0 && (
                <div className="rounded-lg bg-red-950/40 border border-red-500/50 px-3 py-2 space-y-1">
                  {itemDimensionErrors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-red-300"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick item size chips */}
              <div className="pt-1">
                <span className="block text-[11px] text-slate-400 mb-1.5">
                  자주 쓰는 물품 치수 빠른 입력
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {item.shape === 'box' ? (
                    <>
                      <button
                        onClick={() => onUpdateItem({ width: 550, depth: 275, height: 185 })}
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        550×275×185 (이미지1)
                      </button>
                      <button
                        onClick={() => onUpdateItem({ width: 366, depth: 275, height: 210 })}
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        366×275×210 (T11 정합)
                      </button>
                      <button
                        onClick={() => onUpdateItem({ width: 340, depth: 250, height: 210 })}
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        340×250×210 (택배3호)
                      </button>
                      <button
                        onClick={() => onUpdateItem({ width: 400, depth: 300, height: 250 })}
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        400×300×250 (표준모듈)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          onUpdateItem({ diameter: 100, width: 100, depth: 100, height: 140 })
                        }
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        Ø100×140 (이미지2 캔)
                      </button>
                      <button
                        onClick={() =>
                          onUpdateItem({ diameter: 66, width: 66, depth: 66, height: 122 })
                        }
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        Ø66×122 (355ml 음료캔)
                      </button>
                      <button
                        onClick={() =>
                          onUpdateItem({ diameter: 85, width: 85, depth: 85, height: 180 })
                        }
                        className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md"
                      >
                        Ø85×180 (보틀 용기)
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Item Weight & Padding */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    개당 중량 (kg)
                  </label>
                  <FreeNumberInput
                    label="개당 중량"
                    unit="kg"
                    step={0.1}
                    min={0.01}
                    max={1000}
                    value={item.weight}
                    onValidChange={(v) => onUpdateItem({ weight: v })}
                    onErrorChange={(err) => setFieldError('itemWeight', err)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    물품 간 간격 (mm)
                  </label>
                  <FreeNumberInput
                    label="물품 간 간격"
                    unit="mm"
                    step={1}
                    min={0}
                    max={200}
                    value={container.padding}
                    onValidChange={(v) => onUpdateContainer({ padding: v })}
                    onErrorChange={(err) => setFieldError('padding', err)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              {itemMetaErrors.length > 0 && (
                <div className="rounded-lg bg-red-950/40 border border-red-500/50 px-3 py-2 space-y-1">
                  {itemMetaErrors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-red-300"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: 행 · 열 · 층 배열 및 적재 패턴 */}
        {activeTab === 'arrangement' && (
          <div className="space-y-5">
            {/* Stacking Pattern Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                적재 배열 패턴 (Stacking Pattern)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'block',
                      label: '격자 정렬 (Block)',
                      desc: '행 × 열 직각 배열',
                      disabled: false,
                    },
                    {
                      id: 'pinwheel',
                      label: '풍차형 (Pinwheel)',
                      desc: '4방향 엇갈림 (이미지1)',
                      disabled: item.shape === 'cylinder',
                    },
                    {
                      id: 'brick',
                      label: '벽돌식 (Brick)',
                      desc: '행간 지그재그 교차',
                      disabled: item.shape === 'cylinder',
                    },
                    {
                      id: 'hex',
                      label: '벌집 밀집 (Hex)',
                      desc: '원통 삼각 밀집 배열',
                      disabled: item.shape === 'box',
                    },
                  ] as const
                ).map((pat) => (
                  <button
                    key={pat.id}
                    disabled={pat.disabled}
                    onClick={() => onUpdateArrangement({ pattern: pat.id as StackingPattern })}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      pat.disabled
                        ? 'opacity-35 cursor-not-allowed bg-slate-950 border-slate-800'
                        : arrangement.pattern === pat.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{pat.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{pat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rows / Cols / Layers Steppers */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  행 · 열 · 층 수량 직접 지정
                </span>
                <button
                  onClick={onAutoFillContainer}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  규격 내 최대치 자동계산
                </button>
              </div>

              {arrangement.pattern === 'pinwheel' && item.shape === 'box' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        사분면당 병렬 박스 수
                      </div>
                      <div className="text-[11px] text-slate-400">
                        4개 사분면 × {arrangement.pinwheelPerQuad}개 = 층당{' '}
                        {arrangement.pinwheelPerQuad * 4}개
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onUpdateArrangement({
                            pinwheelPerQuad: Math.max(1, arrangement.pinwheelPerQuad - 1),
                          })
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-sm"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono text-sm font-bold text-white">
                        {arrangement.pinwheelPerQuad}
                      </span>
                      <button
                        onClick={() =>
                          onUpdateArrangement({
                            pinwheelPerQuad: Math.min(8, arrangement.pinwheelPerQuad + 1),
                          })
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Columns (열 - 가로 방향) */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      열 (Columns · 가로 개수)
                    </label>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() =>
                          onUpdateArrangement({ cols: Math.max(1, arrangement.cols - 1) })
                        }
                        className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-mono"
                      >
                        -
                      </button>
                      <FreeNumberInput
                        label="열(Columns)"
                        unit="열"
                        integerOnly
                        min={1}
                        max={25}
                        value={arrangement.cols}
                        onValidChange={(v) => onUpdateArrangement({ cols: v })}
                        onErrorChange={(err) => setFieldError('cols', err)}
                        className="w-14 text-center border rounded-md py-1 font-mono text-sm font-bold focus:outline-none"
                      />
                      <button
                        onClick={() =>
                          onUpdateArrangement({ cols: Math.min(25, arrangement.cols + 1) })
                        }
                        className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-mono"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Rows (행 - 세로 방향) */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      행 (Rows · 세로 개수)
                    </label>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() =>
                          onUpdateArrangement({ rows: Math.max(1, arrangement.rows - 1) })
                        }
                        className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-mono"
                      >
                        -
                      </button>
                      <FreeNumberInput
                        label="행(Rows)"
                        unit="행"
                        integerOnly
                        min={1}
                        max={25}
                        value={arrangement.rows}
                        onValidChange={(v) => onUpdateArrangement({ rows: v })}
                        onErrorChange={(err) => setFieldError('rows', err)}
                        className="w-14 text-center border rounded-md py-1 font-mono text-sm font-bold focus:outline-none"
                      />
                      <button
                        onClick={() =>
                          onUpdateArrangement({ rows: Math.min(25, arrangement.rows + 1) })
                        }
                        className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-mono"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Layers (층 - 적재 단수) */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">
                    적재 층수 (Layers · 단수)
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    적재물 높이: {summary.stackHeight} mm (총 {summary.totalHeight} mm)
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const nextL = Math.max(1, arrangement.layers - 1);
                      onUpdateArrangement({ layers: nextL });
                      onUpdateViewer({ visibleLayers: nextL });
                    }}
                    className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-mono"
                  >
                    -
                  </button>
                  <FreeNumberInput
                    label="적재 층수"
                    unit="단"
                    integerOnly
                    min={1}
                    max={30}
                    value={arrangement.layers}
                    onValidChange={(v) => {
                      onUpdateArrangement({ layers: v });
                      onUpdateViewer({ visibleLayers: v });
                    }}
                    onErrorChange={(err) => setFieldError('layers', err)}
                    className="w-14 text-center border rounded-md py-1 font-mono text-sm font-bold focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const nextL = Math.min(30, arrangement.layers + 1);
                      onUpdateArrangement({ layers: nextL });
                      onUpdateViewer({ visibleLayers: nextL });
                    }}
                    className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-mono"
                  >
                    +
                  </button>
                </div>
              </div>

              {arrangementErrors.length > 0 && (
                <div className="rounded-lg bg-red-950/40 border border-red-500/50 px-3 py-2 space-y-1">
                  {arrangementErrors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-red-300"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alternating Layer Toggle */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <div>
                  <div className="text-xs font-semibold text-white">
                    짝수층 90° 교차 회전 적재 (Interlocking)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    층마다 박스 방향을 엇갈리게 배치하여 무너짐 방지 (이미지1 방식)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={arrangement.alternateLayers}
                  onChange={(e) => onUpdateArrangement({ alternateLayers: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              {/* Trigger Top-3 Optimal Pattern Recommendations for User-Configured Container */}
              <button
                onClick={onOpenOptimizer}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-xs font-semibold text-blue-300 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>
                  설정 {mode === 'pallet' ? '팔레트' : '외박스'} 규격 맞춤 최적 패턴 3가지 추천 보기
                </span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: 용기(외박스) 및 팔레트 규격 */}
        {activeTab === 'container' && (
          <div className="space-y-5">
            {/* Mode Switch */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                포장 용기 유형
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateMode('pallet')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === 'pallet'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  팔레트 적재 (Pallet)
                </button>
                <button
                  onClick={() => onUpdateMode('carton')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === 'carton'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  외박스 포장 (Carton)
                </button>
              </div>
            </div>

            {/* Arbitrary Container Dimensions Input (Always unlocked!) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  {mode === 'pallet' ? '팔레트 임의 규격 지정 (mm)' : '외박스 내경 임의 지정 (mm)'}
                </span>
                <button
                  onClick={() => {
                    const padClearance = mode === 'carton' ? 10 : 0;
                    onUpdateContainer({
                      autoFitContainer: false,
                      width: Math.max(50, summary.stackWidth + padClearance),
                      depth: Math.max(50, summary.stackDepth + padClearance),
                      maxHeight: Math.max(30, summary.totalHeight + padClearance),
                    });
                  }}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  현재 적재물 크기에 딱 맞추기
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {mode === 'pallet' ? '팔레트 가로(W)' : '외박스 가로(W)'}
                  </label>
                  <FreeNumberInput
                    label={mode === 'pallet' ? '팔레트 가로' : '외박스 가로'}
                    unit="mm"
                    min={30}
                    max={5000}
                    value={summary.effectiveContainerWidth}
                    onValidChange={(v) =>
                      onUpdateContainer({ width: v, autoFitContainer: false })
                    }
                    onErrorChange={(err) => setFieldError('contWidth', err)}
                    className="w-full border rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {mode === 'pallet' ? '팔레트 세로(D)' : '외박스 세로(D)'}
                  </label>
                  <FreeNumberInput
                    label={mode === 'pallet' ? '팔레트 세로' : '외박스 세로'}
                    unit="mm"
                    min={30}
                    max={5000}
                    value={summary.effectiveContainerDepth}
                    onValidChange={(v) =>
                      onUpdateContainer({ depth: v, autoFitContainer: false })
                    }
                    onErrorChange={(err) => setFieldError('contDepth', err)}
                    className="w-full border rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {mode === 'pallet' ? '최대 허용높이(H)' : '외박스 높이(H)'}
                  </label>
                  <FreeNumberInput
                    label={mode === 'pallet' ? '최대 허용높이' : '외박스 높이'}
                    unit="mm"
                    min={30}
                    max={5000}
                    value={summary.effectiveContainerHeight}
                    onValidChange={(v) =>
                      onUpdateContainer({ maxHeight: v, autoFitContainer: false })
                    }
                    onErrorChange={(err) => setFieldError('contHeight', err)}
                    className="w-full border rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              {mode === 'pallet' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      팔레트 받침 높이 (mm)
                    </label>
                    <FreeNumberInput
                      label="팔레트 받침 높이"
                      unit="mm"
                      min={0}
                      max={500}
                      value={container.palletHeight}
                      onValidChange={(v) => onUpdateContainer({ palletHeight: v })}
                      onErrorChange={(err) => setFieldError('palletHeight', err)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      팔레트 자중 (kg)
                    </label>
                    <FreeNumberInput
                      label="팔레트 자중"
                      unit="kg"
                      min={0}
                      max={200}
                      value={container.palletWeight}
                      onValidChange={(v) => onUpdateContainer({ palletWeight: v })}
                      onErrorChange={(err) => setFieldError('palletWeight', err)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {containerErrors.length > 0 && (
                <div className="rounded-lg bg-red-950/40 border border-red-500/50 px-3 py-2 space-y-1">
                  {containerErrors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-red-300"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alignment & 3D Space Guide Options */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <span className="block text-xs font-semibold text-slate-300">
                내부 여유 공간 및 이탈 영역 확인 옵션
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateArrangement({ centerItems: false })}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                    !arrangement.centerItems
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold">모서리 밀착 정렬</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    남는 공간을 한쪽으로 모아 확인
                  </div>
                </button>

                <button
                  onClick={() => onUpdateArrangement({ centerItems: true })}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                    arrangement.centerItems
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold">중앙 대칭 정렬</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    좌·우·앞·뒤 균등 여백 배치
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-emerald-400">
                      여유 공간 표시 (녹색)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      남는 내부 공간 볼륨/수치
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={viewer.showSpaceAnalysis && viewer.showClearance}
                    onChange={(e) =>
                      onUpdateViewer({
                        showSpaceAnalysis: true,
                        showClearance: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-red-400">
                      초과 영역 표시 (적색)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      경계 이탈 영역 볼륨/경고
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={viewer.showSpaceAnalysis && viewer.showOverhang}
                    onChange={(e) =>
                      onUpdateViewer({
                        showSpaceAnalysis: true,
                        showOverhang: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Standard Container Presets */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="block text-[11px] text-slate-400 mb-1.5">
                {mode === 'pallet' ? '표준 물류 팔레트 규격 빠른 적용' : '표준 마스터 카톤 규격 빠른 적용'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {mode === 'pallet' ? (
                  <>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 1100,
                          depth: 1100,
                          maxHeight: 1500,
                          palletHeight: 150,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      T11 표준 (1100×1100)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 1200,
                          depth: 1000,
                          maxHeight: 1500,
                          palletHeight: 150,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      T12 규격 (1200×1000)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 1200,
                          depth: 800,
                          maxHeight: 1500,
                          palletHeight: 144,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      유로 EUR (1200×800)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 1100,
                          depth: 900,
                          maxHeight: 1400,
                          palletHeight: 150,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      소형 물류 (1100×900)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 430,
                          depth: 225,
                          maxHeight: 155,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      8캔 카톤 (430×225×155)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 480,
                          depth: 380,
                          maxHeight: 340,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      택배 5호 (480×380×340)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 600,
                          depth: 400,
                          maxHeight: 400,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      수출 마스터 (600×400×400)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateContainer({
                          width: 500,
                          depth: 500,
                          maxHeight: 500,
                          autoFitContainer: false,
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-left"
                    >
                      정방형 카톤 (500×500×500)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 테마 · 색상 · 외관 설정 */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                3D 시각화 컬러 테마
              </label>
              <div className="space-y-2">
                {(
                  [
                    {
                      id: 'cad-classic',
                      title: '물류 CAD 클래식 (첨부 이미지 1 스타일)',
                      desc: '장변(Red) · 단변(Blue) · 상면(White) + 옐로우 팔레트',
                    },
                    {
                      id: 'carton-can',
                      title: '반투명 외박스 & 스틸캔 (첨부 이미지 2 스타일)',
                      desc: '스틸 블루 원통/상자 + 골드 라인 반투명 카톤 케이스',
                    },
                    {
                      id: 'layer-vivid',
                      title: '단수(Layer)별 컬러 구분',
                      desc: '1단~8단까지 층마다 다른 색상을 부여하여 적재 단수 식별',
                    },
                    {
                      id: 'kraft',
                      title: '실제 골판지 크라프트 박스 & 목재',
                      desc: '테이프 마감 골판지 상자 및 목재 팔레트 질감',
                    },
                    {
                      id: 'custom',
                      title: '사용자 지정 색상',
                      desc: '원하는 물품 메인/보조 색상을 직접 선택',
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onUpdateViewer({ colorTheme: t.id as ColorTheme })}
                    className={`w-full p-2.5 rounded-lg border text-left transition-colors ${
                      viewer.colorTheme === t.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{t.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {viewer.colorTheme === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    주 색상 (장변/바디)
                  </label>
                  <input
                    type="color"
                    value={item.customColor}
                    onChange={(e) => onUpdateItem({ customColor: e.target.value })}
                    className="w-full h-9 rounded cursor-pointer bg-slate-950 border border-slate-800 p-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    보조 색상 (단변/상단캡)
                  </label>
                  <input
                    type="color"
                    value={item.secondaryColor}
                    onChange={(e) => onUpdateItem({ secondaryColor: e.target.value })}
                    className="w-full h-9 rounded cursor-pointer bg-slate-950 border border-slate-800 p-1"
                  />
                </div>
              </div>
            )}

            {/* Outer Box Opacity & Edge Lines */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">외박스 벽면 투명도</span>
                <span className="text-xs font-mono text-slate-400">
                  {Math.round(viewer.outerBoxOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.65}
                step={0.05}
                value={viewer.outerBoxOpacity}
                onChange={(e) =>
                  onUpdateViewer({
                    outerBoxOpacity: parseFloat(e.target.value),
                    showOuterBox: true,
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />

              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-xs text-slate-300">모서리 윤곽선(Edge Line) 강조</span>
                <input
                  type="checkbox"
                  checked={viewer.showEdges}
                  onChange={(e) => onUpdateViewer({ showEdges: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>
            </div>

            {/* 3D Viewport Background Color Settings */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  3D 뷰 화면 바탕색 설정
                </span>
                <span className="text-[11px] font-mono text-slate-400 uppercase">
                  {viewer.backgroundStyle === 'custom'
                    ? viewer.customBgColor
                    : viewer.backgroundStyle}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'cad-gray', label: 'CAD 그레이', color: '#b5b7bb' },
                    { id: 'clean-white', label: '클린 화이트', color: '#f8fafc' },
                    { id: 'warm-sand', label: '웜 샌드', color: '#e7e5e4' },
                    { id: 'dark-studio', label: '스튜디오 다크', color: '#0f172a' },
                    { id: 'blueprint-navy', label: '블루프린트', color: '#172554' },
                    {
                      id: 'custom',
                      label: '사용자 지정',
                      color: viewer.customBgColor || '#d8dee9',
                    },
                  ] as { id: BackgroundStyle; label: string; color: string }[]
                ).map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => onUpdateViewer({ backgroundStyle: bg.id })}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                      viewer.backgroundStyle === bg.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded border border-slate-500 shrink-0"
                      style={{ backgroundColor: bg.color }}
                    />
                    <span className="text-[11px] font-medium truncate">{bg.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    사용자 지정 바탕색 직접 선택
                  </div>
                  <div className="text-[10px] text-slate-400">
                    원하는 임의의 배경 색상(HEX)을 지정합니다
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300 uppercase">
                    {viewer.customBgColor || '#d8dee9'}
                  </span>
                  <input
                    type="color"
                    value={viewer.customBgColor || '#d8dee9'}
                    onChange={(e) =>
                      onUpdateViewer({
                        backgroundStyle: 'custom',
                        customBgColor: e.target.value,
                      })
                    }
                    className="w-10 h-8 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0.5"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Always-Visible Container Space & Overhang Inspector (평면도 + 측면도 + 빠른 용기 크기 조절) */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              {mode === 'pallet' ? '팔레트' : '외박스'} 여유·초과 공간 확인
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  onUpdateViewer({
                    showSpaceAnalysis: true,
                    showClearance: !(viewer.showSpaceAnalysis && viewer.showClearance),
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                  viewer.showSpaceAnalysis && viewer.showClearance
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                여유 {viewer.showSpaceAnalysis && viewer.showClearance ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() =>
                  onUpdateViewer({
                    showSpaceAnalysis: true,
                    showOverhang: !(viewer.showSpaceAnalysis && viewer.showOverhang),
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                  viewer.showSpaceAnalysis && viewer.showOverhang
                    ? 'bg-red-600/30 border-red-500 text-red-300'
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                초과 {viewer.showSpaceAnalysis && viewer.showOverhang ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() =>
                  onUpdateArrangement({ centerItems: !arrangement.centerItems })
                }
                className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors ml-1"
              >
                {arrangement.centerItems ? '모서리 밀착' : '중앙 정렬'}
              </button>
            </div>
          </div>

          {/* 3D View Size Display Mode Selector (사용자 설정 크기 | 계산된 크기 | 둘다 | 모두 OFF) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>3D 뷰 크기 표시 선택</span>
              <span className="font-mono text-[10px] text-slate-500">
                설정 vs 계산 규격 비교
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-md">
              {(
                [
                  { id: 'custom', label: '사용자 설정' },
                  { id: 'calculated', label: '계산된 크기' },
                  { id: 'both', label: '둘다' },
                  { id: 'off', label: '모두 OFF' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    onUpdateViewer({
                      sizeDisplayMode: opt.id,
                      showDimensions: opt.id !== 'off',
                    })
                  }
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    viewer.sizeDisplayMode === opt.id
                      ? opt.id === 'custom'
                        ? 'bg-amber-600 text-white'
                        : opt.id === 'calculated'
                        ? 'bg-cyan-600 text-white'
                        : opt.id === 'both'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Inline Container Size Adjuster (Always Accessible from Any Tab) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{mode === 'pallet' ? '설정 팔레트 크기 (W×D×H)' : '설정 외박스 내경 (W×D×H)'}</span>
              <span className="font-mono text-cyan-400">
                계산된 크기: {summary.stackWidth}×{summary.stackDepth}×{summary.totalHeight}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <FreeNumberInput
                  label="용기 가로"
                  unit="mm"
                  min={30}
                  max={5000}
                  value={summary.effectiveContainerWidth}
                  onValidChange={(v) =>
                    onUpdateContainer({ width: v, autoFitContainer: false })
                  }
                  className="w-full border rounded px-2 py-1 text-xs font-mono text-center focus:outline-none"
                />
                <div
                  className={`text-[10px] font-mono text-center mt-1 ${
                    summary.marginX < 0
                      ? 'text-red-400 font-semibold'
                      : summary.marginX > 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  가로 {summary.marginX >= 0 ? `+${summary.marginX}` : summary.marginX}mm
                </div>
              </div>

              <div>
                <FreeNumberInput
                  label="용기 세로"
                  unit="mm"
                  min={30}
                  max={5000}
                  value={summary.effectiveContainerDepth}
                  onValidChange={(v) =>
                    onUpdateContainer({ depth: v, autoFitContainer: false })
                  }
                  className="w-full border rounded px-2 py-1 text-xs font-mono text-center focus:outline-none"
                />
                <div
                  className={`text-[10px] font-mono text-center mt-1 ${
                    summary.marginZ < 0
                      ? 'text-red-400 font-semibold'
                      : summary.marginZ > 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  세로 {summary.marginZ >= 0 ? `+${summary.marginZ}` : summary.marginZ}mm
                </div>
              </div>

              <div>
                <FreeNumberInput
                  label="용기 높이"
                  unit="mm"
                  min={30}
                  max={5000}
                  value={summary.effectiveContainerHeight}
                  onValidChange={(v) =>
                    onUpdateContainer({ maxHeight: v, autoFitContainer: false })
                  }
                  className="w-full border rounded px-2 py-1 text-xs font-mono text-center focus:outline-none"
                />
                <div
                  className={`text-[10px] font-mono text-center mt-1 ${
                    summary.marginY < 0
                      ? 'text-red-400 font-semibold'
                      : summary.marginY > 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  높이 {summary.marginY >= 0 ? `+${summary.marginY}` : summary.marginY}mm
                </div>
              </div>
            </div>
          </div>

          {/* 2D Top-Down Blueprint (평면도) & Side Elevation Blueprint (측면 단면도) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Left: Top-Down View (가로 × 세로 여유 및 이탈) */}
            {(() => {
              const showClearance = viewer.showSpaceAnalysis && viewer.showClearance;
              const showOverhang = viewer.showSpaceAnalysis && viewer.showOverhang;
              const layer0Items = summary.placedItems.filter((p) => p.layer === 0);
              const contW = Math.max(100, summary.effectiveContainerWidth);
              const contD = Math.max(100, summary.effectiveContainerDepth);
              const maxSpanW = Math.max(contW, summary.stackWidth) + 80;
              const maxSpanD = Math.max(contD, summary.stackDepth) + 80;

              return (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-col items-center">
                  <div className="text-[11px] font-medium text-slate-300 mb-1">
                    평면도 (가로·세로 공간)
                  </div>
                  <svg
                    viewBox={`${-maxSpanW / 2} ${-maxSpanD / 2} ${maxSpanW} ${maxSpanD}`}
                    className="w-full h-28"
                  >
                    {/* Container Inner Void Area (Green tint representing usable container space) */}
                    <rect
                      x={-contW / 2}
                      y={-contD / 2}
                      width={contW}
                      height={contD}
                      fill={showClearance ? 'rgba(16, 185, 129, 0.16)' : 'rgba(30, 41, 59, 0.4)'}
                      stroke={
                        (summary.overhangX > 0 || summary.overhangZ > 0) && showOverhang
                          ? '#ef4444'
                          : showClearance
                          ? '#10b981'
                          : '#64748b'
                      }
                      strokeWidth={Math.max(4, maxSpanW * 0.015)}
                      strokeDasharray={
                        (summary.overhangX > 0 || summary.overhangZ > 0) && showOverhang
                          ? '14 8'
                          : undefined
                      }
                    />
                    {/* Placed Items on Layer 1 */}
                    {layer0Items.map((it) => {
                      const isOut = (it.outX || it.outZ) && showOverhang;
                      return it.shape === 'cylinder' ? (
                        <circle
                          key={it.id}
                          cx={it.x}
                          cy={it.z}
                          r={Math.max(2, it.dimX / 2 - 2)}
                          fill={isOut ? '#ef4444' : '#5b84b1'}
                          fillOpacity={0.9}
                          stroke={isOut ? '#fecaca' : '#0f172a'}
                          strokeWidth={Math.max(2, maxSpanW * 0.01)}
                        />
                      ) : (
                        <rect
                          key={it.id}
                          x={it.x - it.dimX / 2 + 2}
                          y={it.z - it.dimZ / 2 + 2}
                          width={Math.max(4, it.dimX - 4)}
                          height={Math.max(4, it.dimZ - 4)}
                          fill={isOut ? '#ef4444' : it.isRotated ? '#2563eb' : '#3b82f6'}
                          fillOpacity={0.88}
                          stroke={isOut ? '#fecaca' : '#0f172a'}
                          strokeWidth={Math.max(2, maxSpanW * 0.01)}
                        />
                      );
                    })}
                  </svg>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    녹색: 여유공간 / 적색: 이탈
                  </div>
                </div>
              );
            })()}

            {/* Right: Side Elevation Cross-Section View (가로 × 높이 여유 및 초과) */}
            {(() => {
              const showClearance = viewer.showSpaceAnalysis && viewer.showClearance;
              const showOverhang = viewer.showSpaceAnalysis && viewer.showOverhang;
              const contW = Math.max(100, summary.effectiveContainerWidth);
              const contH = Math.max(100, summary.effectiveContainerHeight);
              const palletH = mode === 'pallet' ? container.palletHeight : 0;
              const stackW = summary.stackWidth;
              const totalH = summary.totalHeight;

              const viewW = Math.max(contW, stackW) + 100;
              const viewH = Math.max(contH, totalH) + 100;
              const stackLeft = arrangement.centerItems ? -stackW / 2 : -contW / 2;

              return (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-col items-center">
                  <div className="text-[11px] font-medium text-slate-300 mb-1">
                    측면도 (높이 여유·초과)
                  </div>
                  <svg
                    viewBox={`${-viewW / 2} ${-40} ${viewW} ${viewH}`}
                    className="w-full h-28"
                  >
                    {/* Container / Max Height Envelope */}
                    {(() => {
                      const groundY = viewH - 50;
                      return (
                        <>
                          {/* Container interior background */}
                          <rect
                            x={-contW / 2}
                            y={groundY - contH}
                            width={contW}
                            height={contH}
                            fill={
                              showClearance
                                ? 'rgba(16, 185, 129, 0.16)'
                                : 'rgba(30, 41, 59, 0.4)'
                            }
                            stroke={
                              summary.hasOverhang && showOverhang
                                ? '#ef4444'
                                : showClearance
                                ? '#10b981'
                                : '#64748b'
                            }
                            strokeWidth={Math.max(4, viewW * 0.015)}
                            strokeDasharray="12 6"
                          />

                          {/* Pallet Base */}
                          {palletH > 0 && (
                            <rect
                              x={-contW / 2}
                              y={groundY - palletH}
                              width={contW}
                              height={palletH}
                              fill="#eab308"
                              stroke="#0f172a"
                              strokeWidth={Math.max(2, viewW * 0.01)}
                            />
                          )}

                          {/* Stacked Layers */}
                          {Array.from({ length: summary.totalLayers }).map((_, lIdx) => {
                            const layerTopY = groundY - palletH - (lIdx + 1) * item.height;
                            const isLayerOverY =
                              (palletH + (lIdx + 1) * item.height > contH + 1) && showOverhang;
                            const isLayerOverX = summary.overhangX > 1 && showOverhang;
                            return (
                              <rect
                                key={lIdx}
                                x={stackLeft}
                                y={layerTopY}
                                width={stackW}
                                height={Math.max(2, item.height - 2)}
                                fill={
                                  isLayerOverY || isLayerOverX
                                    ? '#ef4444'
                                    : lIdx % 2 === 0
                                    ? '#3b82f6'
                                    : '#2563eb'
                                }
                                fillOpacity={0.88}
                                stroke="#0f172a"
                                strokeWidth={Math.max(2, viewW * 0.008)}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    {summary.marginY >= 0
                      ? `상단 여유: +${summary.marginY}mm`
                      : `높이 초과: ${summary.marginY}mm`}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 5. Bottom Logistics Metrics Strip inside Sidebar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[11px] text-slate-400">체적 적재율</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {summary.volumeUtilization}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">남는 내부 공간</div>
            <div className="text-sm font-bold font-mono text-cyan-400">
              {(summary.emptyVoidVolumeCbm * 1000).toFixed(1)} L
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">총 중량 (Gross)</div>
            <div className="text-sm font-bold font-mono text-slate-200">
              {summary.grossWeightKg.toLocaleString()} kg
            </div>
          </div>
        </div>

        {/* Utilization Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              summary.hasOverhang ? 'bg-red-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, summary.volumeUtilization)}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
