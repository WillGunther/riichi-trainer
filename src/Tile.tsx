import type { TileCode } from "./types";

type TileProps = {
  tile: TileCode;
  beginnerMode: boolean;
  rotated?: boolean;
  muted?: boolean;
};

const tileAssetUrls = import.meta.glob("./assets/tiles/regular/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const honorLabels: Record<string, { beginner?: string; tone: string; file: string; alt: string }> = {
  E: { beginner: "E", tone: "wind", file: "Ton.png", alt: "East wind" },
  S: { beginner: "S", tone: "wind", file: "Nan.png", alt: "South wind" },
  W: { beginner: "W", tone: "wind", file: "Shaa.png", alt: "West wind" },
  N: { beginner: "N", tone: "wind", file: "Pei.png", alt: "North wind" },
  P: { tone: "dragon white-dragon", file: "Haku.png", alt: "White dragon" },
  F: { tone: "dragon green", file: "Hatsu.png", alt: "Green dragon" },
  C: { tone: "dragon red", file: "Chun.png", alt: "Red dragon" },
};

function parseTile(tile: TileCode) {
  if (honorLabels[tile]) {
    return {
      ...honorLabels[tile],
      assetUrl: tileAssetUrls[`./assets/tiles/regular/${honorLabels[tile].file}`],
    };
  }

  const red = tile.endsWith("r");
  const suit = tile[1];
  const value = tile[0];
  const suitTone = suit === "m" ? "manzu" : suit === "p" ? "pinzu" : "souzu";
  const suitFile = suit === "m" ? "Man" : suit === "p" ? "Pin" : "Sou";
  const suitLabel = suit === "m" ? "man" : suit === "p" ? "pin" : "sou";
  const file = `${suitFile}${value}${red ? "-Dora" : ""}.png`;

  return {
    assetUrl: tileAssetUrls[`./assets/tiles/regular/${file}`],
    beginner: value,
    alt: `${red ? "Red " : ""}${value} ${suitLabel}`,
    tone: red ? `${suitTone} red-five` : suitTone,
  };
}

export function Tile({ tile, beginnerMode, rotated = false, muted = false }: TileProps) {
  const parsed = parseTile(tile);

  return (
    <span className={`tile ${parsed.tone} ${rotated ? "rotated" : ""} ${muted ? "muted" : ""}`}>
      <img className="tile-image" src={parsed.assetUrl} alt={parsed.alt} draggable="false" />
      {beginnerMode && parsed.beginner ? <span className="tile-note">{parsed.beginner}</span> : null}
    </span>
  );
}
