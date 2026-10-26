import React, { useState } from 'react';
import { Download, ExternalLink, Monitor, Share, Smartphone, Tablet, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Hide install button if already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-600/20 border border-emerald-500/40 rounded-lg hover:bg-emerald-600/30 transition-colors whitespace-nowrap shrink-0"
        title="스마트폰, 태블릿, PC 홈 화면에 JS Stack Simulator 앱 설치"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>앱 설치</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/jsss_6378c108.png"
                  alt="JS Stack Simulator 아이콘"
                  className="w-11 h-11 rounded-xl bg-white p-0.5 object-contain shadow-sm"
                />
                <div>
                  <h3 className="text-base font-bold text-white">
                    JS Stack Simulator 앱 설치
                  </h3>
                  <p className="text-xs text-slate-400">
                    스마트폰 · 태블릿 · PC에서 네이티브 앱처럼 전체화면으로 실행하세요
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Native Prompt Trigger if available */}
              {isInstallable && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-4">
                  <div className="text-xs text-emerald-200">
                    <div className="font-bold text-sm text-white mb-0.5">
                      원클릭 즉시 설치 가능
                    </div>
                    현재 브라우저에서 홈 화면에 바로 앱을 설치할 수 있습니다.
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setShowGuide(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0"
                  >
                    지금 설치하기
                  </button>
                </div>
              )}

              {/* Notice if inside an iframe preview */}
              {isInIframe && !isInstallable && (
                <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-blue-200 space-y-0.5">
                    <div className="font-bold text-white">
                      새 탭(전체 창)에서 열면 바로 설치할 수 있습니다
                    </div>
                    <div>
                      미리보기 프레임 내부에서는 브라우저 보안 정책상 자동 설치 팝업이 제한됩니다.
                    </div>
                  </div>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>새 탭으로 열기</span>
                  </a>
                </div>
              )}

              {/* Device-specific installation instructions */}
              <div className="space-y-3">
                {/* 1. Android Phone / Tablet */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Smartphone className="w-4 h-4" />
                    <span>Android 폰 · 갤럭시 탭 (Chrome / 삼성 인터넷)</span>
                  </div>
                  <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside pl-0.5 leading-relaxed">
                    <li>
                      브라우저 우측 상단 메뉴(<strong>⋮</strong> 또는 <strong>≡</strong>)를 탭합니다.
                    </li>
                    <li>
                      <strong>「앱 설치」</strong> 또는 <strong>「홈 화면에 추가」</strong>를 선택하면{' '}
                      <strong>JS Stack</strong> 아이콘으로 바탕화면에 설치됩니다.
                    </li>
                  </ol>
                </div>

                {/* 2. iOS / iPadOS (Safari) */}
                <div
                  className={`p-4 rounded-xl border space-y-1.5 ${
                    isIOS
                      ? 'bg-blue-950/30 border-blue-500/50'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                    <Tablet className="w-4 h-4" />
                    <span>iPhone · iPad (Safari 브라우저)</span>
                  </div>
                  <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside pl-0.5 leading-relaxed">
                    <li>
                      Safari 하단(또는 상단) 주소창 옆의{' '}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-white font-semibold">
                        <Share className="w-3 h-3" /> 공유
                      </span>{' '}
                      버튼을 탭합니다.
                    </li>
                    <li>
                      메뉴에서 <strong>「홈 화면에 추가 (Add to Home Screen)」</strong>를 누른 뒤 우측 상단{' '}
                      <strong>「추가」</strong>를 탭합니다.
                    </li>
                  </ol>
                </div>

                {/* 3. Desktop / Laptop / Windows Tablet */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Monitor className="w-4 h-4" />
                    <span>PC · 노트북 · 서피스 태블릿 (Chrome / Edge)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    브라우저 주소창 우측 끝의 <strong>앱 설치(모니터+다운로드) 아이콘</strong>을 클릭하면 독립된 데스크톱 창으로 실행됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>설치 후 오프라인 환경에서도 3D 적재 시뮬레이션이 작동합니다.</span>
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg">
      <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
      <span>오프라인 모드 — 기기에 캐시된 앱 데이터로 실행 중입니다.</span>
    </div>
  );
};
