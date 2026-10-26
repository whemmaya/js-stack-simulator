import React, { useMemo, useState } from 'react';
import { ConfigSidebar } from './components/ConfigSidebar';
import { OptimizerModal } from './components/OptimizerModal';
import { PackingCanvas3D } from './components/PackingCanvas3D';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ReportModal } from './components/ReportModal';
import { TopBar } from './components/TopBar';
import {
  ArrangementConfig,
  ContainerSpec,
  QuickPreset,
  ItemSpec,
  OptimizationRecommendation,
  PackingMode,
  QUICK_PRESETS,
  ViewerConfig,
} from './types/packing';
import {
  calculatePacking,
  generateOptimalRecommendations,
} from './utils/packingCalculator';

export default function App() {
  const defaultPreset = QUICK_PRESETS[0]; // 첨부 이미지 1 프리셋 (1100×1100 팔레트 풍차형 적재)

  const [activePresetId, setActivePresetId] = useState<string>(defaultPreset.id);
  const [mode, setMode] = useState<PackingMode>(defaultPreset.mode);
  const [item, setItem] = useState<ItemSpec>(defaultPreset.item);
  const [container, setContainer] = useState<ContainerSpec>(defaultPreset.container);
  const [arrangement, setArrangement] = useState<ArrangementConfig>(
    defaultPreset.arrangement
  );
  const [viewer, setViewer] = useState<ViewerConfig>({
    colorTheme: 'cad-classic',
    sizeDisplayMode: 'both',
    showDimensions: true,
    showOuterBox: false,
    outerBoxOpacity: 0.22,
    showEdges: true,
    showSpaceAnalysis: true,
    showClearance: true,
    showOverhang: true,
    interactionMode: 'orbit',
    explodedFactor: 0,
    visibleLayers: defaultPreset.arrangement.layers,
    cameraPreset: 'iso',
    backgroundStyle: 'cad-gray',
    customBgColor: '#d8dee9',
    ...defaultPreset.viewer,
  });

  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [captureTrigger, setCaptureTrigger] = useState(0);

  // Compute current packing placements and metrics
  const summary = useMemo(
    () => calculatePacking(mode, item, container, arrangement),
    [mode, item, container, arrangement]
  );

  // Compute ranked optimization recommendations
  const recommendations = useMemo(
    () => generateOptimalRecommendations(mode, item, container),
    [mode, item, container]
  );

  // Preset Selection Handler
  const handleSelectPreset = (preset: QuickPreset) => {
    setActivePresetId(preset.id);
    setMode(preset.mode);
    setItem({ ...preset.item });
    setContainer({ ...preset.container });
    setArrangement({ ...preset.arrangement });
    setViewer((prev) => ({
      ...prev,
      explodedFactor: 0,
      visibleLayers: preset.arrangement.layers,
      ...preset.viewer,
    }));
  };

  // Mode Switch Handler (Pallet vs Carton)
  const handleSelectMode = (nextMode: PackingMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (nextMode === 'carton') {
      // If switching to Carton mode, enable outer box visibility & keep custom container dimensions editable
      setViewer((prev) => ({
        ...prev,
        showOuterBox: true,
        colorTheme: item.shape === 'cylinder' ? 'carton-can' : prev.colorTheme,
        backgroundStyle:
          prev.backgroundStyle === 'cad-gray' ? 'clean-white' : prev.backgroundStyle,
      }));
      setContainer((prev) => ({
        ...prev,
        autoFitContainer: false,
      }));
    } else {
      // Switching to Pallet mode
      setViewer((prev) => ({
        ...prev,
        showOuterBox: false,
      }));
      setContainer((prev) => ({
        ...prev,
        width: prev.width < 600 ? 1100 : prev.width,
        depth: prev.depth < 600 ? 1100 : prev.depth,
        maxHeight: prev.maxHeight < 600 ? 1500 : prev.maxHeight,
        palletHeight: prev.palletHeight === 0 ? 150 : prev.palletHeight,
        autoFitContainer: false,
      }));
    }
  };

  const handleUpdateItem = (patch: Partial<ItemSpec>) => {
    setActivePresetId('custom');
    setItem((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateContainer = (patch: Partial<ContainerSpec>) => {
    setActivePresetId('custom');
    setContainer((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateArrangement = (patch: Partial<ArrangementConfig>) => {
    setActivePresetId('custom');
    setArrangement((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateViewer = (patch: Partial<ViewerConfig>) => {
    setViewer((prev) => ({ ...prev, ...patch }));
  };

  // Auto-fill Rows, Cols, Layers to fit current container dimensions
  const handleAutoFillContainer = () => {
    const pad = Math.max(0, container.padding || 0);
    const unitW = item.shape === 'cylinder' ? item.diameter : item.width;
    const unitD = item.shape === 'cylinder' ? item.diameter : item.depth;
    const usableH =
      mode === 'pallet'
        ? Math.max(item.height, container.maxHeight - container.palletHeight)
        : Math.max(item.height, container.maxHeight);

    const bestCols = Math.max(1, Math.floor((container.width + pad) / (unitW + pad)));
    const bestRows = Math.max(1, Math.floor((container.depth + pad) / (unitD + pad)));
    const bestLayers = Math.max(1, Math.floor(usableH / item.height));

    setContainer((prev) => ({ ...prev, autoFitContainer: false }));
    setArrangement((prev) => ({
      ...prev,
      cols: bestCols,
      rows: bestRows,
      layers: bestLayers,
    }));
    setViewer((prev) => ({ ...prev, visibleLayers: bestLayers }));
  };

  // Apply Recommendation from OptimizerModal
  const handleApplyRecommendation = (rec: OptimizationRecommendation) => {
    setActivePresetId('custom');
    if (rec.rotateBase && item.shape === 'box') {
      setItem((prev) => ({
        ...prev,
        width: prev.depth,
        depth: prev.width,
      }));
    }
    setContainer((prev) => ({
      ...prev,
      autoFitContainer: false,
    }));
    setArrangement((prev) => ({
      ...prev,
      pattern: rec.pattern,
      alternateLayers: rec.alternateLayers,
      rows: rec.rows,
      cols: rec.cols,
      layers: rec.layers,
      pinwheelPerQuad: rec.pinwheelPerQuad,
    }));
    setViewer((prev) => ({
      ...prev,
      visibleLayers: rec.layers,
    }));
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <TopBar
        mode={mode}
        onSelectMode={handleSelectMode}
        onOpenOptimizer={() => setIsOptimizerOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onCaptureImage={() => setCaptureTrigger((prev) => prev + 1)}
      />

      {/* Main Workspace (Sidebar + 3D Viewport) */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        <ConfigSidebar
          mode={mode}
          activePresetId={activePresetId}
          item={item}
          container={container}
          arrangement={arrangement}
          viewer={viewer}
          summary={summary}
          onSelectPreset={handleSelectPreset}
          onUpdateMode={handleSelectMode}
          onUpdateItem={handleUpdateItem}
          onUpdateContainer={handleUpdateContainer}
          onUpdateArrangement={handleUpdateArrangement}
          onUpdateViewer={handleUpdateViewer}
          onAutoFillContainer={handleAutoFillContainer}
          onOpenOptimizer={() => setIsOptimizerOpen(true)}
        />

        <PackingCanvas3D
          mode={mode}
          item={item}
          container={container}
          arrangement={arrangement}
          summary={summary}
          viewer={viewer}
          onUpdateViewer={handleUpdateViewer}
          onUpdateArrangement={handleUpdateArrangement}
          captureTrigger={captureTrigger}
        />
      </main>

      {/* Optimal Pattern Recommendation Modal */}
      <OptimizerModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        mode={mode}
        item={item}
        container={container}
        recommendations={recommendations}
        onApplyRecommendation={handleApplyRecommendation}
      />

      {/* Specification Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        mode={mode}
        item={item}
        container={container}
        arrangement={arrangement}
        summary={summary}
        onCaptureImage={() => setCaptureTrigger((prev) => prev + 1)}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
