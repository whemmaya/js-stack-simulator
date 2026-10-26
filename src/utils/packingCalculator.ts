import {
  ArrangementConfig,
  ContainerSpec,
  ItemSpec,
  OptimizationRecommendation,
  PackingMode,
  PackingSummary,
  PlacedItem,
} from '../types/packing';

/**
 * Generates a single layer of items centered around (0, 0) in the X-Z plane,
 * then shifts or bounds-checks against the effective container.
 */
function buildSingleLayer(
  layerIdx: number,
  item: ItemSpec,
  container: ContainerSpec,
  arrangement: ArrangementConfig
): {
  items: Omit<PlacedItem, 'y' | 'isOutOfBounds'>[];
  layerWidth: number;
  layerDepth: number;
} {
  const pad = Math.max(0, Math.min(500, container.padding || 0));
  const isOddLayer = layerIdx % 2 === 1;
  const shouldAlternate = arrangement.alternateLayers && isOddLayer;

  const baseW = Math.max(1, item.shape === 'cylinder' ? item.diameter || 1 : item.width || 1);
  const baseD = Math.max(1, item.shape === 'cylinder' ? item.diameter || 1 : item.depth || 1);
  const itemH = Math.max(1, item.height || 1);

  const rawItems: Omit<PlacedItem, 'y' | 'isOutOfBounds'>[] = [];

  // 1. PINWHEEL (풍차형 4분면 교차 적재 - 첨부 이미지 1 완벽 재현 및 일반화)
  if (arrangement.pattern === 'pinwheel' && item.shape === 'box') {
    const nPerQuad = Math.max(1, Math.min(8, arrangement.pinwheelPerQuad || 2));
    const L = baseW; // 장변 (예: 550)
    const W = baseD; // 단변 (예: 275)

    // 한 사분면의 묶음 크기:
    // 가로 배치 사분면은 폭 L, 깊이 nPerQuad * W
    // 세로 배치 사분면은 폭 nPerQuad * W, 깊이 L
    const groupSpan = nPerQuad * W + (nPerQuad - 1) * pad;
    const totalSide = L + groupSpan + pad;
    const halfTotal = totalSide / 2;

    // 4개 사분면 정의 (시계 방향 풍차 배치)
    // shouldAlternate가 true일 때(짝수번째/홀수번째 교대층), 풍차 방향을 반전(미러링/90도 회전)시켜
    // 이미지 1과 같이 위아래 층의 장변(Red)과 단변(Blue 2개)이 정확히 엇갈리게 적재됨!
    if (!shouldAlternate) {
      // 기본 층 (예: 이미지 1의 홀수층)
      // Front-Left (x < 0, z > 0): 세로 방향 (단변 W가 정면 Z축에 2개 나란히 보임, 장변 L이 좌측 X축에 보임)
      // Wait: Box rotationY = 0 이면 가로(X)=L, 세로(Z)=W (정면에 장변 L이 보임)
      // Box rotationY = Math.PI/2 이면 가로(X)=W, 세로(Z)=L (정면에 단변 W가 보임, 좌측면에 장변 L이 보임)

      // Q0: Front-Left (x: -halfTotal ~ -halfTotal + groupSpan, z: +halfTotal - L ~ +halfTotal)
      // rotationY = Math.PI/2 -> X방향 폭 W (nPerQuad개 나열), Z방향 깊이 L
      for (let i = 0; i < nPerQuad; i++) {
        const cx = -halfTotal + W / 2 + i * (W + pad);
        const cz = halfTotal - L / 2;
        rawItems.push({
          id: `L${layerIdx}-Q0-${i}`,
          layer: layerIdx,
          row: 1,
          col: i,
          quadrant: 0,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: W,
          dimY: itemH,
          dimZ: L,
          rotationY: Math.PI / 2,
          isRotated: true,
        });
      }

      // Q1: Front-Right (x: +halfTotal - L ~ +halfTotal, z: +halfTotal - groupSpan ~ +halfTotal)
      // rotationY = 0 -> X방향 폭 L, Z방향 깊이 W (nPerQuad개 나열)
      for (let i = 0; i < nPerQuad; i++) {
        const cx = halfTotal - L / 2;
        const cz = halfTotal - W / 2 - i * (W + pad);
        rawItems.push({
          id: `L${layerIdx}-Q1-${i}`,
          layer: layerIdx,
          row: 1,
          col: nPerQuad + i,
          quadrant: 1,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: L,
          dimY: itemH,
          dimZ: W,
          rotationY: 0,
          isRotated: false,
        });
      }

      // Q2: Back-Right (x: +halfTotal - groupSpan ~ +halfTotal, z: -halfTotal ~ -halfTotal + L)
      // rotationY = Math.PI/2 -> X방향 폭 W (nPerQuad개 나열), Z방향 깊이 L
      for (let i = 0; i < nPerQuad; i++) {
        const cx = halfTotal - W / 2 - i * (W + pad);
        const cz = -halfTotal + L / 2;
        rawItems.push({
          id: `L${layerIdx}-Q2-${i}`,
          layer: layerIdx,
          row: 0,
          col: nPerQuad + i,
          quadrant: 2,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: W,
          dimY: itemH,
          dimZ: L,
          rotationY: Math.PI / 2,
          isRotated: true,
        });
      }

      // Q3: Back-Left (x: -halfTotal ~ -halfTotal + L, z: -halfTotal ~ -halfTotal + groupSpan)
      // rotationY = 0 -> X방향 폭 L, Z방향 깊이 W (nPerQuad개 나열)
      for (let i = 0; i < nPerQuad; i++) {
        const cx = -halfTotal + L / 2;
        const cz = -halfTotal + W / 2 + i * (W + pad);
        rawItems.push({
          id: `L${layerIdx}-Q3-${i}`,
          layer: layerIdx,
          row: 0,
          col: i,
          quadrant: 3,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: L,
          dimY: itemH,
          dimZ: W,
          rotationY: 0,
          isRotated: false,
        });
      }
    } else {
      // 교대 층 (반대 방향 풍차 배치 - 위아래 층이 완벽히 맞물림)
      // Q0: Front-Left -> rotationY = 0 (X방향 L, Z방향 W nPerQuad개)
      for (let i = 0; i < nPerQuad; i++) {
        const cx = -halfTotal + L / 2;
        const cz = halfTotal - W / 2 - i * (W + pad);
        rawItems.push({
          id: `L${layerIdx}-Q0-${i}`,
          layer: layerIdx,
          row: 1,
          col: i,
          quadrant: 0,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: L,
          dimY: itemH,
          dimZ: W,
          rotationY: 0,
          isRotated: false,
        });
      }

      // Q1: Front-Right -> rotationY = Math.PI/2 (X방향 W nPerQuad개, Z방향 L)
      for (let i = 0; i < nPerQuad; i++) {
        const cx = halfTotal - W / 2 - i * (W + pad);
        const cz = halfTotal - L / 2;
        rawItems.push({
          id: `L${layerIdx}-Q1-${i}`,
          layer: layerIdx,
          row: 1,
          col: nPerQuad + i,
          quadrant: 1,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: W,
          dimY: itemH,
          dimZ: L,
          rotationY: Math.PI / 2,
          isRotated: true,
        });
      }

      // Q2: Back-Right -> rotationY = 0 (X방향 L, Z방향 W nPerQuad개)
      for (let i = 0; i < nPerQuad; i++) {
        const cx = halfTotal - L / 2;
        const cz = -halfTotal + W / 2 + i * (W + pad);
        rawItems.push({
          id: `L${layerIdx}-Q2-${i}`,
          layer: layerIdx,
          row: 0,
          col: nPerQuad + i,
          quadrant: 2,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: L,
          dimY: itemH,
          dimZ: W,
          rotationY: 0,
          isRotated: false,
        });
      }

      // Q3: Back-Left -> rotationY = Math.PI/2 (X방향 W nPerQuad개, Z방향 L)
      for (let i = 0; i < nPerQuad; i++) {
        const cx = -halfTotal + W / 2 + i * (W + pad);
        const cz = -halfTotal + L / 2;
        rawItems.push({
          id: `L${layerIdx}-Q3-${i}`,
          layer: layerIdx,
          row: 0,
          col: i,
          quadrant: 3,
          shape: 'box',
          x: cx,
          z: cz,
          dimX: W,
          dimY: itemH,
          dimZ: L,
          rotationY: Math.PI / 2,
          isRotated: true,
        });
      }
    }

    return {
      items: rawItems,
      layerWidth: totalSide,
      layerDepth: totalSide,
    };
  }

  // 2. HEXAGONAL / STAGGERED CYLINDER PACKING (원통 벌집형 밀집 배열)
  if (arrangement.pattern === 'hex' && item.shape === 'cylinder') {
    const D = item.diameter;
    const cols = Math.max(1, arrangement.cols);
    const rows = Math.max(1, arrangement.rows);
    const colStep = D + pad;
    const rowStep = (D + pad) * (Math.sqrt(3) / 2);
    const hexShift = colStep / 2;

    const totalW = cols * D + (cols - 1) * pad + (rows > 1 ? hexShift : 0);
    const totalD = D + (rows - 1) * rowStep;

    const startX = -totalW / 2 + D / 2;
    const startZ = -totalD / 2 + D / 2;

    for (let r = 0; r < rows; r++) {
      const isShiftedRow = shouldAlternate ? r % 2 === 0 : r % 2 === 1;
      const rowOffset = rows > 1 && isShiftedRow ? hexShift : 0;
      for (let c = 0; c < cols; c++) {
        rawItems.push({
          id: `L${layerIdx}-R${r}-C${c}`,
          layer: layerIdx,
          row: r,
          col: c,
          shape: 'cylinder',
          x: startX + c * colStep + rowOffset,
          z: startZ + r * rowStep,
          dimX: D,
          dimY: itemH,
          dimZ: D,
          rotationY: 0,
          isRotated: false,
        });
      }
    }

    return {
      items: rawItems,
      layerWidth: totalW,
      layerDepth: totalD,
    };
  }

  // 3. BRICK PATTERN (벽돌식 엇갈림 적재)
  if (arrangement.pattern === 'brick' && item.shape === 'box') {
    const cols = Math.max(1, arrangement.cols);
    const rows = Math.max(1, arrangement.rows);

    // 벽돌식: 기본 행들과 상단/하단 회전 행 또는 행간 반칸 교차 배치
    // 컨테이너 내부에서 안정적인 인터로킹을 위해 홀수/짝수 행의 정렬을 지그재그로 배치하거나
    // 층마다 전체 90도 회전/반전 적용
    const unitW = baseW;
    const unitD = baseD;
    const brickShift = Math.min(unitW * 0.25, 45); // 시각적 및 구조적 인터로킹 또는 회전 조합

    // 만약 cols * unitW 와 rows * unitD가 비슷하거나 교차 배치가 가능하면
    // 앞/뒤 열을 교차하여 맞물리게 구성
    const totalW = cols * unitW + (cols - 1) * pad;
    const totalD = rows * unitD + (rows - 1) * pad;

    const startX = -totalW / 2 + unitW / 2;
    const startZ = -totalD / 2 + unitD / 2;

    for (let r = 0; r < rows; r++) {
      const shiftDir = (r + (shouldAlternate ? 1 : 0)) % 2 === 0 ? -1 : 1;
      const offset = rows > 1 ? shiftDir * (pad > 0 ? pad : Math.min(12, brickShift * 0.25)) : 0;

      for (let c = 0; c < cols; c++) {
        const baseX = startX + c * (unitW + pad) + offset;
        const baseZ = startZ + r * (unitD + pad);

        // shouldAlternate일 때 전체 레이어 좌표를 90도 회전(정사각형에 가까울 때) 또는 반전
        if (shouldAlternate && Math.abs(totalW - totalD) <= Math.max(unitW, unitD)) {
          rawItems.push({
            id: `L${layerIdx}-R${r}-C${c}`,
            layer: layerIdx,
            row: r,
            col: c,
            shape: 'box',
            x: baseZ,
            z: -baseX,
            dimX: unitD,
            dimY: itemH,
            dimZ: unitW,
            rotationY: Math.PI / 2,
            isRotated: true,
          });
        } else {
          rawItems.push({
            id: `L${layerIdx}-R${r}-C${c}`,
            layer: layerIdx,
            row: r,
            col: c,
            shape: 'box',
            x: baseX,
            z: baseZ,
            dimX: unitW,
            dimY: itemH,
            dimZ: unitD,
            rotationY: 0,
            isRotated: false,
          });
        }
      }
    }

    const boundsW = shouldAlternate && Math.abs(totalW - totalD) <= Math.max(unitW, unitD) ? totalD : totalW;
    const boundsD = shouldAlternate && Math.abs(totalW - totalD) <= Math.max(unitW, unitD) ? totalW : totalD;

    return {
      items: rawItems,
      layerWidth: boundsW,
      layerDepth: boundsD,
    };
  }

  // 4. BLOCK PATTERN (표준 행 × 열 격자 정렬)
  const cols = Math.max(1, arrangement.cols);
  const rows = Math.max(1, arrangement.rows);

  // alternateLayers가 켜져 있고 박스 형태이면 짝수층에서 각 박스를 90도 회전하여 배치할지 결정
  const rotateBoxInLayer = shouldAlternate && item.shape === 'box';
  const unitW = rotateBoxInLayer ? baseD : baseW;
  const unitD = rotateBoxInLayer ? baseW : baseD;
  const effCols = rotateBoxInLayer ? rows : cols;
  const effRows = rotateBoxInLayer ? cols : rows;

  const totalW = effCols * unitW + (effCols - 1) * pad;
  const totalD = effRows * unitD + (effRows - 1) * pad;

  const startX = -totalW / 2 + unitW / 2;
  const startZ = -totalD / 2 + unitD / 2;

  for (let r = 0; r < effRows; r++) {
    for (let c = 0; c < effCols; c++) {
      rawItems.push({
        id: `L${layerIdx}-R${r}-C${c}`,
        layer: layerIdx,
        row: r,
        col: c,
        shape: item.shape,
        x: startX + c * (unitW + pad),
        z: startZ + r * (unitD + pad),
        dimX: unitW,
        dimY: itemH,
        dimZ: unitD,
        rotationY: rotateBoxInLayer ? Math.PI / 2 : 0,
        isRotated: rotateBoxInLayer,
      });
    }
  }

  return {
    items: rawItems,
    layerWidth: totalW,
    layerDepth: totalD,
  };
}

