import React from 'react';
import { Check, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import {
  ContainerSpec,
  ItemSpec,
  OptimizationRecommendation,
  PackingMode,
} from '../types/packing';

interface OptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PackingMode;
  item: ItemSpec;
  container: ContainerSpec;
  recommendations: OptimizationRecommendation[];
  onApplyRecommendation: (rec: OptimizationRecommendation) => void;
}

export const OptimizerModal: React.FC<OptimizerModalProps> = ({
  isOpen,
  onClose,
  mode,
  item,
  container,
  recommendations,
  onApplyRecommendation,
}) => {
  if (!isOpen) return null;

  const containerLabel = mode === 'pallet' ? '사용자 설정 팔레트' : '사용자 설정 외박스';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {containerLabel} 맞춤 최적 적재 패턴 추천 (TOP {recommendations.length})
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  최대 3가지 자동 분석
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                기준 {mode === 'pallet' ? '팔레트' : '외박스'} 규격: {container.width} ×{' '}
                {container.depth} × {container.maxHeight} mm
                {mode === 'pallet' ? ` (팔레트 받침 ${container.palletHeight}mm 포함)` : ''} · 물품:{' '}
                {item.shape === 'box'
                  ? `박스 ${item.width} × ${item.depth} × ${item.height} mm`
                  : `원통 Ø${item.diameter} × ${item.height} mm`}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {recommendations.map((rec, index) => {
            const isBest = index === 0;
            return (
              <div
                key={rec.id}
                className={`p-5 rounded-xl border transition-colors ${
                  isBest
                    ? 'bg-blue-950/30 border-blue-500/60 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2.5 flex-1">
                    {/* Rank & Badge Header */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2.5 py-0.5 rounded-md font-bold ${
                          isBest
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-200 border border-slate-700'
                        }`}
                      >
                        추천 {index + 1}순위
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {rec.badge}
                      </span>
                      <span className="text-slate-400 font-mono">
                        안정성 지수 <strong className="text-white">{rec.stabilityScore}점</strong>
                      </span>
                      <span className="text-slate-500" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-400 font-mono">
                        계산된 적재 크기:{' '}
                        <strong className="text-cyan-300">
                          {rec.stackWidth}×{rec.stackDepth}×{rec.totalHeight}mm
                        </strong>
                      </span>
                    </div>

                    {/* Pattern Title & Subtitle */}
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{rec.title}</span>
                        {rec.rotateBase && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            물품 90° 회전 배치
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{rec.subtitle}</p>
                    </div>

                    {/* Key Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-[11px] text-slate-400">총 적재 수량</div>
                        <div className="text-sm font-bold font-mono text-white">
                          {rec.totalCount.toLocaleString()}개{' '}
                          <span className="text-[11px] font-normal text-slate-400">
                            (층당 {rec.itemsPerLayer}개)
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-[11px] text-slate-400">바닥 면적 / 체적 효율</div>
                        <div className="text-sm font-bold font-mono text-emerald-400">
                          {rec.areaUtilization}%{' '}
                          <span className="text-[11px] font-normal text-slate-400">
                            / {rec.volumeUtilization}%
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-[11px] text-slate-400">설정 규격 대비 여유</div>
                        <div className="text-xs font-bold font-mono text-cyan-300 mt-0.5">
                          X {rec.marginX >= 0 ? `+${rec.marginX}` : rec.marginX} · Z{' '}
                          {rec.marginZ >= 0 ? `+${rec.marginZ}` : rec.marginZ} · Y{' '}
                          {rec.marginY >= 0 ? `+${rec.marginY}` : rec.marginY}mm
                        </div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-[11px] text-slate-400">총 중량 (Gross)</div>
                        <div className="text-sm font-bold font-mono text-slate-200">
                          {rec.grossWeightKg.toLocaleString()} kg
                        </div>
                      </div>
                    </div>

                    {/* Detailed Recommendation Reasons Box */}
                    <div className="mt-2 bg-slate-900/75 border border-slate-800/90 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-start gap-2 text-xs font-semibold text-blue-300">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <span>추천 이유: {rec.reasonSummary}</span>
                      </div>
                      <ul className="space-y-1.5 pl-1">
                        {rec.reasons.map((reason, rIdx) => (
                          <li
                            key={rIdx}
                            className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <div className="flex lg:flex-col items-stretch lg:items-end justify-end shrink-0">
                    <button
                      onClick={() => {
                        onApplyRecommendation(rec);
                        onClose();
                      }}
                      className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                        isBest
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-blue-600 text-slate-100 border border-slate-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>이 패턴 즉시 적용</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            사용자 설정 {mode === 'pallet' ? '팔레트' : '외박스'} 크기({container.width}×
            {container.depth}×{container.maxHeight}mm) 내에서 수납 수량, 공간 효율, 인터로킹 안정성을 종합 평가한 상위{' '}
            {recommendations.length}개 패턴입니다.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium whitespace-nowrap shrink-0"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

