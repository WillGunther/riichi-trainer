export type Suit = "m" | "p" | "s";
export type HonorTile = "E" | "S" | "W" | "N" | "P" | "F" | "C";
export type SuitedTile = `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}${Suit}` | "5mr" | "5pr" | "5sr";
export type TileCode = SuitedTile | HonorTile;

export type Wind = "east" | "south" | "west" | "north";
export type WinMethod = "ron" | "tsumo";
export type MeldType = "chi" | "pon" | "kan";
export type RelativeSeat = "self" | "left" | "across" | "right";
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
  englishName: string;
};

export type FuBreakdown = {
  name: string;
  fu: number;
  category: FuCategory;
  context?: string;
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

export type BoardPhase = "draw" | "discard" | "call" | "win" | "exhaustiveDraw";
export type DrawSource = "wall" | "deadWall";

export type RiverTile = {
  tile: TileCode;
  calledBy?: RelativeSeat;
  riichiDeclaration?: boolean;
  tsumogiri?: boolean;
};

export type BoardPlayer = {
  seat: Wind;
  score: number;
  handTiles?: TileCode[];
  drawnTile?: TileCode;
  discards: RiverTile[];
  melds: Meld[];
  riichi: boolean;
  riichiTurn?: number;
  doubleRiichi?: boolean;
  furiten?: boolean;
};

export type WinContext = {
  winner: Wind;
  winMethod: WinMethod;
  winningTile: TileCode;
  sourceSeat?: Wind;
  drawSource?: DrawSource;
  ippatsu: boolean;
  rinshan: boolean;
  chankan: boolean;
  haitei: boolean;
  houtei: boolean;
  tenhou: boolean;
  chiihou: boolean;
  nagashiMangan: boolean;
};

export type BoardState = {
  roundWind: Wind;
  dealer: Wind;
  turn: Wind;
  phase: BoardPhase;
  honba: number;
  riichiSticks: number;
  players: BoardPlayer[];
  wallCount: number;
  doraIndicators: TileCode[];
  uraDoraIndicators: TileCode[];
  deadWallReveals: TileCode[];
  winContext?: WinContext;
};

export type ProblemMetadata = {
  id: string;
  title: string;
  tags: string[];
};

export type ScoringAnswer = {
  han: number;
  fu: number;
  points: string;
  limitTier: LimitTier;
  yaku: YakuBreakdown[];
  fuBreakdown: FuBreakdown[];
};

export type ScoringProblem = ProblemMetadata & {
  hand: HandState;
  answer: ScoringAnswer;
};

export type DiscardAnswer = {
  discards: TileCode[];
  explanation?: string;
};

export type DiscardProblem = ProblemMetadata & {
  board: BoardState;
  actingSeat: Wind;
  answer: DiscardAnswer;
};

export type Problem = ScoringProblem | DiscardProblem;

export type FuTotals = Record<FuCategory, number> & {
  preRound: number;
  rounded: number;
};

export type FieldStatus = "idle" | "correct" | "incorrect";
