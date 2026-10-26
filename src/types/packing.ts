export type PackingMode = 'pallet' | 'carton';

export type ItemShape = 'box' | 'cylinder';

export type StackingPattern =
  | 'block'      // 기본 격자 정렬 (행 × 열)
  | 'pinwheel'   // 풍차형 4분면 교차 적재 (첨부 이미지 1 스타일)
  | 'brick'      // 벽돌식 지그재그 교차 배치
  | 'hex';       // 원기둥 벌집형 밀집 배열

export type ColorTheme =
  | 'cad-classic' // 첨부 이미지 1: 장변(Red) / 단변(Blue) / 상면(White) + 노란 팔레트
  | 'carton-can'  // 첨부 이미지 2: 스틸 블루 원통 + 골드 라인 반투명 외박스
  | 'layer-vivid' // 층별 교차 색상 구분 (레이어 가시성 강조)
  | 'kraft'       // 실제 골판지 크라프트 박스 & 목재 팔레트
  | 'custom';     // 사용자 지정 색상

export interface ItemSpec {
  name: string;
  shape: ItemShape;
  width: number;     // 가로 (장변 L, mm) - box 전용
  depth: number;     // 세로 (단변 W, mm) - box 전용
  diameter: number;  // 직경 (Ø, mm) - cylinder 전용
  height: number;    // 높이 (H, mm)
  weight: number;    // 단중 (kg)
  customColor: string;
  secondaryColor: string;
}

export interface ContainerSpec {
  name: string;
  width: number;        // 팔레트 가로 또는 외박스 내경 가로 (mm)
  depth: number;        // 팔레트 세로 또는 외박스 내경 세로 (mm)
  maxHeight: number;    // 최대 적재 높이(팔레트 포함) 또는 외박스 내경 높이 (mm)
  palletHeight: number; // 팔레트 자체 높이 (mm, 팔레트 모드 시 적용)
  palletWeight: number; // 팔레트 또는 빈 외박스 자체 중량 (kg)
  maxWeight: number;    // 최대 허용 총 중량 (kg)
  padding: number;      // 아이템 간 간격 (mm)
  autoFitContainer: boolean; // 행/열/층 입력값에 맞춰 외박스/팔레트 크기를 자동 산출할지 여부
}

export interface ArrangementConfig {
  rows: number;               // 행 (세로/깊이 방향 개수)
  cols: number;               // 열 (가로/폭 방향 개수)
  layers: number;             // 층 (적재 단수)
  pattern: StackingPattern;   // 적재 배열 패턴
  alternateLayers: boolean;   // 짝수층 교차 회전/반전 여부 (인터로킹 안정성)
  pinwheelPerQuad: number;    // 풍차형 사분면당 나란히 놓는 박스 수 (기본 2개 -> 층당 8개)
  centerItems: boolean;       // 컨테이너/팔레트 중앙 정렬 여부
}

export type SizeDisplayMode = 'custom' | 'calculated' | 'both' | 'off';

export type BackgroundStyle =
  | 'cad-gray'
  | 'clean-white'
  | 'dark-studio'
  | 'blueprint-navy'
  | 'warm-sand'
  | 'custom';

export type PalletShape = 'plastic' | 'wood';

export type PalletColorPreset =
  | 'red'
  | 'yellow'
  | 'blue'
  | 'black'
  | 'white'
  | 'custom';

export const PALLET_COLOR_PRESET_MAP: Record<
  Exclude<PalletColorPreset, 'custom'>,
  string
> = {
  red: '#dc2626',
  yellow: '#facc15',
  blue: '#2563eb',
  black: '#1e293b',
  white: '#f8fafc',
};

export function resolvePalletHexColor(
  palletColor: PalletColorPreset = 'yellow',
  customPalletColor: string = '#d4a373'
): string {
  if (palletColor === 'custom') {
    return customPalletColor || '#d4a373';
  }
  return PALLET_COLOR_PRESET_MAP[palletColor] || '#facc15';
}

