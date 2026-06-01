export type Suit = "m" | "p" | "s";
export type HonorTile = "E" | "S" | "W" | "N" | "P" | "F" | "C";
export type SuitedTile = `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}${Suit}` | "5mr" | "5pr" | "5sr";
export type TileCode = SuitedTile | HonorTile;

export type Wind = "east" | "south" | "west" | "north";
export type WinMethod = "ron" | "tsumo";
export type MeldType = "chi" | "pon" | "kan";
export type Meld = {
  type: MeldType;
  tiles: TileCode[];
  open: boolean;
  calledTile?: TileCode;
};

export type FuCategory = "base" | "group" | "wait/pair" | "win method" | "rounding";
export type LimitTier = "none" | "mangan" | "haneman" | "baiman" | "sanbaiman" | "yakuman";

export type YakuBreakdown = {
  name: string;
  han: number;
};

export type FuBreakdown = {
  name: string;
  fu: number;
  category: FuCategory;
};

export type HandState = {
  concealedTiles: TileCode[];
  melds: Meld[];
  winningTile: TileCode;
  seatWind: Wind;
  roundWind: Wind;
  winMethod: WinMethod;
  riichi: boolean;
  doraIndicators: TileCode[];
  uraDoraIndicators?: TileCode[];
};

export type FutureContext = {
  phase?: "draw" | "discard" | "win";
  lastDrawSource?: "wall" | "deadWall";
  lastDiscardBy?: "self" | "left" | "across" | "right";
  kanOccurred?: boolean;
  riichiTurn?: number;
  doubleRiichi?: boolean;
  ippatsu?: boolean;
  haitei?: boolean;
  houtei?: boolean;
  furiten?: boolean;
  exhaustiveDraw?: boolean;
  nagashiMangan?: boolean;
};

export type PlayerState = {
  seat: Wind;
  score?: number;
  river?: TileCode[];
  calledMelds?: Meld[];
};

export type TableState = {
  players?: PlayerState[];
  wallCount?: number;
  deadWallReveals?: TileCode[];
  rivers?: TileCode[][];
};

export type Answer = {
  han: number;
  fu?: number;
  points: string;
  limitTier: LimitTier;
  yaku: YakuBreakdown[];
  fuBreakdown?: FuBreakdown[];
};

export type Problem = {
  id: string;
  title: string;
  tags: string[];
  hand: HandState;
  context?: FutureContext;
  table?: TableState;
  answer: Answer;
};

export type FuTotals = Record<FuCategory, number> & {
  preRound: number;
  rounded: number;
};

export type FieldStatus = "idle" | "correct" | "incorrect";
