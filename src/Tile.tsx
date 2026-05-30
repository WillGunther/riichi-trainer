import type { TileCode } from "./types";

type TileProps = {
  tile: TileCode;
  beginnerMode: boolean;
  rotated?: boolean;
  muted?: boolean;
};

const honorLabels: Record<string, { face: string; beginner: string; tone: string }> = {
  E: { face: "東", beginner: "E", tone: "wind" },
  S: { face: "南", beginner: "S", tone: "wind" },
  W: { face: "西", beginner: "W", tone: "wind" },
  N: { face: "北", beginner: "N", tone: "wind" },
  P: { face: "", beginner: "White", tone: "dragon white-dragon" },
  F: { face: "發", beginner: "Green", tone: "dragon green" },
  C: { face: "中", beginner: "Red", tone: "dragon red" },
};

function parseTile(tile: TileCode) {
  if (honorLabels[tile]) {
    return honorLabels[tile];
  }

  const red = tile.endsWith("r");
  const suit = tile[1];
  const value = tile[0];
  const suitFace = suit === "m" ? "萬" : suit === "p" ? "筒" : "索";
  const suitTone = suit === "m" ? "manzu" : suit === "p" ? "pinzu" : "souzu";

  return {
    face: `${value}${suitFace}`,
    beginner: tile,
    tone: red ? `${suitTone} red-five` : suitTone,
  };
}

export function Tile({ tile, beginnerMode, rotated = false, muted = false }: TileProps) {
  const parsed = parseTile(tile);

  return (
    <span className={`tile ${parsed.tone} ${rotated ? "rotated" : ""} ${muted ? "muted" : ""}`}>
      <span className="tile-face">{parsed.face}</span>
      {beginnerMode ? <span className="tile-note">{parsed.beginner}</span> : null}
    </span>
  );
}