export interface ViewerConfig {
  colorTheme: ColorTheme;
  palletShape: PalletShape;          // 팔레트 모양 ('plastic': 플라스틱, 'wood': 나무)
  palletColor: PalletColorPreset;    // 팔레트 색상 ('red' | 'yellow' | 'blue' | 'black' | 'white' | 'custom')
  customPalletColor: string;         // 사용자 지정 팔레트 색상 (HEX)
  sizeDisplayMode: SizeDisplayMode; // 3D 뷰 팔레트/외박스 크기 표시 모드 ('custom': 사용자 설정, 'calculated': 계산된 크기, 'both': 둘다, 'off': 모두 OFF)
  showDimensions: boolean;      // 3D 치수선 표시 (1100, 1100, 1445 등)
  showSpaceAnalysis: boolean;   // 내부 여유 공간 및 벗어난 초과 영역 통합 표시 여부
  showClearance: boolean;       // 내부 여유 공간(녹색) 표시 켜기/끄기
  showOverhang: boolean;        // 벗어난 초과 영역(적색) 표시 켜기/끄기
  interactionMode: 'orbit' | 'pan'; // 3D 뷰 마우스 좌클릭 조작 모드 ('orbit': 회전, 'pan': 화면 이동)
  showOuterBox: boolean;        // 외박스 반투명 케이스 표시
  outerBoxOpacity: number;      // 외박스 투명도 (0.05 ~ 0.6)
  showEdges: boolean;           // 윤곽선(블랙/골드 라인) 강조 표시
  explodedFactor: number;       // 층별/아이템 분해 슬라이더 (0 ~ 1)
  visibleLayers: number;        // 현재 표시할 최대 층수 (슬라이더 점검용)
  cameraPreset: 'iso' | 'front' | 'top' | 'side';
  backgroundStyle: BackgroundStyle;
  customBgColor: string;        // 사용자 지정 3D 뷰 바탕색 (HEX)
}

export interface PlacedItem {
  id: string;
  layer: number;       // 0-indexed layer
  row: number;         // 0-indexed row
  col: number;         // 0-indexed col
  quadrant?: number;   // 0~3 for pinwheel
  shape: ItemShape;
  x: number;           // 3D center X (mm, relative to container center)
  y: number;           // 3D center Y (mm, from ground Y=0)
  z: number;           // 3D center Z (mm, relative to container center)
  dimX: number;        // bounding width along X (mm)
  dimY: number;        // height along Y (mm)
  dimZ: number;        // bounding depth along Z (mm)
  rotationY: number;   // rotation in radians (0 or Math.PI/2)
  isRotated: boolean;  // true if rotated 90 degrees
  isOutOfBounds: boolean; // true if protruding outside container/pallet
  outX: boolean;       // true if protruding along X
  outY: boolean;       // true if protruding along Y (height)
  outZ: boolean;       // true if protruding along Z
}

export interface PackingSummary {
  placedItems: PlacedItem[];
  itemsPerLayer: number;
  totalLayers: number;
  totalCount: number;
  stackWidth: number;      // 적재물 전체 가로 폭 (mm)
  stackDepth: number;      // 적재물 전체 세로 깊이 (mm)
  stackHeight: number;     // 적재물 순수 높이 (mm)
  totalHeight: number;     // 팔레트 포함 총 높이 또는 외박스 총 높이 (mm)
  effectiveContainerWidth: number;
  effectiveContainerDepth: number;
  effectiveContainerHeight: number;
  usableContainerHeight: number; // 팔레트 제외 순수 적재 가능 높이 (mm)
  marginX: number;         // 가로 여유 공간 (+면 남는 공간, -면 벗어난 초과량, mm)
  marginZ: number;         // 세로 여유 공간 (+면 남는 공간, -면 벗어난 초과량, mm)
  marginY: number;         // 높이 여유 공간 (+면 남는 공간, -면 벗어난 초과량, mm)
  itemUnitVolumeCbm: number;
  totalItemVolumeCbm: number;
  containerVolumeCbm: number;
  emptyVoidVolumeCbm: number; // 용기 내부 남는 빈 공간 체적 (CBM)
  volumeUtilization: number; // 체적 적재율 (%)
  areaUtilization: number;   // 바닥 면적 이용률 (%)
  netWeightKg: number;       // 내용물 순중량 (kg)
  grossWeightKg: number;     // 팔레트/외박스 포함 총중량 (kg)
  hasOverhang: boolean;      // 컨테이너/팔레트 규격 초과 여부
  overhangX: number;         // 가로 초과량 (mm)
  overhangZ: number;         // 세로 초과량 (mm)
  overhangY: number;         // 높이 초과량 (mm)
  stabilityScore: number;    // 적재 안정성 점수 (0~100)
}

