# 3D 패키징 및 팔레타이징 시각화 시스템 (PackStack 3D)

물품(직육면체 상자, 원통형 캔/드럼)의 형태와 규격을 입력하고, 행·열·층 및 교차 적재 패턴을 설정하여 외박스(카톤) 포장 및 팔레트 적재(Palletizing) 상태를 Three.js 기반의 실감나는 3D 인터랙티브 뷰와 치수선, 적재 효율 리포트로 시각화하는 웹 애플리케이션입니다.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> 사용자의 질문 응답을 반영하여 다음 핵심 정책 및 모듈을 확정하였습니다:
> - **외박스 포장 & 팔레트 적재 동시 지원**: 사용자 첨부 이미지 1의 팔레트 적재(1100×1100)와 이미지 2의 외박스 내부 원통 포장 모드를 탭 전환 형태로 모두 지원합니다.
> - **다양한 형상 및 규격 프리셋**: 직육면체 상자, 원통(캔/보틀), 표준 물류 규격(한국 T11 팔레트 1100×1100, 유로 팔레트 1200×800, 우체국 택배박스 1~5호, 음료 캔 등) 프리셋을 기본 제공합니다.
> - **자동 최적 적재 패턴 추천**: 수동 행/열/층 지정뿐만 아니라, 컨테이너/팔레트 규격 대비 최대 적재 수량과 체적 효율(%)을 극대화하는 자동 최적화 추천 엔진을 제공합니다.

---

### 1. Overview & Core Concept

- **목적 및 가치**: 포장 설계자, 물류 담당자, 제조업체가 제품 포장 및 물류 팔레트 적재 시뮬레이션을 직관적으로 수행하고, 최적의 적재 패턴(블록형, 벽돌식, 풍차형)과 공간 효율성(Fill Rate %)을 사전에 검증할 수 있도록 돕습니다.
- **주요 대상**: 물류 기획자, 패키지 디자이너, e커머스 입출고 담당자, 물품 포장 견적 산출자.
- **핵심 차별점**: 단순 격자 배열을 넘어 이미지 1에서 보이는 **풍차형(Pinwheel/Windmill) 엇갈림 교대 적재** 및 이미지 2의 **반투명 외박스 내부 원통 배열**, 3D 공간 상의 **실시간 치수선(Dimension Annotation)** 및 **층별 분해(Exploded Layer) 슬라이더**를 제공합니다.

---

### 2. User Experience & Visual Design

#### A. 레이아웃 구조 (Desktop 1440px 최적화 & 반응형)
1. **상단 네비게이션 (Top Bar Contract)**:
   - 좌측: 브랜드 로고 및 타이틀 (`PackStack 3D`)
   - 중앙: 모드 전환 세그먼트 버튼 (`팔레트 적재 모드` | `외박스 포장 모드`)
   - 우측: `3D 캡처 저장` 및 `적재 사양서(PDF/인쇄)` 내보내기 버튼
2. **좌측 구성 패널 (Config & Controls Drawer, 380px)**:
   - **물품 사양 (Item Spec)**: 형상 선택(박스 / 원기둥), 가로(W)·세로(D)·높이(H) / 직경(Ø)·높이, 단중(Weight), 레이어별 색상 테마
   - **컨테이너/팔레트 규격 (Container / Pallet)**: 표준 프리셋 선택기(T11 1100×1100, EUR 1200×800, 택배 1~5호 등) 및 사용자 정의 크기
   - **배열 및 패턴 설정 (Arrangement & Patterns)**:
     - 수동 입력: 행(Rows), 열(Cols), 층(Layers/Tiers)
     - 적재 패턴: 기본 정렬(Block), 벽돌식(Brick), 풍차형(Pinwheel / Interlocking), 층별 교대 회전(Alternating 90°)
   - **자동 최적화 추천 탭 (Smart Optimizer)**: 원클릭으로 최대 적재 수량 및 적재율 순위별 추천(정방향, 회전, 콤비네이션) 제안
3. **중앙/우측 3D 뷰포트 (Three.js WebGL Viewport)**:
   - 360도 회전, 팬, 줌 (OrbitControls)
   - 카메라 프리셋 버튼 (입체 Isometric, 평면 Top, 정면 Front, 측면 Side)
   - 3D 치수선(치수 수치 표기: 1100, 1100, 1445 등 사용자 이미지 스타일)
   - 외박스 반투명/와이어프레임 토글
   - 층별 높이 분해 슬라이더 (0% ~ 100% 레이어 분리)
4. **하단 컴팩트 스펙 HUD (Bottom Metrics Bar)**:
   - 총 적재 수량 (Total Units), 체적 이용률 (Fill Rate %), 총 체적 (Volume), 총 중량 (Gross Weight), 오버행/여유공간 경고

#### B. 비주얼 테마 & 스타일링
- **색상 시스템**: 60% 슬레이트 뉴트럴 캔버스, 30% 정제된 패널 표면, 10% 악센트(블루/인디고 및 경고 앰버)
- **3D 렌더링 톤앤매너**: PBR 기반 `MeshStandardMaterial`, 스튜디오 3점 조명 및 소프트 앰비언트, 바닥 접촉 그림자(Contact Shadow), 레이어별 가독성을 위한 교대 컬러(Red, Royal Blue, White Top 등)

---

### 3. Key Product Decisions & Trade-Offs

