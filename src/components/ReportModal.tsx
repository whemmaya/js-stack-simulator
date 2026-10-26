import React from 'react';
import { Download, FileText, Printer, X } from 'lucide-react';
import {
  ArrangementConfig,
  ContainerSpec,
  ItemSpec,
  PackingMode,
  PackingSummary,
} from '../types/packing';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PackingMode;
  item: ItemSpec;
  container: ContainerSpec;
  arrangement: ArrangementConfig;
  summary: PackingSummary;
  onCaptureImage: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  mode,
  item,
  container,
  arrangement,
  summary,
  onCaptureImage,
}) => {
  if (!isOpen) return null;

  const patternName =
    arrangement.pattern === 'pinwheel'
      ? '풍차형 4방향 교차 적재 (Pinwheel)'
      : arrangement.pattern === 'brick'
      ? '벽돌식 지그재그 적재 (Brick)'
      : arrangement.pattern === 'hex'
      ? '원통 벌집형 밀집 배열 (Hexagonal)'
      : '격자 정렬 배치 (Block Grid)';

  const handleDownloadJsonSpec = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      mode,
      item,
      container: {
        ...container,
        effectiveWidth: summary.effectiveContainerWidth,
        effectiveDepth: summary.effectiveContainerDepth,
        effectiveHeight: summary.effectiveContainerHeight,
      },
      arrangement,
      metrics: {
        itemsPerLayer: summary.itemsPerLayer,
        totalLayers: summary.totalLayers,
        totalCount: summary.totalCount,
        stackDimensionsMm: {
          width: summary.stackWidth,
          depth: summary.stackDepth,
          height: summary.stackHeight,
          totalHeightWithPallet: summary.totalHeight,
        },
        areaUtilizationPercent: summary.areaUtilization,
        volumeUtilizationPercent: summary.volumeUtilization,
        netWeightKg: summary.netWeightKg,
        grossWeightKg: summary.grossWeightKg,
        totalVolumeCbm: Number(summary.totalItemVolumeCbm.toFixed(4)),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JS_Stack_Simulator_Spec_${summary.effectiveContainerWidth}x${summary.effectiveContainerDepth}x${summary.totalHeight}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                포장 및 적재 작업 표준 사양서 (Specification Sheet)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                물류 현장 공유 및 패키징 설계 검증용 상세 제원표
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Key KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">총 적재 수량</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {summary.totalCount.toLocaleString()} 개
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                층당 {summary.itemsPerLayer}개 × {summary.totalLayers}단
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">총 적재 외경 (W×D×H)</div>
              <div className="text-base font-bold font-mono text-white mt-1.5">
                {summary.effectiveContainerWidth}×{summary.effectiveContainerDepth}×
                {summary.totalHeight}
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">단위: mm</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">바닥 면적 / 체적 효율</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {summary.areaUtilization}%
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                총 {summary.totalItemVolumeCbm.toFixed(3)} CBM
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">총 중량 (Gross Weight)</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {summary.grossWeightKg.toLocaleString()} kg
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                순중량 {summary.netWeightKg.toLocaleString()} kg
              </div>
            </div>
          </div>

          {/* 2. Detailed Spec Comparison Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                단위 물품(Item) 상세 제원
              </h3>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">물품 형태</span>
                <span className="font-medium text-white">
                  {item.shape === 'box' ? '직육면체 상자 (Box)' : '원기둥 용기 (Cylinder)'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">물품 규격 (mm)</span>
                <span className="font-mono text-white">
                  {item.shape === 'box'
                    ? `${item.width} (L) × ${item.depth} (W) × ${item.height} (H)`
                    : `Ø${item.diameter} × ${item.height} (H)`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">단위 중량 / 체적</span>
                <span className="font-mono text-white">
                  {item.weight} kg · {(summary.itemUnitVolumeCbm * 1000).toFixed(2)} L
                </span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                포장 용기 및 배열 방식
              </h3>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">시뮬레이션 모드</span>
                <span className="font-medium text-white">
                  {mode === 'pallet' ? '팔레트 적재 (Palletizing)' : '외박스 포장 (Carton Packing)'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">배열 패턴</span>
                <span className="font-medium text-blue-400">{patternName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">짝수층 교차 회전</span>
                <span className="font-mono text-white">
                  {arrangement.alternateLayers ? '적용 (홀/짝수층 교대 맞물림)' : '미적용 (동일 수직 적재)'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Layer Blueprint Comparison */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-300 mb-3">
              층별 평면 배치 도면 (장변: 적색 · 단변회전: 청색)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1].map((layerIdx) => {
                const layerItems = summary.placedItems.filter((p) => p.layer === layerIdx);
                const targetItems =
                  layerItems.length > 0
                    ? layerItems
                    : summary.placedItems.filter((p) => p.layer === 0);

                const contW = Math.max(100, summary.effectiveContainerWidth);
                const contD = Math.max(100, summary.effectiveContainerDepth);

                return (
                  <div
                    key={layerIdx}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col items-center"
                  >
                    <div className="text-xs font-semibold text-slate-200 mb-2">
                      {layerIdx === 0
                        ? '홀수층 배치도 (1, 3, 5, 7단)'
                        : '짝수층 배치도 (2, 4, 6, 8단)'}
                    </div>
                    <svg
                      viewBox={`${-contW / 2 - 40} ${-contD / 2 - 40} ${contW + 80} ${contD + 80}`}
                      className="w-full h-44"
                    >
                      <rect
                        x={-contW / 2}
                        y={-contD / 2}
                        width={contW}
                        height={contD}
                        fill="rgba(250, 204, 21, 0.1)"
                        stroke="#eab308"
                        strokeWidth={Math.max(4, contW * 0.012)}
                      />
                      {targetItems.map((it, idx) =>
                        it.shape === 'cylinder' ? (
                          <g key={it.id}>
                            <circle
                              cx={it.x}
                              cy={it.z}
                              r={it.dimX / 2 - 2}
                              fill="#5b84b1"
                              stroke="#0f172a"
                              strokeWidth={Math.max(2, contW * 0.008)}
                            />
                            <text
                              x={it.x}
                              y={it.z}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize={Math.max(12, it.dimX * 0.25)}
                              fontFamily="JetBrains Mono"
                            >
                              {idx + 1}
                            </text>
                          </g>
                        ) : (
                          <g key={it.id}>
                            <rect
                              x={it.x - it.dimX / 2 + 2}
                              y={it.z - it.dimZ / 2 + 2}
                              width={Math.max(4, it.dimX - 4)}
                              height={Math.max(4, it.dimZ - 4)}
                              fill={it.isRotated ? '#2563eb' : '#ef4444'}
                              stroke="#0f172a"
                              strokeWidth={Math.max(2, contW * 0.008)}
                            />
                            <text
                              x={it.x}
                              y={it.z}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize={Math.max(14, Math.min(it.dimX, it.dimZ) * 0.22)}
                              fontFamily="JetBrains Mono"
                              fontWeight="bold"
                            >
                              {it.dimX}×{it.dimZ}
                            </text>
                          </g>
                        )
                      )}
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            3D 화면 캡처 이미지 또는 JSON 사양 데이터로 내보낼 수 있습니다.
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadJsonSpec}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>사양서 JSON 저장</span>
            </button>
            <button
              onClick={onCaptureImage}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>3D 도면 이미지 저장</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
