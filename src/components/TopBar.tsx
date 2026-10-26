import React from 'react';
import { PackingMode } from '../types/packing';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  mode: PackingMode;
  onSelectMode: (mode: PackingMode) => void;
  onOpenOptimizer: () => void;
  onOpenReport: () => void;
  onCaptureImage: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  onSelectMode,
  onOpenOptimizer,
  onOpenReport,
  onCaptureImage,
}) => {
  return (
    <header className="flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 py-3 bg-slate-950 border-b border-slate-800 shrink-0 overflow-x-auto">
      {/* Zone 1: Brand icon & wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectMode('pallet');
        }}
        className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
      >
        <img
          src="/assets/aistudio/jsss_6378c108.png"
          alt="JS Stack Simulator"
          className="w-8 h-8 rounded-lg bg-white p-0.5 object-contain shadow-xs"
        />
        <span>JS Stack Simulator</span>
      </a>

      {/* Zone 2: Navigation links */}
      <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => onSelectMode('pallet')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            mode === 'pallet'
              ? 'text-white border-b-2 border-blue-500 font-semibold'
              : 'hover:text-white'
          }`}
        >
          팔레트 적재 모드
        </button>
        <button
          onClick={() => onSelectMode('carton')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            mode === 'carton'
              ? 'text-white border-b-2 border-blue-500 font-semibold'
              : 'hover:text-white'
          }`}
        >
          외박스 포장 모드
        </button>
        <button
          onClick={onOpenOptimizer}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          최적 패턴 추천
        </button>
        <button
          onClick={onOpenReport}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          포장·적재 사양서
        </button>
      </nav>

      {/* Zone 3: PWA Install & Primary Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton />
        <button
          onClick={onCaptureImage}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          3D 이미지 저장
        </button>
      </div>
    </header>
  );
};

