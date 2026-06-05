#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import random
import sqlite3
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Literal, cast

from pydantic import BaseModel, ConfigDict, Field


WIND_NAMES = ("east", "south", "west", "north")
HONOR_CODES = ("E", "S", "W", "N", "P", "F", "C")
LIMIT_TIERS = ("none", "mangan", "haneman", "baiman", "sanbaiman", "yakuman")
TENHOU_LIMITS = ("none", "mangan", "haneman", "baiman", "sanbaiman", "yakuman")
RED_FIVE_IDS = {16: "5mr", 52: "5pr", 88: "5sr"}
FU_NAME_LABELS = {
    "base": "Base fu",
    "closed_kan": "Closed kan",
    "closed_pon": "Closed triplet",
    "closed_terminal_kan": "Closed terminal/honor kan",
    "closed_terminal_pon": "Closed terminal/honor triplet",
    "hand_without_fu": "No-points hand",
    "kanchan": "Kanchan - Closed Wait",
    "open_kan": "Open kan",
    "open_pon": "Open triplet",
    "open_terminal_kan": "Open terminal/honor kan",
    "open_terminal_pon": "Open terminal/honor triplet",
    "pair_wait": "Pair wait",
    "penchan": "Penchan - Edge Wait",
    "tsumo": "Tsumo",
    "valued_pair": "Value pair",
    "double_valued_pair": "Double value pair",
}
YAKU_ENGLISH_LABELS = {
    "Chantai": "Outside hand",
    "Chiitoitsu": "Seven pairs",
    "Chinitsu": "Full flush",
    "Daisangen": "Big three dragons",
    "Dora": "Dora",
    "Honitsu": "Half flush",
    "Honroutou": "All terminals and honors",
    "Iipeiko": "Pure double sequence",
    "Iipeikou": "Pure double sequence",
    "Ittsu": "Full straight",
    "Junchan": "Pure outside hand",
    "Menzen Tsumo": "Fully concealed self-draw",
    "Menzen tsumo": "Fully concealed self-draw",
    "Pinfu": "All sequences",
    "Riichi": "Ready hand",
    "San Ankou": "Three concealed triplets",
    "Sanankou": "Three concealed triplets",
    "Sanshoku Doujun": "Mixed triple sequence",
    "Suu Ankou": "Four concealed triplets",
    "Suuankou": "Four concealed triplets",
    "Tanyao": "All simples",
    "Toitoi": "All triplets",
}
HONOR_TILE_LABELS = {
    "E": "East",
    "S": "South",
    "W": "West",
    "N": "North",
    "P": "White dragon",
    "F": "Green dragon",
    "C": "Red dragon",
}

Wind = Literal["east", "south", "west", "north"]
WinMethod = Literal["ron", "tsumo"]
MeldType = Literal["chi", "pon", "kan"]
FuCategory = Literal["base", "group", "wait/pair", "win method", "rounding"]
LimitTier = Literal["none", "mangan", "haneman", "baiman", "sanbaiman", "yakuman"]
TileCode = str

MODEL_CONFIG = ConfigDict(populate_by_name=True, extra="forbid")


YAKU_NAMES = [
    "Menzen tsumo",
    "Riichi",
    "Ippatsu",
    "Chankan",
    "Rinshan kaihou",
    "Haitei raoyue",
    "Houtei raoyui",
    "Pinfu",
    "Tanyao",
    "Iipeikou",
    "Seat wind east",
    "Seat wind south",
    "Seat wind west",
    "Seat wind north",
    "Round wind east",
    "Round wind south",
    "Round wind west",
    "Round wind north",
    "Yakuhai: white dragon",
    "Yakuhai: green dragon",
    "Yakuhai: red dragon",
    "Double riichi",
    "Chiitoitsu",
    "Chanta",
    "Ittsu",
    "Sanshoku doujun",
    "Sanshoku doukou",
    "Sankantsu",
    "Toitoi",
    "Sanankou",
    "Shousangen",
    "Honroutou",
    "Ryanpeikou",
    "Junchan",
    "Honitsu",
    "Chinitsu",
    "Renhou",
    "Tenhou",
    "Chihou",
    "Daisangen",
    "Suuankou",
    "Suuankou tanki",
    "Tsuuiisou",
    "Ryuuiisou",
    "Chinroutou",
    "Chuuren poutou",
    "Chuuren poutou 9-wait",
    "Kokushi musou",
    "Kokushi musou 13-wait",
    "Daisuushi",
    "Shousuushi",
    "Suukantsu",
    "Dora",
    "Ura dora",
    "Aka dora",
]