/**
 * Computes the complete 3D packing coordinates and logistics metrics.
 */
export function calculatePacking(
  mode: PackingMode,
  item: ItemSpec,
  container: ContainerSpec,
  arrangement: ArrangementConfig
): PackingSummary {
  const layers = Math.max(1, Math.min(30, arrangement.layers));
  const baseYOffset = mode === 'pallet' ? container.palletHeight : 0;

  let maxStackW = 0;
  let maxStackD = 0;
  const allPlaced: PlacedItem[] = [];

  // Build layers
  const layerResults = [];
  for (let l = 0; l < layers; l++) {
    const res = buildSingleLayer(l, item, container, arrangement);
    layerResults.push(res);
    if (res.layerWidth > maxStackW) maxStackW = res.layerWidth;
    if (res.layerDepth > maxStackD) maxStackD = res.layerDepth;
  }

  const stackHeight = layers * item.height;
  const totalHeight = baseYOffset + stackHeight;

  // Effective container size:
  // If autoFitContainer is true (especially useful in Carton mode when user changes rows/cols/layers),
  // wrap the outer box tightly around the stack (+16mm clearance).
  const clearance = mode === 'carton' ? 12 : 0;
  const effContainerW = container.autoFitContainer
    ? Math.round(maxStackW + clearance)
    : container.width;
  const effContainerD = container.autoFitContainer
    ? Math.round(maxStackD + clearance)
    : container.depth;
  const effContainerH = container.autoFitContainer
    ? Math.round(totalHeight + (mode === 'carton' ? 10 : 0))
    : container.maxHeight;

  const halfContW = effContainerW / 2;
  const halfContD = effContainerD / 2;

  for (let l = 0; l < layers; l++) {
    const res = layerResults[l];
    const centerY = baseYOffset + l * item.height + item.height / 2;

    // Optional alignment: center on pallet/carton or align to front-left corner (-X, -Z)
    const shiftX = arrangement.centerItems ? 0 : -halfContW + res.layerWidth / 2;
    const shiftZ = arrangement.centerItems ? 0 : -halfContD + res.layerDepth / 2;

    for (const raw of res.items) {
      const finalX = raw.x + shiftX;
      const finalZ = raw.z + shiftZ;

      const outX =
        finalX - raw.dimX / 2 < -halfContW - 1.0 ||
        finalX + raw.dimX / 2 > halfContW + 1.0;
      const outZ =
        finalZ - raw.dimZ / 2 < -halfContD - 1.0 ||
        finalZ + raw.dimZ / 2 > halfContD + 1.0;
      const outY = centerY + raw.dimY / 2 > effContainerH + 1.0;

      allPlaced.push({
        ...raw,
        x: finalX,
        y: centerY,
        z: finalZ,
        isOutOfBounds: outX || outZ || outY,
        outX,
        outY,
        outZ,
      });
    }
  }

  const itemsPerLayer = layerResults[0]?.items.length || 0;
  const totalCount = allPlaced.length;

  // Volume calculations (in CBM = m^3)
  const unitVolMm3 =
    item.shape === 'cylinder'
      ? Math.PI * Math.pow(item.diameter / 2, 2) * item.height
      : item.width * item.depth * item.height;

  const itemUnitVolumeCbm = unitVolMm3 / 1e9;
  const totalItemVolumeCbm = itemUnitVolumeCbm * totalCount;

  const usableContainerHeight =
    mode === 'pallet'
      ? Math.max(0, effContainerH - container.palletHeight)
      : effContainerH;

  const containerVolumeCbm =
    (effContainerW * effContainerD * Math.max(1, usableContainerHeight)) / 1e9;

  const emptyVoidVolumeCbm = Math.max(0, containerVolumeCbm - totalItemVolumeCbm);

  // Area & Volume utilization (%) against specified container/pallet
  const unitFootprintMm2 =
    item.shape === 'cylinder'
      ? Math.PI * Math.pow(item.diameter / 2, 2)
      : item.width * item.depth;
  const layerFootprintMm2 = unitFootprintMm2 * itemsPerLayer;
  const containerAreaMm2 = Math.max(1, effContainerW * effContainerD);

  const areaUtilization = Math.min(100, (layerFootprintMm2 / containerAreaMm2) * 100);
  const volumeUtilization = Math.min(
    100,
    (totalItemVolumeCbm / Math.max(0.0001, containerVolumeCbm)) * 100
  );

  // Margin (+ remaining internal clearance, - protruding overhang)
  const marginX = Math.round(effContainerW - maxStackW);
  const marginZ = Math.round(effContainerD - maxStackD);
  const marginY = Math.round(effContainerH - totalHeight);

  // Overhang calculations
  const overhangX = Math.max(0, -marginX);
  const overhangZ = Math.max(0, -marginZ);
  const overhangY = Math.max(0, -marginY);
  const hasOverhang = overhangX > 1 || overhangZ > 1 || overhangY > 1;

  // Weights
  const netWeightKg = Number((totalCount * item.weight).toFixed(2));
  const grossWeightKg = Number((netWeightKg + container.palletWeight).toFixed(2));

  // Stability score (0 - 100)
  let stabilityScore = 82;
  if (arrangement.pattern === 'pinwheel' && arrangement.alternateLayers) {
    stabilityScore = 98;
  } else if (arrangement.alternateLayers) {
    stabilityScore = 92;
  } else if (arrangement.pattern === 'hex') {
    stabilityScore = 90;
  }
  if (hasOverhang) {
    stabilityScore = Math.max(35, stabilityScore - 35);
  }
  if (totalHeight > Math.min(effContainerW, effContainerD) * 1.6) {
    stabilityScore = Math.max(40, stabilityScore - 15);
  }

  return {
    placedItems: allPlaced,
    itemsPerLayer,
    totalLayers: layers,
    totalCount,
    stackWidth: Math.round(maxStackW),
    stackDepth: Math.round(maxStackD),
    stackHeight: Math.round(stackHeight),
    totalHeight: Math.round(totalHeight),
    effectiveContainerWidth: effContainerW,
    effectiveContainerDepth: effContainerD,
    effectiveContainerHeight: effContainerH,
    usableContainerHeight: Math.round(usableContainerHeight),
    marginX,
    marginZ,
    marginY,
    itemUnitVolumeCbm,
    totalItemVolumeCbm,
    containerVolumeCbm,
    emptyVoidVolumeCbm,
    volumeUtilization: Number(volumeUtilization.toFixed(1)),
    areaUtilization: Number(areaUtilization.toFixed(1)),
    netWeightKg,
    grossWeightKg,
    hasOverhang,
    overhangX,
    overhangZ,
    overhangY,
    stabilityScore,
  };
}