1. **Three.js 직접 렌더링 엔진 선택**:
   - *접근법*: 순수 Three.js를 React `useRef` 컨테이너 내에서 안전하게 구동하는 아키텍처 채택.
   - *이유*: 3D 텍스트/치수선(CanvasSprite/HTML 라벨), 절단면/분해 애니메이션, 반투명 컨테이너 렌더 소팅(`depthWrite: false`, `renderOrder`)을 세밀하게 제어할 수 있습니다.
2. **풍차형(Pinwheel) 및 인터로킹 적재 알고리즘**:
   - *접근법*: 단순 n×m 그리드 외에 박스의 종횡비에 맞춘 풍차형 4방향 대칭 배열 좌표 생성기 구현.
   - *이유*: 실제 물류 현장(사용자 첨부 이미지 1)에서 박스가 무너지지 않도록 층마다 회전 교대 적재하는 패턴이 필수적입니다.
3. **원통형(Cylinder) 포장 밀집 배치**:
   - *접근법*: 직각 사각 격자(Square Grid)와 삼각 벌집 엇갈림 격자(Hexagonal / Staggered Packing) 2가지 계산 지원.
   - *이유*: 원통형 캔/보틀을 박스에 넣을 때(첨부 이미지 2) 정렬 포장과 지그재그 밀집 포장의 차이를 직관적으로 확인 가능합니다.
4. **치수 표기 (3D Dimension Guides)**:
   - *접근법*: Three.js Line 및 텍스트 뱃지를 결합한 치수 가이드라인 시스템.
   - *이유*: 사용자 첨부 이미지 1에 명시된 1100, 1100, 1445와 같은 실측 수치가 화면에 표시되어야 물류 규격 적합성을 바로 판단할 수 있습니다.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                   │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │     TopBar.tsx          │  │        PackingMetricsHUD.tsx         │ │
│  │ (Mode, Export, Presets) │  │  (Total Count, Fill Rate, Overhang)  │ │
│  └───────────┬─────────────┘  └──────────────────▲───────────────────┘ │
│              │ State                             │ State               │
│  ┌───────────▼─────────────┐  ┌──────────────────┴───────────────────┐ │
│  │   ConfigPanel.tsx       │  │       PackingCanvas3D.tsx            │ │
│  │ - Item Dimension Form   │  │ - Three.js WebGL Scene & Renderer    │ │
│  │ - Container/Pallet Form │  │ - OrbitControls & Camera Rig         │ │
│  │ - Arrangement & Pattern │  │ - Box / Cylinder Mesh Assembler      │ │
│  │ - Auto Optimizer Engine │  │ - Transparent Container & Pallet Base│ │
│  │ - Preset Quick Select   │  │ - 3D Dimension Annotation Lines      │ │
│  └───────────┬─────────────┘  │ - Exploded Layer Separation Slider   │ │
│              │                └──────────────────────────────────────┘ │
│  ┌───────────▼───────────────────────────────────────────────────────┐ │
│  │                   packingCalculator.ts                            │ │
│  │ - Grid Placement Math (Block, Pinwheel, Brick, Alternating)       │ │
│  │ - Hexagonal Cylinder Nesting Math                                 │ │
│  │ - Optimization Search Engine (Orientation, Max Fit, Efficiency)   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

#### 주요 데이터 인터페이스
- `PackingMode`: `'pallet' | 'carton'`
- `ItemShape`: `'box' | 'cylinder'`
- `ItemSpec`: `{ shape, width, depth, height, diameter, weight, colorTheme }`
- `ContainerSpec`: `{ width, depth, height, maxWeight, palletHeight, wallThickness }`
- `ArrangementConfig`: `{ rows, cols, layers, pattern: 'block' | 'brick' | 'pinwheel' | 'hex', alternateLayers: boolean, explodedGap: number }`
- `OptimizationResult`: `{ orientation, itemsPerLayer, layers, totalCount, fillRate, arrangement, overhang }[]`

---

### 5. Implementation Roadmap (Approved Turn Execution)

1. **라이브러리 및 에셋 설정**:
   - `three` 및 `@types/three` 설치.
2. **계산 엔진 구현 (`packingCalculator.ts`)**:
   - 블록형, 벽돌식, 풍차형(Pinwheel), 원통 엇갈림 좌표 계산기.
   - 컨테이너/팔레트 대비 자동 최적화 추천 알고리즘.
   - 체적 이용률, 무게, 치수 한계 검증 로직.
3. **Three.js 3D 뷰포트 컴포넌트 (`PackingCanvas3D.tsx`)**:
   - 팔레트 받침대(목재/플라스틱) 및 반투명 외박스 3D 모델링.
   - 물품 인스턴스/메시 생성(박스 모서리 테두리 라인, 캔 캡/바디 디테일).
   - 3D 치수선 및 레이블 렌더러.
   - 층별 분해(Exploded View) 애니메이션 및 카메라 뷰 프리셋.
4. **UI 패널 및 컨트롤 구성**:
   - `ConfigPanel.tsx`: 규격 입력, 프리셋 선택, 행/열/층 조절기, 패턴 선택.
   - `OptimizationModal.tsx`: 추천 적재안 목록 및 원클릭 적용.
   - `PackingMetricsHUD.tsx`: 적재 통계, 효율(%), 중량 게이지.
   - `TopBar.tsx`: 모드 전환, 고화질 이미지 캡처/다운로드.
5. **검증 및 빌드 확인**:
   - `compile_applet` 및 기능 검증.