class LogSource(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    text: str


class Candidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    problem: "ScoringProblemModel"
    tags: frozenset[str]
    source: str


class DecodedMeld(BaseModel):
    model_config = ConfigDict(frozen=True)

    type: MeldType
    tiles: tuple[int, ...]
    open: bool
    called_tile: int | None


class MeldModel(BaseModel):
    model_config = MODEL_CONFIG

    type: MeldType
    tiles: list[TileCode]
    open: bool
    called_tile: TileCode | None = Field(default=None, alias="calledTile")


class HandModel(BaseModel):
    model_config = MODEL_CONFIG

    concealed_tiles: list[TileCode] = Field(alias="concealedTiles")
    melds: list[MeldModel]
    winning_tile: TileCode = Field(alias="winningTile")
    seat_wind: Wind = Field(alias="seatWind")
    round_wind: Wind = Field(alias="roundWind")
    win_method: WinMethod = Field(alias="winMethod")
    riichi: bool
    dora_indicators: list[TileCode] = Field(alias="doraIndicators")
    ura_dora_indicators: list[TileCode] | None = Field(default=None, alias="uraDoraIndicators")


class YakuBreakdownModel(BaseModel):
    model_config = MODEL_CONFIG

    name: str
    han: int
    english_name: str = Field(alias="englishName")


class FuBreakdownModel(BaseModel):
    model_config = MODEL_CONFIG

    name: str
    fu: int
    category: FuCategory
    context: str | None = None


class AnswerModel(BaseModel):
    model_config = MODEL_CONFIG

    han: int
    fu: int
    points: str
    limit_tier: LimitTier = Field(alias="limitTier")
    yaku: list[YakuBreakdownModel]
    fu_breakdown: list[FuBreakdownModel] = Field(alias="fuBreakdown")


class ProblemMetadataModel(BaseModel):
    id: str
    title: str
    tags: list[str]


class ScoringProblemModel(ProblemMetadataModel):
    hand: HandModel
    answer: AnswerModel


for model in (
    LogSource,
    Candidate,
    DecodedMeld,
    MeldModel,
    HandModel,
    YakuBreakdownModel,
    FuBreakdownModel,
    AnswerModel,
    ProblemMetadataModel,
    ScoringProblemModel,
):
    model.model_rebuild(_types_namespace=globals())


def tile_code(tile_id: int) -> str:
    if tile_id in RED_FIVE_IDS:
        return RED_FIVE_IDS[tile_id]

    tile_type = tile_id // 4
    if tile_type < 9:
        return f"{tile_type + 1}m"
    if tile_type < 18:
        return f"{tile_type - 8}p"
    if tile_type < 27:
        return f"{tile_type - 17}s"
    return HONOR_CODES[tile_type - 27]


def base_tile(code: str) -> str:
    return code.replace("r", "")


def format_tile_name(code: str) -> str:
    tile = base_tile(code)
    if tile in HONOR_TILE_LABELS:
        return HONOR_TILE_LABELS[tile]

    suit_labels = {"m": "man", "p": "pin", "s": "sou"}
    return f"{tile[0]}-{suit_labels[tile[1]]}{' red' if code.endswith('r') else ''}"


def is_terminal_or_honor(code: str) -> bool:
    tile = base_tile(code)
    return tile in HONOR_TILE_LABELS or tile[0] in {"1", "9"}


def is_dragon(code: str) -> bool:
    return base_tile(code) in {"P", "F", "C"}


def wind_tile(wind: Wind) -> str:
    return HONOR_CODES[WIND_NAMES.index(wind)]


def tile_counts(tiles: list[str]) -> Counter[str]:
    return Counter(base_tile(tile) for tile in tiles)


def yaku_english_name(name: str) -> str:
    if name.startswith("Yakuhai (") and name.endswith(")"):
        value = name.removeprefix("Yakuhai (").removesuffix(")")
        value = value.replace("chun", "red dragon").replace("haku", "white dragon").replace("hatsu", "green dragon")
        return f"Value honor: {value}"

    return YAKU_ENGLISH_LABELS.get(name, name)


def parse_int_list(value: str | None) -> list[int]:
    if not value:
        return []
    return [int(item) for item in value.split(",") if item != ""]


def wind_for_player(player: int, dealer: int) -> Wind:
    return cast(Wind, WIND_NAMES[(player - dealer) % 4])


def round_wind(round_index: int) -> Wind:
    return cast(Wind, WIND_NAMES[(round_index // 4) % 4])


def decode_meld(value: int) -> DecodedMeld | None:
    from_player = value & 0x3

    if value & 0x4:
        copies = ((value >> 3) & 0x3, (value >> 5) & 0x3, (value >> 7) & 0x3)
        base_and_called = value >> 10
        called_index = base_and_called % 3
        base = base_and_called // 3
        base = (base // 7) * 9 + base % 7
        tiles = tuple(copy + 4 * (base + offset) for offset, copy in enumerate(copies))
        return DecodedMeld(type="chi", tiles=tiles, open=True, called_tile=tiles[called_index])

    if value & 0x18:
        omitted_copy = (value >> 5) & 0x3
        copies = ((1, 2, 3), (0, 2, 3), (0, 1, 3), (0, 1, 2))[omitted_copy]
        base_and_called = value >> 9
        called_index = base_and_called % 3
        base = base_and_called // 3
        tiles = tuple(copy + 4 * base for copy in copies)
        if value & 0x8:
            return DecodedMeld(type="pon", tiles=tiles, open=True, called_tile=tiles[called_index])
        return DecodedMeld(type="kan", tiles=(*tiles, omitted_copy + 4 * base), open=True, called_tile=tiles[called_index])

    if value & 0x20:
        return None

    base_and_called = value >> 8
    called_index = base_and_called % 4
    base = base_and_called // 4
    tiles = tuple(copy + 4 * base for copy in range(4))
    open_meld = from_player != 0
    return DecodedMeld(type="kan", tiles=tiles, open=open_meld, called_tile=tiles[called_index] if open_meld else None)


def read_text_or_gzip(path: Path) -> str:
    data = path.read_bytes()
    if data.startswith(b"\x1f\x8b"):
        data = gzip.decompress(data)
    return data.decode("utf-8", errors="replace")


def xml_sources_from_dir(path: Path, max_logs: int | None) -> Iterable[LogSource]:
    suffixes = {".xml", ".mjlog", ".gz"}
    count = 0
    for file_path in sorted(path.rglob("*")):
        if not file_path.is_file() or file_path.suffix not in suffixes:
            continue
        text = read_text_or_gzip(file_path)
        if "<mjloggm" not in text and "<AGARI" not in text:
            continue
        yield LogSource(name=str(file_path), text=text)
        count += 1
        if max_logs is not None and count >= max_logs:
            return


def decode_db_cell(value: Any) -> str | None:
    if isinstance(value, memoryview):
        value = value.tobytes()
    if isinstance(value, bytes):
        data = value
        if data.startswith(b"\x1f\x8b"):
            try:
                data = gzip.decompress(data)
            except OSError:
                return None
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            return None
        return text if "<mjloggm" in text or "<AGARI" in text else None
    if isinstance(value, str) and ("<mjloggm" in value or "<AGARI" in value):
        return value
    return None


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def xml_sources_from_db(path: Path, max_logs: int | None) -> Iterable[LogSource]:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    emitted = 0
    try:
        tables = [row[0] for row in conn.execute("select name from sqlite_master where type='table' order by name")]
        for table in tables:
            cursor = conn.execute(f"select * from {quote_identifier(table)}")
            names = [description[0] for description in cursor.description]
            for row_index, row in enumerate(cursor, start=1):
                for name, value in zip(names, row):
                    text = decode_db_cell(value)
                    if text is None:
                        continue
                    yield LogSource(name=f"{path}:{table}:{row_index}:{name}", text=text)
                    emitted += 1
                    if max_logs is not None and emitted >= max_logs:
                        return
    finally:
        conn.close()


def iter_sources(args: argparse.Namespace) -> Iterable[LogSource]:
    if args.xml_dir is not None:
        yield from xml_sources_from_dir(args.xml_dir, args.max_logs)
    if args.houou_db is not None:
        yield from xml_sources_from_db(args.houou_db, args.max_logs)


def parse_log(source: LogSource) -> list[Candidate]:
    try:
        root = ET.fromstring(source.text)
    except ET.ParseError:
        return []

    candidates: list[Candidate] = []
    round_index = 0
    dealer = 0

    for element in root:
        if element.tag == "INIT":
            seed = parse_int_list(element.attrib.get("seed"))
            round_index = seed[0] if seed else 0
            dealer = int(element.attrib.get("oya", "0"))
        elif element.tag == "AGARI":
            candidate = candidate_from_agari(element, source.name, round_index, dealer, len(candidates) + 1)
            if candidate is not None:
                candidates.append(candidate)

    return candidates


def candidate_from_agari(element: ET.Element, source: str, round_index: int, dealer: int, sequence: int) -> Candidate | None:
    attrs = element.attrib
    who = int(attrs["who"])
    from_who = int(attrs.get("fromWho", attrs["who"]))
    win_tile_ids = parse_int_list(attrs.get("machi"))
    if len(win_tile_ids) != 1:
        return None

    winning_tile_id = win_tile_ids[0]
    concealed_ids = parse_int_list(attrs.get("hai"))
    if not concealed_ids:
        return None

    if winning_tile_id in concealed_ids and len(concealed_ids) % 3 == 2:
        concealed_ids = concealed_ids[:]
        concealed_ids.remove(winning_tile_id)

    decoded_melds = []
    for encoded in parse_int_list(attrs.get("m")):
        meld = decode_meld(encoded)
        if meld is None:
            return None
        decoded_melds.append(meld)

    ura = parse_int_list(attrs.get("uraHai") or attrs.get("uradoraHai") or attrs.get("doraHaiUra"))
    hand = HandModel(
        concealed_tiles=[tile_code(tile_id) for tile_id in concealed_ids],
        melds=[
            MeldModel(
                type=meld.type,
                tiles=[tile_code(tile_id) for tile_id in meld.tiles],
                open=meld.open,
                called_tile=tile_code(meld.called_tile) if meld.called_tile is not None else None,
            )
            for meld in decoded_melds
        ],
        winning_tile=tile_code(winning_tile_id),
        seat_wind=wind_for_player(who, dealer),
        round_wind=round_wind(round_index),
        win_method="tsumo" if who == from_who else "ron",
        riichi=tenhou_has_riichi(attrs),
        dora_indicators=[tile_code(tile_id) for tile_id in parse_int_list(attrs.get("doraHai"))],
        ura_dora_indicators=[tile_code(tile_id) for tile_id in ura] if ura else None,
    )

    answer = score_hand(hand, concealed_ids, winning_tile_id, decoded_melds)
    if answer is None or not tenhou_score_matches(attrs, answer):
        return None

    problem = ScoringProblemModel(id="", title="", tags=[], hand=hand, answer=answer)
    tags = coverage_tags(problem)
    problem = problem.model_copy(update={"tags": sorted(tags)})
    return Candidate(problem=problem, tags=tags, source=f"{source}#agari-{sequence}")


def tenhou_has_riichi(attrs: dict[str, str]) -> bool:
    values = parse_int_list(attrs.get("yaku"))
    yaku_ids = set(values[::2])
    return 1 in yaku_ids or 21 in yaku_ids


def tenhou_score_matches(attrs: dict[str, str], answer: AnswerModel) -> bool:
    ten = parse_int_list(attrs.get("ten"))
    if len(ten) >= 1 and answer.limit_tier == "none" and ten[0] != answer.fu:
        return False

    yaku_values = parse_int_list(attrs.get("yaku"))
    if yaku_values:
        tenhou_han = sum(yaku_values[1::2])
        if tenhou_han != answer.han:
            return False

    if len(ten) >= 3 and ten[2] > 0:
        expected_limit = TENHOU_LIMITS[ten[2]] if ten[2] < len(TENHOU_LIMITS) else "yakuman"
        if expected_limit != answer.limit_tier:
            return False

    return True


def tile_34(code: str) -> int:
    base = code.replace("r", "")
    if base in HONOR_CODES:
        return 27 + HONOR_CODES.index(base)
    rank = int(base[0])
    offset = {"m": 0, "p": 9, "s": 18}[base[1]]
    return offset + rank - 1


def tile_136_from_code(code: str, used: Counter[int]) -> int:
    tile_type = tile_34(code)
    copy = 0 if code.endswith("r") else used[tile_type] % 4
    used[tile_type] += 1
    return tile_type * 4 + copy


def score_hand(
    hand: HandModel,
    concealed_ids: list[int],
    winning_tile_id: int,
    decoded_melds: list[DecodedMeld],
) -> AnswerModel | None:
    from mahjong.constants import EAST, NORTH, SOUTH, WEST
    from mahjong.hand_calculating.hand import HandCalculator
    from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules
    from mahjong.meld import Meld

    wind_constants = {"east": EAST, "south": SOUTH, "west": WEST, "north": NORTH}
    tiles = [*concealed_ids, winning_tile_id]
    melds = []

    for decoded in decoded_melds:
        meld_type = {"chi": Meld.CHI, "pon": Meld.PON, "kan": Meld.KAN}[decoded.type]
        melds.append(Meld(meld_type=meld_type, tiles=list(decoded.tiles), opened=decoded.open))
        tiles.extend(decoded.tiles)

    config = HandConfig(
        is_tsumo=hand.win_method == "tsumo",
        is_riichi=hand.riichi,
        player_wind=wind_constants[hand.seat_wind],
        round_wind=wind_constants[hand.round_wind],
        options=OptionalRules(has_open_tanyao=True),
    )

    dora_ids = []
    for indicators in (hand.dora_indicators, hand.ura_dora_indicators or []):
        used: Counter[int] = Counter()
        for code in indicators:
            dora_ids.append(tile_136_from_code(code, used))

    result = HandCalculator().estimate_hand_value(
        tiles=tiles,
        win_tile=winning_tile_id,
        melds=melds,
        dora_indicators=dora_ids,
        config=config,
    )
    if result.error:
        return None
    if result.fu < 20:
        return None

    is_open_hand = any(decoded.open for decoded in decoded_melds)

    return AnswerModel(
        han=result.han,
        fu=result.fu,
        points=format_points(result.cost, hand),
        limit_tier=limit_tier(result.han, result.fu),
        yaku=[
            YakuBreakdownModel(
                name=yaku.name,
                han=yaku.han_open if is_open_hand else yaku.han_closed,
                english_name=yaku_english_name(yaku.name),
            )
            for yaku in result.yaku
        ],
        fu_breakdown=fu_breakdown(result.fu_details, result.fu, hand),
    )


def format_points(cost: dict[str, int], hand: HandModel) -> str:
    if hand.win_method == "ron":
        return str(cost["main"])
    if hand.seat_wind == "east":
        return f"{cost['main']} all"
    return f"{cost['additional']}/{cost['main']}"


def limit_tier(han: int, fu: int) -> LimitTier:
    if han >= 13:
        return "yakuman"
    if han >= 11:
        return "sanbaiman"
    if han >= 8:
        return "baiman"
    if han >= 6:
        return "haneman"
    if han >= 5 or (han == 4 and fu >= 40) or (han == 3 and fu >= 70):
        return "mangan"
    return "none"


def fu_groups(hand: HandModel) -> list[dict[str, Any]]:
    groups = [
        {
            "tile": meld.tiles[0],
            "type": "kan" if meld.type == "kan" else "triplet",
            "open": meld.open,
        }
        for meld in hand.melds
        if meld.type in {"pon", "kan"}
    ]

    counts = tile_counts([*hand.concealed_tiles, hand.winning_tile])
    for tile, count in counts.items():
        if count >= 3:
            groups.append(
                {
                    "tile": tile,
                    "type": "kan" if count >= 4 else "triplet",
                    "open": False,
                }
            )

    return groups


def value_pair_context(hand: HandModel) -> str | None:
    counts = tile_counts([*hand.concealed_tiles, hand.winning_tile])
    seat_wind_tile = wind_tile(hand.seat_wind)
    round_wind_tile = wind_tile(hand.round_wind)

    for tile, count in counts.items():
        if count != 2:
            continue
        if not is_dragon(tile) and tile != seat_wind_tile and tile != round_wind_tile:
            continue

        values = []
        if is_dragon(tile):
            values.append("dragon")
        if tile == seat_wind_tile:
            values.append("seat wind")
        if tile == round_wind_tile:
            values.append("round wind")
        return f"{format_tile_name(tile)} pair ({' and '.join(values)})"

    return None


def fu_context(item: FuBreakdownModel, hand: HandModel, groups: list[dict[str, Any]], used_groups: set[int]) -> str | None:
    name = item.name.lower()

    if "triplet" in name or "kan" in name:
        wants_kan = "kan" in name
        wants_open = "open" in name
        wants_closed = "closed" in name
        wants_terminal_honor = "terminal" in name or "honor" in name
        for index, group in enumerate(groups):
            if index in used_groups:
                continue
            if wants_kan != (group["type"] == "kan"):
                continue
            if wants_open and not group["open"]:
                continue
            if wants_closed and group["open"]:
                continue
            if wants_terminal_honor and not is_terminal_or_honor(group["tile"]):
                continue

            used_groups.add(index)
            return f"{format_tile_name(group['tile'])} {group['type']}"

    if "value pair" in name:
        return value_pair_context(hand)

    if "wait" in name:
        return f"{format_tile_name(hand.winning_tile)} wait"

    return None


def fu_breakdown(details: list[dict[str, Any]], total: int, hand: HandModel) -> list[FuBreakdownModel]:
    if not details:
        return [FuBreakdownModel(name="Total fu", fu=total, category="win method")]

    items = []
    for detail in details:
        name = str(detail.get("reason") or detail.get("name") or "Fu")
        fu = int(detail.get("fu", 0))
        lowered = name.lower()
        if "base" in lowered:
            if fu == 30:
                items.append(FuBreakdownModel(name="Base fu", fu=20, category="base"))
                items.append(FuBreakdownModel(name="Closed ron", fu=10, category="win method"))
                continue
            category = "base"
        elif (
            "valued_pair" in lowered
            or "value pair" in lowered
            or "pair_wait" in lowered
            or "kanchan" in lowered
            or "penchan" in lowered
            or "wait" in lowered
        ):
            category = "wait/pair"
        elif "ron" in lowered or "tsumo" in lowered or "chiitoitsu" in lowered or "hand_without_fu" in lowered:
            category = "win method"
        elif "round" in lowered:
            category = "rounding"
        else:
            category = "group"
        items.append(FuBreakdownModel(name=format_fu_name(name), fu=fu, category=category))

    groups = fu_groups(hand)
    used_groups: set[int] = set()
    items = [
        item.model_copy(update={"context": fu_context(item, hand, groups, used_groups)})
        for item in items
    ]
    return items


def format_fu_name(name: str) -> str:
    return FU_NAME_LABELS.get(name, name.replace("_", " ").capitalize())


def coverage_tags(problem: ScoringProblemModel) -> frozenset[str]:
    hand = problem.hand
    answer = problem.answer
    tags = {
        hand.win_method,
        "dealer" if hand.seat_wind == "east" else "non-dealer",
        "open" if any(meld.open for meld in hand.melds) else "closed",
        f"fu={answer.fu}",
        f"han={answer.han if answer.han < 5 else 'limit'}",
        f"limit={answer.limit_tier}",
    }
    if answer.fu is not None and answer.fu >= 50:
        tags.add("fu=50+")
    for yaku in answer.yaku:
        name = yaku.name.lower()
        if "riichi" in name:
            tags.add("riichi")
        if "tsumo" in name:
            tags.add("menzen tsumo")
        if "pinfu" in name:
            tags.add("pinfu")
        if "tanyao" in name:
            tags.add("tanyao")
        if "yakuhai" in name or "dragon" in name or "wind" in name:
            tags.add("yakuhai")
        if "chiitoitsu" in name or "seven pairs" in name:
            tags.add("chiitoitsu")
        if "dora" in name:
            tags.add("dora-heavy" if yaku.han >= 2 else "dora")
        if "honitsu" in name or "chinitsu" in name or "flush" in name:
            tags.add("flush/half-flush")
        if "toitoi" in name or "sanankou" in name:
            tags.add("triplet-style")
    if answer.fu == 25:
        tags.add("fixed fu")
    for item in answer.fu_breakdown or []:
        lowered = item.name.lower()
        if "wait" in lowered:
            tags.add("wait fu")
        if "ron" in lowered:
            tags.add("closed ron")
        if "valued_pair" in lowered or "value pair" in lowered:
            tags.add("value pair")
        if "pon" in lowered or "kan" in lowered or "triplet" in lowered:
            tags.add("triplet/kan fu")
    return frozenset(tags)


def select_diverse(candidates: list[Candidate], count: int, seed: int) -> list[Candidate]:
    rng = random.Random(seed)
    remaining = candidates[:]
    rng.shuffle(remaining)
    selected: list[Candidate] = []
    covered: set[str] = set()
    bucket_counts: Counter[str] = Counter()
    target_tags = {
        "ron",
        "tsumo",
        "dealer",
        "non-dealer",
        "closed",
        "open",
        "fu=20",
        "fu=25",
        "fu=30",
        "fu=40",
        "fu=50+",
        "han=1",
        "han=2",
        "han=3",
        "han=4",
        "riichi",
        "menzen tsumo",
        "pinfu",
        "tanyao",
        "yakuhai",
        "chiitoitsu",
        "dora-heavy",
        "flush/half-flush",
        "triplet-style",
    }
    max_limit_hands = max(3, count // 5)
    max_chiitoitsu_hands = max(2, count // 20)

    while remaining and len(selected) < count:
        best_index = 0
        best_score = -1_000_000
        limit_count = sum(1 for item in selected if item.problem.answer.limit_tier != "none")
        chiitoitsu_count = sum(1 for item in selected if "chiitoitsu" in item.tags)
        for index, candidate in enumerate(remaining[:2000]):
            score = 20 * len((candidate.tags & target_tags) - covered)
            is_limit = candidate.problem.answer.limit_tier != "none"

            if is_limit and limit_count >= max_limit_hands:
                score -= 200
            elif is_limit:
                score -= 12 * limit_count
            else:
                score += 8

            if "chiitoitsu" in candidate.tags:
                if chiitoitsu_count >= max_chiitoitsu_hands:
                    score -= 200
                else:
                    score -= 6 * chiitoitsu_count

            for tag in candidate.tags:
                if tag.startswith(("fu=", "han=", "limit=")):
                    score -= bucket_counts[tag] * (5 if tag == "fu=30" else 4 if tag.startswith("limit=") else 2)
            if score > best_score:
                best_score = score
                best_index = index

        candidate = remaining.pop(best_index)
        selected.append(candidate)
        covered.update(candidate.tags)
        for tag in candidate.tags:
            if tag.startswith(("fu=", "han=", "limit=")):
                bucket_counts[tag] += 1

    return selected


def inspect(args: argparse.Namespace) -> None:
    total_logs = 0
    total_candidates = 0
    tags: Counter[str] = Counter()
    for source in iter_sources(args):
        total_logs += 1
        candidates = parse_log(source)
        total_candidates += len(candidates)
        for candidate in candidates:
            tags.update(candidate.tags)

    print(f"Logs scanned: {total_logs}")
    print(f"Validated AGARI candidates: {total_candidates}")
    for tag, count in sorted(tags.items()):
        print(f"{tag}: {count}")


def problem_id(candidate: Candidate) -> str:
    payload = {
        "source": candidate.source,
        "hand": candidate.problem.hand.model_dump(by_alias=True, exclude_none=True),
        "answer": candidate.problem.answer.model_dump(by_alias=True, exclude_none=True),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()[:12]
    return f"tenhou-houou-{digest}"


def generate(args: argparse.Namespace) -> None:
    candidates: list[Candidate] = []
    scanned = 0
    for source in iter_sources(args):
        scanned += 1
        candidates.extend(parse_log(source))

    if not candidates:
        raise SystemExit(
            f"No validated AGARI candidates found after scanning {scanned} logs. "
            "Run --inspect against a houou-logs DB or exported XML directory and verify the source contains Tenhou mjlog XML."
        )

    selected = select_diverse(candidates, args.count, args.seed)
    problems = []
    for index, candidate in enumerate(selected, start=1):
        problem = candidate.problem.model_copy(
            update={
                "id": problem_id(candidate),
                "title": f"Tenhou Houou hand {index}",
                "tags": sorted(candidate.tags),
            }
        )
        problems.append(problem.model_dump(by_alias=True, exclude_none=True))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(problems, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(problems)} problems to {args.out} from {len(candidates)} validated candidates.")
    selected_tags: Counter[str] = Counter()
    for candidate in selected:
        selected_tags.update(candidate.tags)
    for tag, count in sorted(selected_tags.items()):
        print(f"{tag}: {count}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate scoring problems from local Tenhou Houou mjlog XML.")
    parser.add_argument("--houou-db", type=Path, help="SQLite DB produced by Apricot-S/houou-logs.")
    parser.add_argument("--xml-dir", type=Path, help="Directory containing exported .xml/.mjlog files.")
    parser.add_argument("--count", type=int, default=30, help="Number of problems to write.")
    parser.add_argument("--seed", type=int, default=1, help="Deterministic selection seed.")
    parser.add_argument("--out", type=Path, default=Path("src/problems.json"), help="Output JSON path.")
    parser.add_argument("--inspect", action="store_true", help="Report available validated candidates without writing.")
    parser.add_argument("--max-logs", type=int, default=None, help="Optional maximum number of logs to scan.")
    args = parser.parse_args()
    if args.houou_db is None and args.xml_dir is None:
        parser.error("pass --houou-db or --xml-dir")
    return args


def main() -> None:
    args = parse_args()
    if args.inspect:
        inspect(args)
    else:
        generate(args)


if __name__ == "__main__":
    main()