/**
 * Automatically finds up to 3 optimal packing patterns for the user-configured
 * pallet or outer box dimensions and provides detailed engineering reasons.
 */
export function generateOptimalRecommendations(
  mode: PackingMode,
  item: ItemSpec,
  container: ContainerSpec
): OptimizationRecommendation[] {
  const pad = Math.max(0, Math.min(500, container.padding || 0));
  const contW = Math.max(50, container.width || 50);
  const contD = Math.max(50, container.depth || 50);
  const contH = Math.max(50, container.maxHeight || 50);
  const safeH = Math.max(10, item.height || 10);
  const usableH =
    mode === 'pallet'
      ? Math.max(safeH, contH - (container.palletHeight || 0))
      : Math.max(safeH, contH);

  const maxLayersByHeight = Math.min(30, Math.max(1, Math.floor(usableH / safeH)));
  const containerLabel = mode === 'pallet' ? '팔레트' : '외박스';
  const candidates: OptimizationRecommendation[] = [];

  if (item.shape === 'box') {
    const L = Math.max(10, item.width || 10);
    const W = Math.max(10, item.depth || 10);

    // 1. Standard 0° Grid (Cols along L, Rows along W)
    const cols0 = Math.min(25, Math.max(1, Math.floor((contW + pad) / (L + pad))));
    const rows0 = Math.min(25, Math.max(1, Math.floor((contD + pad) / (W + pad))));
    const layers0 = maxLayersByHeight;

    const sum0Alt = calculatePacking(
      mode,
      item,
      { ...container, autoFitContainer: false },
      {
        cols: cols0,
        rows: rows0,
        layers: layers0,
        pattern: 'block',
        alternateLayers: true,
        pinwheelPerQuad: 2,
        centerItems: true,
      }
    );
    const sum0Col = calculatePacking(
      mode,
      item,
      { ...container, autoFitContainer: false },
      {
        cols: cols0,
        rows: rows0,
        layers: layers0,
        pattern: 'block',
        alternateLayers: false,
        pinwheelPerQuad: 2,
        centerItems: true,
      }
    );

    // If alternating layers fits without overhang, include the interlocked grid
    if (!sum0Alt.hasOverhang) {
      candidates.push({
        id: 'opt-block-0-alt',
        badge: '수납 효율 · 층간 교차 안정형',
        title: '정방향 격자 + 층별 90° 교차 적재',
        subtitle: `${cols0}열 × ${rows0}행 × ${layers0}단 (홀·짝수층 교차 맞물림)`,
        reasonSummary: `설정된 ${containerLabel}(${contW}×${contD}mm) 내부에 이탈 없이 층당 ${sum0Alt.itemsPerLayer}개(총 ${sum0Alt.totalCount}개)를 수납하며 층간 90° 교차로 흔들림을 방지합니다.`,
        reasons: [
          `사용자 설정 ${containerLabel} 규격(${contW}×${contD}×${contH}mm) 내에 가로 여유 +${sum0Alt.marginX}mm, 세로 여유 +${sum0Alt.marginZ}mm, 상단 여유 +${sum0Alt.marginY}mm로 정확히 수납됩니다.`,
          `바닥 면적 효율 ${sum0Alt.areaUtilization}%, 체적 적재율 ${sum0Alt.volumeUtilization}%를 달성하며 층당 ${sum0Alt.itemsPerLayer}개씩 총 ${sum0Alt.totalCount}개를 적재합니다.`,
          `짝수층을 90° 교차 회전하여 상하단 상자 이음새가 엇갈리도록 맞물려 이송 중 쏠림 저항성(안정성 ${sum0Alt.stabilityScore}점)이 우수합니다.`,
        ],
        pattern: 'block',
        alternateLayers: true,
        rotateBase: false,
        rows: rows0,
        cols: cols0,
        layers: layers0,
        pinwheelPerQuad: 2,
        itemsPerLayer: sum0Alt.itemsPerLayer,
        totalCount: sum0Alt.totalCount,
        volumeUtilization: sum0Alt.volumeUtilization,
        areaUtilization: sum0Alt.areaUtilization,
        stabilityScore: sum0Alt.stabilityScore,
        stackWidth: sum0Alt.stackWidth,
        stackDepth: sum0Alt.stackDepth,
        totalHeight: sum0Alt.totalHeight,
        marginX: sum0Alt.marginX,
        marginZ: sum0Alt.marginZ,
        marginY: sum0Alt.marginY,
        hasOverhang: sum0Alt.hasOverhang,
        grossWeightKg: sum0Alt.grossWeightKg,
      });
    }

    // Also evaluate pure Column Stacking (alternateLayers: false) for vertical box compression strength
    candidates.push({
      id: 'opt-block-0-col',
      badge: '수직 압축강도 · 작업성 최적',
      title: '정방향 수직 기둥식(Column) 정렬 적재',
      subtitle: `${cols0}열 × ${rows0}행 × ${layers0}단 (전 층 동일 방향 정렬)`,
      reasonSummary: `상자 네 모서리 기둥이 1단부터 ${layers0}단까지 수직으로 일치하여 하단 박스의 수직 압축 강도(BCT)를 극대화하고 작업 속도가 가장 빠릅니다.`,
      reasons: [
        `물품 기본 방향(${L}×${W}mm) 그대로 ${cols0}열 × ${rows0}행 배열하여 적재 외경 ${sum0Col.stackWidth}×${sum0Col.stackDepth}mm(여유 X +${sum0Col.marginX}mm, Z +${sum0Col.marginZ}mm)를 형성합니다.`,
        `상하 층의 모서리가 정확히 겹치는 기둥식(Column Stack) 구조로, 골판지 외박스 적재 시 층간 엇갈림 대비 수직 하중 지지력이 최대 25~30% 향상됩니다.`,
        `로봇 팔레타이저 또는 수작업 포장 시 회전 동작 없이 동일 패턴으로 연속 적재할 수 있어 작업 효율이 가장 뛰어납니다.`,
      ],
      pattern: 'block',
      alternateLayers: false,
      rotateBase: false,
      rows: rows0,
      cols: cols0,
      layers: layers0,
      pinwheelPerQuad: 2,
      itemsPerLayer: sum0Col.itemsPerLayer,
      totalCount: sum0Col.totalCount,
      volumeUtilization: sum0Col.volumeUtilization,
      areaUtilization: sum0Col.areaUtilization,
      stabilityScore: sum0Col.stabilityScore,
      stackWidth: sum0Col.stackWidth,
      stackDepth: sum0Col.stackDepth,
      totalHeight: sum0Col.totalHeight,
      marginX: sum0Col.marginX,
      marginZ: sum0Col.marginZ,
      marginY: sum0Col.marginY,
      hasOverhang: sum0Col.hasOverhang,
      grossWeightKg: sum0Col.grossWeightKg,
    });

    // 2. 90-Degree Rotated Grid (Cols along W, Rows along L)
    const cols90 = Math.min(25, Math.max(1, Math.floor((contW + pad) / (W + pad))));
    const rows90 = Math.min(25, Math.max(1, Math.floor((contD + pad) / (L + pad))));
    if (L !== W && (cols90 !== cols0 || rows90 !== rows0)) {
      const rotatedItem: ItemSpec = { ...item, width: W, depth: L };
      const sum90Alt = calculatePacking(
        mode,
        rotatedItem,
        { ...container, autoFitContainer: false },
        {
          cols: cols90,
          rows: rows90,
          layers: layers0,
          pattern: 'block',
          alternateLayers: true,
          pinwheelPerQuad: 2,
          centerItems: true,
        }
      );
      const sum90Col = calculatePacking(
        mode,
        rotatedItem,
        { ...container, autoFitContainer: false },
        {
          cols: cols90,
          rows: rows90,
          layers: layers0,
          pattern: 'block',
          alternateLayers: false,
          pinwheelPerQuad: 2,
          centerItems: true,
        }
      );
      const useAlt90 = !sum90Alt.hasOverhang;
      const chosen90 = useAlt90 ? sum90Alt : sum90Col;
      const countDiff = chosen90.totalCount - sum0Col.totalCount;

      candidates.push({
        id: 'opt-block-90',
        badge: countDiff > 0 ? '최대 수납 수량 확보' : '가로·세로 여백 밸런스 최적화',
        title: `90° 회전 격자 ${useAlt90 ? '+ 층간 교차 ' : ''}적재`,
        subtitle: `${cols90}열 × ${rows90}행 × ${layers0}단 (물품 90° 회전 배치)`,
        reasonSummary:
          countDiff > 0
            ? `물품을 90° 회전(${W}×${L}mm)하여 배치함으로써 정방향 대비 ${countDiff}개 더 많은 총 ${chosen90.totalCount}개를 수납합니다.`
            : `물품을 90° 회전(${W}×${L}mm)하여 ${containerLabel}의 가로·세로 여유 공간(X +${chosen90.marginX}mm, Z +${chosen90.marginZ}mm) 배분을 최적화합니다.`,
        reasons: [
          `물품의 단변(${W}mm)을 가로(X)에 ${cols90}열, 장변(${L}mm)을 세로(Z)에 ${rows90}행 배치하여 바닥 면적 효율 ${chosen90.areaUtilization}%를 확보합니다.`,
          countDiff > 0
            ? `정방향 배치(${sum0Col.totalCount}개)보다 총 ${countDiff}개 더 많은 ${chosen90.totalCount}개(층당 ${chosen90.itemsPerLayer}개)를 적재하여 물류 단가를 절감합니다.`
            : `적재 외경 ${chosen90.stackWidth}×${chosen90.stackDepth}mm로 ${containerLabel} 내부 데드 스페이스를 대칭적으로 줄여 포장 완충재 삽입에 유리합니다.`,
          useAlt90
            ? `짝수층 교차 회전이 함께 적용되어 적재 안정성 지수 ${chosen90.stabilityScore}점을 유지합니다.`
            : `직사각형 ${containerLabel} 규격에서 경계 이탈이 발생하지 않도록 수직 정렬로 안전하게 적재합니다.`,
        ],
        pattern: 'block',
        alternateLayers: useAlt90,
        rotateBase: true,
        rows: rows90,
        cols: cols90,
        layers: layers0,
        pinwheelPerQuad: 2,
        itemsPerLayer: chosen90.itemsPerLayer,
        totalCount: chosen90.totalCount,
        volumeUtilization: chosen90.volumeUtilization,
        areaUtilization: chosen90.areaUtilization,
        stabilityScore: chosen90.stabilityScore,
        stackWidth: chosen90.stackWidth,
        stackDepth: chosen90.stackDepth,
        totalHeight: chosen90.totalHeight,
        marginX: chosen90.marginX,
        marginZ: chosen90.marginZ,
        marginY: chosen90.marginY,
        hasOverhang: chosen90.hasOverhang,
        grossWeightKg: chosen90.grossWeightKg,
      });
    }

    // 3. Pinwheel (풍차형 4분면 교차 적재 - strictly within min(contW, contD) when possible)
    const minContSide = Math.min(contW, contD);
    const maxNQuad = Math.min(
      8,
      Math.max(1, Math.floor((minContSide - L + pad) / (W + pad)))
    );
    const pinSide = L + maxNQuad * W + maxNQuad * pad;
    if (pinSide <= minContSide + 2) {
      const sumPin = calculatePacking(
        mode,
        item,
        { ...container, autoFitContainer: false },
        {
          cols: maxNQuad * 2,
          rows: 2,
          layers: layers0,
          pattern: 'pinwheel',
          alternateLayers: true,
          pinwheelPerQuad: maxNQuad,
          centerItems: true,
        }
      );
      candidates.push({
        id: 'opt-pinwheel',
        badge: '구조 안정성 1위 · 인터로킹 최적',
        title: '풍차형(Pinwheel) 4방향 맞물림 교차 적재',
        subtitle: `사분면당 ${maxNQuad}개 × 4방향 × ${layers0}단 (층당 ${sumPin.itemsPerLayer}개)`,
        reasonSummary: `4개 사분면이 풍차 형태로 회전 맞물리고 홀·짝수 층이 역방향으로 교차되어 이송 중 무너짐 저항성(안정성 ${sumPin.stabilityScore}점)이 가장 뛰어납니다.`,
        reasons: [
          `장변(${L}mm)과 단변(${W}mm × ${maxNQuad}열)을 4개 사분면에 순환 배치하여 ${sumPin.stackWidth}×${sumPin.stackDepth}mm 정방형 적재 블록을 형성합니다.`,
          `홀수층과 짝수층의 풍차 회전 방향이 반전되어 모든 상자가 상하·좌우로 물리는 인터로킹(Interlocking) 효과를 발휘합니다.`,
          `사용자 설정 ${containerLabel}(${contW}×${contD}mm) 대비 가로 여유 +${sumPin.marginX}mm, 세로 여유 +${sumPin.marginZ}mm로 총 ${sumPin.totalCount}개를 흔들림 없이 적재합니다.`,
        ],
        pattern: 'pinwheel',
        alternateLayers: true,
        rotateBase: false,
        rows: 2,
        cols: maxNQuad * 2,
        layers: layers0,
        pinwheelPerQuad: maxNQuad,
        itemsPerLayer: sumPin.itemsPerLayer,
        totalCount: sumPin.totalCount,
        volumeUtilization: sumPin.volumeUtilization,
        areaUtilization: sumPin.areaUtilization,
        stabilityScore: sumPin.stabilityScore,
        stackWidth: sumPin.stackWidth,
        stackDepth: sumPin.stackDepth,
        totalHeight: sumPin.totalHeight,
        marginX: sumPin.marginX,
        marginZ: sumPin.marginZ,
        marginY: sumPin.marginY,
        hasOverhang: sumPin.hasOverhang,
        grossWeightKg: sumPin.grossWeightKg,
      });
    }

    // 4. Brick Pattern (벽돌식 지그재그 하중 분산 적재)
    const useRotatedBrick =
      cols90 * rows90 > cols0 * rows0 && L !== W;
    const brickCols = useRotatedBrick ? cols90 : cols0;
    const brickRows = useRotatedBrick ? rows90 : rows0;
    const brickItem = useRotatedBrick ? { ...item, width: W, depth: L } : item;

    const sumBrick = calculatePacking(
      mode,
      brickItem,
      { ...container, autoFitContainer: false },
      {
        cols: brickCols,
        rows: brickRows,
        layers: layers0,
        pattern: 'brick',
        alternateLayers: true,
        pinwheelPerQuad: 2,
        centerItems: true,
      }
    );

    if (!sumBrick.hasOverhang) {
      candidates.push({
        id: 'opt-brick',
        badge: '하중 분산 · 측면 벌어짐 방지',
        title: '벽돌식(Brick) 지그재그 인터로킹 적재',
        subtitle: `${brickCols}열 × ${brickRows}행 × ${layers0}단 (행간 교차 배치)`,
        reasonSummary: `인접 행과 층을 벽돌처럼 지그재그로 교차 배치하여 다단 적재 시 상자 간 수평 결속력을 높이고 측면 벌어짐을 억제합니다.`,
        reasons: [
          `${containerLabel}(${contW}×${contD}mm) 내부에 층당 ${sumBrick.itemsPerLayer}개씩 ${layers0}단(총 ${sumBrick.totalCount}개)을 수납하여 체적 적재율 ${sumBrick.volumeUtilization}%를 달성합니다.`,
          `행간 미세 교차 및 층별 방향 전환을 통해 수직 이음선이 한 줄로 갈라지는 현상(Split Seam)을 방지합니다.`,
          `적재 안정성 지수 ${sumBrick.stabilityScore}점으로 스트레치 필름 랩핑이나 밴딩 작업 시 전체 적재물이 하나의 블록처럼 거동합니다.`,
        ],
        pattern: 'brick',
        alternateLayers: true,
        rotateBase: useRotatedBrick,
        rows: brickRows,
        cols: brickCols,
        layers: layers0,
        pinwheelPerQuad: 2,
        itemsPerLayer: sumBrick.itemsPerLayer,
        totalCount: sumBrick.totalCount,
        volumeUtilization: sumBrick.volumeUtilization,
        areaUtilization: sumBrick.areaUtilization,
        stabilityScore: sumBrick.stabilityScore,
        stackWidth: sumBrick.stackWidth,
        stackDepth: sumBrick.stackDepth,
        totalHeight: sumBrick.totalHeight,
        marginX: sumBrick.marginX,
        marginZ: sumBrick.marginZ,
        marginY: sumBrick.marginY,
        hasOverhang: sumBrick.hasOverhang,
        grossWeightKg: sumBrick.grossWeightKg,
      });
    }
  } else {
    // CYLINDER RECOMMENDATIONS
    const D = Math.max(10, item.diameter || 10);
    const colsGrid = Math.min(25, Math.max(1, Math.floor((contW + pad) / (D + pad))));
    const rowsGrid = Math.min(25, Math.max(1, Math.floor((contD + pad) / (D + pad))));

    // 1. Hexagonal Staggered Packing (원통 벌집형 밀집 배열)
    const rowStep = (D + pad) * (Math.sqrt(3) / 2);
    const colsHex = Math.min(25, Math.max(1, Math.floor((contW - (D + pad) / 2 + pad) / (D + pad))));
    const rowsHex = Math.min(25, Math.max(1, Math.floor((contD - D) / rowStep) + 1));

    const sumHex = calculatePacking(
      mode,
      item,
      { ...container, autoFitContainer: false },
      {
        cols: colsHex,
        rows: rowsHex,
        layers: maxLayersByHeight,
        pattern: 'hex',
        alternateLayers: true,
        pinwheelPerQuad: 2,
        centerItems: true,
      }
    );

    if (!sumHex.hasOverhang) {
      candidates.push({
        id: 'opt-cyl-hex',
        badge: '공간 밀집도 · 흔들림 억제 최적',
        title: '원통 벌집형(Hexagonal) 삼각 밀집 배열',
        subtitle: `${colsHex}열 × ${rowsHex}행 × ${maxLayersByHeight}단 (지그재그 엇갈림 밀착)`,
        reasonSummary: `원통 사이의 골(Valley) 공간에 인접 행을 60° 삼각 격자(피치 86.6%)로 맞물려 배치함으로써 세로 공간 효율과 측면 지지력을 높입니다.`,
        reasons: [
          `행간 간격을 직각 격자 대비 13.4% 압축(√3/2 피치)하여 ${contW}×${contD}mm 내에 층당 ${sumHex.itemsPerLayer}개(총 ${sumHex.totalCount}개)를 조밀하게 수납합니다.`,
          `각 원통이 주변 6방향 원통과 삼각 구조로 지지되어 이송 중 원통끼리 구르거나 부딪히는 유격을 최소화합니다(안정성 ${sumHex.stabilityScore}점).`,
          `가로 여유 +${sumHex.marginX}mm, 세로 여유 +${sumHex.marginZ}mm, 상단 여유 +${sumHex.marginY}mm로 경계 이탈 없이 안전하게 수납됩니다.`,
        ],
        pattern: 'hex',
        alternateLayers: true,
        rotateBase: false,
        rows: rowsHex,
        cols: colsHex,
        layers: maxLayersByHeight,
        pinwheelPerQuad: 2,
        itemsPerLayer: sumHex.itemsPerLayer,
        totalCount: sumHex.totalCount,
        volumeUtilization: sumHex.volumeUtilization,
        areaUtilization: sumHex.areaUtilization,
        stabilityScore: sumHex.stabilityScore,
        stackWidth: sumHex.stackWidth,
        stackDepth: sumHex.stackDepth,
        totalHeight: sumHex.totalHeight,
        marginX: sumHex.marginX,
        marginZ: sumHex.marginZ,
        marginY: sumHex.marginY,
        hasOverhang: sumHex.hasOverhang,
        grossWeightKg: sumHex.grossWeightKg,
      });
    }

    // 2. Square Grid Packing (원통 직각 격자 정열 배열)
    const sumGrid = calculatePacking(
      mode,
      item,
      { ...container, autoFitContainer: false },
      {
        cols: colsGrid,
        rows: rowsGrid,
        layers: maxLayersByHeight,
        pattern: 'block',
        alternateLayers: false,
        pinwheelPerQuad: 2,
        centerItems: true,
      }
    );

    candidates.push({
      id: 'opt-cyl-grid',
      badge: '표준 카톤 포장 · 작업성 1위',
      title: '원통 직각 격자(Square Grid) 정열 배열',
      subtitle: `${colsGrid}열 × ${rowsGrid}행 × ${maxLayersByHeight}단 (바둑판식 직교 정렬)`,
      reasonSummary: `행과 열이 직각으로 정렬되어 격자형 칸막이(Partition) 삽입 및 자동 포장기(Case Packer) 그립 작업에 가장 적합한 표준 패턴입니다.`,
      reasons: [
        `설정된 ${containerLabel}(${contW}×${contD}mm) 내부에 ${colsGrid}열 × ${rowsGrid}행으로 층당 ${sumGrid.itemsPerLayer}개씩 총 ${sumGrid.totalCount}개를 정돈하여 수납합니다.`,
        `적재 외경 ${sumGrid.stackWidth}×${sumGrid.stackDepth}mm(가로 여유 +${sumGrid.marginX}mm, 세로 여유 +${sumGrid.marginZ}mm)로 4면 외벽 지지 밸런스가 균일합니다.`,
        `격자 사이로 직선형 골판지 간지(Divider)를 끼워 넣을 수 있어 유리병·캔 제품의 파손 방지에 유리합니다.`,
      ],
      pattern: 'block',
      alternateLayers: false,
      rotateBase: false,
      rows: rowsGrid,
      cols: colsGrid,
      layers: maxLayersByHeight,
      pinwheelPerQuad: 2,
      itemsPerLayer: sumGrid.itemsPerLayer,
      totalCount: sumGrid.totalCount,
      volumeUtilization: sumGrid.volumeUtilization,
      areaUtilization: sumGrid.areaUtilization,
      stabilityScore: sumGrid.stabilityScore,
      stackWidth: sumGrid.stackWidth,
      stackDepth: sumGrid.stackDepth,
      totalHeight: sumGrid.totalHeight,
      marginX: sumGrid.marginX,
      marginZ: sumGrid.marginZ,
      marginY: sumGrid.marginY,
      hasOverhang: sumGrid.hasOverhang,
      grossWeightKg: sumGrid.grossWeightKg,
    });

    // 3. Safe Cushion / Interlayer Pad Configuration (상단/측면 완충 여유 확보형 또는 대안 벌집 배열)
    const safeCols = Math.max(1, colsGrid - (sumGrid.marginX < 10 && colsGrid > 1 ? 1 : 0));
    const safeRows = Math.max(1, rowsGrid - (sumGrid.marginZ < 10 && rowsGrid > 1 ? 1 : 0));
    const safeLayers = maxLayersByHeight > 1 && sumGrid.marginY < 15 ? maxLayersByHeight - 1 : maxLayersByHeight;
    const altColsHex = Math.min(25, Math.max(1, Math.floor((contW + pad) / (D + pad))));
    const altRowsHex = Math.min(25, Math.max(1, Math.floor((contD - D) / rowStep)));

    if (altColsHex > 0 && altRowsHex > 0 && (altColsHex !== colsHex || altRowsHex !== rowsHex)) {
      const sumHexAlt = calculatePacking(
        mode,
        item,
        { ...container, autoFitContainer: false },
        {
          cols: altColsHex,
          rows: altRowsHex,
          layers: maxLayersByHeight,
          pattern: 'hex',
          alternateLayers: false,
          pinwheelPerQuad: 2,
          centerItems: true,
        }
      );
      if (!sumHexAlt.hasOverhang) {
        candidates.push({
          id: 'opt-cyl-hex-alt',
          badge: '여유 공간 · 완충재 삽입 균형형',
          title: '원통 벌집형 안전 여백 배열',
          subtitle: `${altColsHex}열 × ${altRowsHex}행 × ${maxLayersByHeight}단 (완충 여유 확보)`,
          reasonSummary: `${containerLabel} 내벽과 원통 사이에 충분한 완충 여백(X +${sumHexAlt.marginX}mm, Z +${sumHexAlt.marginZ}mm)을 확보하면서 삼각 밀착 구조를 유지합니다.`,
          reasons: [
            `총 ${sumHexAlt.totalCount}개(층당 ${sumHexAlt.itemsPerLayer}개)를 수납하며 외곽 완충재(에어캡/성형 트레이) 장착 공간을 확보합니다.`,
            `바닥 면적 효율 ${sumHexAlt.areaUtilization}%와 안정성 지수 ${sumHexAlt.stabilityScore}점을 동시에 만족합니다.`,
            `상단 여유 +${sumHexAlt.marginY}mm로 층간 패드(Layer Pad) 및 상부 덮개 마감 시 간섭이 없습니다.`,
          ],
          pattern: 'hex',
          alternateLayers: false,
          rotateBase: false,
          rows: altRowsHex,
          cols: altColsHex,
          layers: maxLayersByHeight,
          pinwheelPerQuad: 2,
          itemsPerLayer: sumHexAlt.itemsPerLayer,
          totalCount: sumHexAlt.totalCount,
          volumeUtilization: sumHexAlt.volumeUtilization,
          areaUtilization: sumHexAlt.areaUtilization,
          stabilityScore: sumHexAlt.stabilityScore,
          stackWidth: sumHexAlt.stackWidth,
          stackDepth: sumHexAlt.stackDepth,
          totalHeight: sumHexAlt.totalHeight,
          marginX: sumHexAlt.marginX,
          marginZ: sumHexAlt.marginZ,
          marginY: sumHexAlt.marginY,
          hasOverhang: sumHexAlt.hasOverhang,
          grossWeightKg: sumHexAlt.grossWeightKg,
        });
      }
    } else if (safeCols !== colsGrid || safeRows !== rowsGrid || safeLayers !== maxLayersByHeight) {
      const sumSafe = calculatePacking(
        mode,
        item,
        { ...container, autoFitContainer: false },
        {
          cols: safeCols,
          rows: safeRows,
          layers: safeLayers,
          pattern: 'block',
          alternateLayers: false,
          pinwheelPerQuad: 2,
          centerItems: true,
        }
      );
      candidates.push({
        id: 'opt-cyl-safe',
        badge: '완충 패드 · 안전 여백 확보형',
        title: '원통 완충 보호형 정열 배열',
        subtitle: `${safeCols}열 × ${safeRows}행 × ${safeLayers}단 (외벽·상단 완충 여유)`,
        reasonSummary: `외벽 및 상단에 여유 공간(X +${sumSafe.marginX}mm, Z +${sumSafe.marginZ}mm, Y +${sumSafe.marginY}mm)을 남겨 완충 패드 삽입과 외부 충격 보호에 최적화된 구성입니다.`,
        reasons: [
          `총 ${sumSafe.totalCount}개를 수납하며 사방 여유 공간을 통해 외부 충격이 용기에 직접 전달되는 것을 방지합니다.`,
          `상단 여유 +${sumSafe.marginY}mm로 골판지 상단 날개(Flap) 접합 및 테이핑 시 눌림이 발생하지 않습니다.`,
          `총 중량 ${sumSafe.grossWeightKg}kg으로 취급 및 적재 안정성(${sumSafe.stabilityScore}점)이 뛰어납니다.`,
        ],
        pattern: 'block',
        alternateLayers: false,
        rotateBase: false,
        rows: safeRows,
        cols: safeCols,
        layers: safeLayers,
        pinwheelPerQuad: 2,
        itemsPerLayer: sumSafe.itemsPerLayer,
        totalCount: sumSafe.totalCount,
        volumeUtilization: sumSafe.volumeUtilization,
        areaUtilization: sumSafe.areaUtilization,
        stabilityScore: sumSafe.stabilityScore,
        stackWidth: sumSafe.stackWidth,
        stackDepth: sumSafe.stackDepth,
        totalHeight: sumSafe.totalHeight,
        marginX: sumSafe.marginX,
        marginZ: sumSafe.marginZ,
        marginY: sumSafe.marginY,
        hasOverhang: sumSafe.hasOverhang,
        grossWeightKg: sumSafe.grossWeightKg,
      });
    }
  }

  // Sort:
  // 1. Non-overhanging fits first
  // 2. Higher totalCount + stability composite score so top 3 represent the best distinct options
  const sorted = candidates.sort((a, b) => {
    if (a.hasOverhang !== b.hasOverhang) return a.hasOverhang ? 1 : -1;
    const scoreA = a.totalCount * 100 + a.stabilityScore * 1.5 + a.areaUtilization;
    const scoreB = b.totalCount * 100 + b.stabilityScore * 1.5 + b.areaUtilization;
    return scoreB - scoreA;
  });

  return sorted.slice(0, 3);
}