export interface OptimizationRecommendation {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  reasonSummary: string;
  reasons: string[];
  pattern: StackingPattern;
  alternateLayers: boolean;
  rotateBase: boolean;
  rows: number;
  cols: number;
  layers: number;
  pinwheelPerQuad: number;
  itemsPerLayer: number;
  totalCount: number;
  volumeUtilization: number;
  areaUtilization: number;
  stabilityScore: number;
  stackWidth: number;
  stackDepth: number;
  totalHeight: number;
  marginX: number;
  marginZ: number;
  marginY: number;
  hasOverhang: boolean;
  grossWeightKg: number;
}

export interface QuickPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  mode: PackingMode;
  item: ItemSpec;
  container: ContainerSpec;
  arrangement: ArrangementConfig;
  viewer: Partial<ViewerConfig>;
}

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'image-1-pallet-pinwheel',
    label: '첨부 이미지 1: T11 팔레트 교차 적재',
    badge: '1100×1100×1445',
    description: '1100×1100 팔레트 위 550×275×185mm 박스 8개씩 7단 풍차형(Pinwheel) 엇갈림 적재',
    mode: 'pallet',
    item: {
      name: '표준 수출용 카톤 박스 (550×275×185)',
      shape: 'box',
      width: 550,
      depth: 275,
      diameter: 275,
      height: 185,
      weight: 8.5,
      customColor: '#ef0000',
      secondaryColor: '#0000ff',
    },
    container: {
      name: '한국 표준 T11 팔레트 (1100×1100)',
      width: 1100,
      depth: 1100,
      maxHeight: 1500,
      palletHeight: 150,
      palletWeight: 20,
      maxWeight: 1000,
      padding: 0,
      autoFitContainer: false,
    },
    arrangement: {
      rows: 2,
      cols: 4,
      layers: 7,
      pattern: 'pinwheel',
      alternateLayers: true,
      pinwheelPerQuad: 2,
      centerItems: true,
    },
    viewer: {
      colorTheme: 'cad-classic',
      showDimensions: true,
      showOuterBox: false,
      showEdges: true,
      backgroundStyle: 'cad-gray',
    },
  },
  {
    id: 'image-2-carton-cylinders',
    label: '첨부 이미지 2: 외박스 원통(캔) 4×2 포장',
    badge: '4열×2행×1단',
    description: '반투명 외박스 내부에 원기둥 캔(Ø100×140mm)을 4열 × 2행 × 1단으로 배열한 카톤 포장',
    mode: 'carton',
    item: {
      name: '원통형 스틸 캔 용기 (Ø100×140)',
      shape: 'cylinder',
      width: 100,
      depth: 100,
      diameter: 100,
      height: 140,
      weight: 0.85,
      customColor: '#5b84b1',
      secondaryColor: '#9ab8d9',
    },
    container: {
      name: '8구 멀티팩 외박스 (430×225×155)',
      width: 430,
      depth: 225,
      maxHeight: 155,
      palletHeight: 0,
      palletWeight: 0.45,
      maxWeight: 25,
      padding: 4,
      autoFitContainer: false,
    },
    arrangement: {
      rows: 2,
      cols: 4,
      layers: 1,
      pattern: 'block',
      alternateLayers: false,
      pinwheelPerQuad: 2,
      centerItems: true,
    },
    viewer: {
      colorTheme: 'carton-can',
      showDimensions: true,
      showOuterBox: true,
      outerBoxOpacity: 0.22,
      showEdges: true,
      backgroundStyle: 'clean-white',
    },
  },
  {
    id: 'carton-beverage-24',
    label: '음료 캔 24입 마스터 카톤 (6×4×2단)',
    badge: '6열×4행×2단',
    description: '355ml 표준 음료 캔(Ø66×122mm)을 6열 × 4행 × 2층(48캔)으로 외박스에 포장',
    mode: 'carton',
    item: {
      name: '355ml 표준 알루미늄 캔 (Ø66×122)',
      shape: 'cylinder',
      width: 66,
      depth: 66,
      diameter: 66,
      height: 122,
      weight: 0.37,
      customColor: '#2563eb',
      secondaryColor: '#93c5fd',
    },
    container: {
      name: '음료 마스터 카톤 (415×280×255)',
      width: 415,
      depth: 280,
      maxHeight: 255,
      palletHeight: 0,
      palletWeight: 0.6,
      maxWeight: 30,
      padding: 2,
      autoFitContainer: false,
    },
    arrangement: {
      rows: 4,
      cols: 6,
      layers: 2,
      pattern: 'block',
      alternateLayers: false,
      pinwheelPerQuad: 2,
      centerItems: true,
    },
    viewer: {
      colorTheme: 'carton-can',
      showDimensions: true,
      showOuterBox: true,
      outerBoxOpacity: 0.2,
      showEdges: true,
      backgroundStyle: 'clean-white',
    },
  },
  {
    id: 'pallet-brick-standard',
    label: '택배 3호 박스 팔레트 벽돌식 적재',
    badge: '340×250×210',
    description: '우체국 3호 규격 상자(340×250×210mm)를 T11 팔레트 위에 6단 교차 적재',
    mode: 'pallet',
    item: {
      name: '우체국 3호 규격 박스 (340×250×210)',
      shape: 'box',
      width: 340,
      depth: 250,
      diameter: 250,
      height: 210,
      weight: 5.0,
      customColor: '#d97706',
      secondaryColor: '#b45309',
    },
    container: {
      name: '한국 표준 T11 팔레트 (1100×1100)',
      width: 1100,
      depth: 1100,
      maxHeight: 1500,
      palletHeight: 150,
      palletWeight: 20,
      maxWeight: 1000,
      padding: 2,
      autoFitContainer: false,
    },
    arrangement: {
      rows: 4,
      cols: 3,
      layers: 6,
      pattern: 'brick',
      alternateLayers: true,
      pinwheelPerQuad: 2,
      centerItems: true,
    },
    viewer: {
      colorTheme: 'kraft',
      showDimensions: true,
      showOuterBox: false,
      showEdges: true,
      backgroundStyle: 'dark-studio',
    },
  },
  {
    id: 'carton-inner-boxes',
    label: '화장품 단상자 마스터 카톤 포장',
    badge: '5열×3행×3단',
    description: '소형 제품 단상자(110×80×120mm) 45개를 외박스 내부에 5×3×3 배열로 수납',
    mode: 'carton',
    item: {
      name: '제품 인박스 단상자 (110×80×120)',
      shape: 'box',
      width: 110,
      depth: 80,
      diameter: 80,
      height: 120,
      weight: 0.32,
      customColor: '#3b82f6',
      secondaryColor: '#1d4ed8',
    },
    container: {
      name: '수출용 아웃박스 (570×260×380)',
      width: 570,
      depth: 260,
      maxHeight: 380,
      palletHeight: 0,
      palletWeight: 0.85,
      maxWeight: 25,
      padding: 2,
      autoFitContainer: true,
    },
    arrangement: {
      rows: 3,
      cols: 5,
      layers: 3,
      pattern: 'block',
      alternateLayers: true,
      pinwheelPerQuad: 2,
      centerItems: true,
    },
    viewer: {
      colorTheme: 'layer-vivid',
      showDimensions: true,
      showOuterBox: true,
      outerBoxOpacity: 0.18,
      showEdges: true,
      backgroundStyle: 'dark-studio',
    },
  },
];
