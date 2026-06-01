import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Info, Settings, X } from "lucide-react";
import { problems } from "./problems";
import { getEmptyInputs, getFuTotals, type AnswerInputs, type EnabledInputs, type FuInputMode, validateAnswer, type ValidationResult } from "./scoring";
import { Tile } from "./Tile";
import type { FieldStatus, LimitTier, Problem, TileCode, Wind } from "./types";
import type { Dispatch, ReactNode, SetStateAction } from "react";

const limitTierLabels: Record<LimitTier, string> = {
  none: "No limit",
  mangan: "Mangan",
  haneman: "Haneman",
  baiman: "Baiman",
  sanbaiman: "Sanbaiman",
  yakuman: "Yakuman",
};

const windTiles: Record<Wind, TileCode> = {
  east: "E",
  south: "S",
  west: "W",
  north: "N",
};

const GITHUB_ISSUES_URL = "https://github.com/WillGunther/riichi-trainer/issues/new";
const TILE_SOURCE_URL = "https://github.com/FluffyStuff/riichi-mahjong-tiles";
const pointChartHanColumns = [1, 2, 3, 4] as const;
const pointChartFuRows = [20, 25, 30, 40, 50, 60, 70] as const;

const limitPointRows = [
  { tier: "mangan", label: "Mangan", han: "5 han", basePoints: 2000 },
  { tier: "haneman", label: "Haneman", han: "6-7 han", basePoints: 3000 },
  { tier: "baiman", label: "Baiman", han: "8-10 han", basePoints: 4000 },
  { tier: "sanbaiman", label: "Sanbaiman", han: "11-12 han", basePoints: 6000 },
  { tier: "yakuman", label: "Yakuman", han: "13+ han", basePoints: 8000 },
] as const;

function formatPointValue(value: number) {
  return value.toLocaleString("en-US");
}

function roundUpToHundred(value: number) {
  return Math.ceil(value / 100) * 100;
}

function getBasePoints(han: number, fu: number) {
  const raw = fu * 2 ** (han + 2);

  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5 || raw >= 2000) return 2000;

  return raw;
}

function getChartCell(han: number, fu: number, dealer: boolean) {
  if (han === 1 && (fu === 20 || fu === 25)) {
    return null;
  }

  const basePoints = getBasePoints(han, fu);
  const limitLabel = basePoints >= 2000 ? "Mangan" : null;

  if (dealer) {
    return {
      label: limitLabel,
      ron: formatPointValue(roundUpToHundred(basePoints * 6)),
      tsumo: formatPointValue(roundUpToHundred(basePoints * 2)),
      tsumoSuffix: "all",
    };
  }

  return {
      label: limitLabel,
      ron: formatPointValue(roundUpToHundred(basePoints * 4)),
      tsumo: `${formatPointValue(roundUpToHundred(basePoints))} / ${formatPointValue(roundUpToHundred(basePoints * 2))}`,
      tsumoSuffix: undefined,
  };
}

function shuffleProblemIds(previousProblemId?: string) {
  const ids = problems.map((problem) => problem.id);

  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }

  if (previousProblemId && ids.length > 1 && ids[0] === previousProblemId) {
    [ids[0], ids[1]] = [ids[1], ids[0]];
  }

  return ids;
}

function getHandIssueUrl(problemId: string) {
  const params = new URLSearchParams({
    title: `Issue with hand: ${problemId}`,
    body: `Hand id: ${problemId}`,
  });

  return `${GITHUB_ISSUES_URL}?${params.toString()}`;
}

function getToolIssueUrl() {
  const params = new URLSearchParams({
    title: "Issue with the scoring trainer",
  });

  return `${GITHUB_ISSUES_URL}?${params.toString()}`;
}

function FieldShell({
  label,
  status,
  action,
  children,
}: {
  label: string;
  status: FieldStatus;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`field ${status}`}>
      <span>
        {label}
        {action}
      </span>
      {children}
    </div>
  );
}

function FloatingInfo({
  label,
  children,
  wide = false,
  stayOpenOnInteract = false,
  side = "top",
  align = "center",
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  stayOpenOnInteract?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger asChild>
        <button className="inline-info-toggle" type="button" aria-label={label}>
          <Info size={13} strokeWidth={2.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`floating-popover info-popover ${wide ? "wide-popover" : ""}`}
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={12}
          onInteractOutside={stayOpenOnInteract ? (event) => event.preventDefault() : undefined}
        >
          <Popover.Close className="popover-close" aria-label="Close">
            <X size={15} strokeWidth={2.5} />
          </Popover.Close>
          <div className="popover-copy">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PointsReference() {
  return (
    <div className="points-reference">
      <p className="points-reference-note">Cells show ron first and tsumo in parentheses. Non-dealer tsumo is point from (non-dealer / dealer).</p>

      <table className="points-chart-table">
        <colgroup>
          <col className="points-side-col" />
          <col className="points-side-col" />
          <col className="points-side-col" />
          <col className="points-side-col" />
          <col className="points-fu-col" />
          <col className="points-side-col" />
          <col className="points-side-col" />
          <col className="points-side-col" />
          <col className="points-side-col" />
        </colgroup>
        <thead>
          <tr>
            <th className="span-header" scope="col" colSpan={4}>
              Dealer
            </th>
            <th className="fu-spacer" scope="col" rowSpan={2} aria-label="Fu" />
            <th className="span-header" scope="col" colSpan={4}>
              Non-dealer
            </th>
          </tr>
          <tr>
            {pointChartHanColumns
              .slice()
              .reverse()
              .map((han) => (
                <th scope="col" key={`dealer-${han}`}>
                  {han} han
                </th>
              ))}
            {pointChartHanColumns.map((han) => (
              <th scope="col" key={`non-dealer-${han}`}>
                {han} han
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pointChartFuRows.map((fu) => (
            <tr key={fu}>
              {pointChartHanColumns
                .slice()
                .reverse()
                .map((han) => {
                  const cell = getChartCell(han, fu, true);

                  return (
                    <td key={`${fu}-dealer-${han}`}>
                      {cell ? (
                        <>
                          <span className="points-main">{cell.label ?? cell.ron}</span>
                          <span className="points-sub">
                            ({cell.tsumo}) {cell.tsumoSuffix ?? ""}
                          </span>
                        </>
                      ) : (
                        <span className="points-main unavailable">-</span>
                      )}
                    </td>
                  );
                })}
              <th scope="row" className="fu-cell">
                {fu} fu
              </th>
              {pointChartHanColumns.map((han) => {
                const cell = getChartCell(han, fu, false);

                return (
                  <td key={`${fu}-non-dealer-${han}`}>
                    {cell ? (
                      <>
                        <span className="points-main">{cell.label ?? cell.ron}</span>
                        <span className="points-sub points-sub-inline">({cell.tsumo})</span>
                      </>
                    ) : (
                      <span className="points-main unavailable">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="points-limit-table">
        <thead>
          <tr>
            <th scope="col">Tier</th>
            <th scope="col">Han</th>
            <th scope="col">Dealer</th>
            <th scope="col">Non-dealer</th>
          </tr>
        </thead>
        <tbody>
          {limitPointRows.map((row) => (
            <tr key={row.tier}>
              <th scope="row">{row.label}</th>
              <td>{row.han}</td>
              <td>
                <span className="points-main">{formatPointValue(roundUpToHundred(row.basePoints * 6))}</span>
                <span className="points-sub">({formatPointValue(roundUpToHundred(row.basePoints * 2))} all)</span>
              </td>
              <td>
                <span className="points-main">{formatPointValue(roundUpToHundred(row.basePoints * 4))}</span>
                <span className="points-sub">
                  ({formatPointValue(roundUpToHundred(row.basePoints))} / {formatPointValue(roundUpToHundred(row.basePoints * 2))})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TileOrder({ tiles, beginnerMode }: { tiles: TileCode[]; beginnerMode: boolean }) {
  return (
    <div className="tile-order">
      {tiles.map((tile, index) => (
        <span className="tile-order-step" key={`${tile}-${index}`}>
          <Tile tile={tile} beginnerMode={beginnerMode} />
          {index < tiles.length - 1 ? <span className="order-arrow">{">"}</span> : null}
        </span>
      ))}
    </div>
  );
}

function SettingsMenu({
  beginnerMode,
  setBeginnerMode,
  enabled,
  setEnabled,
  fuInputMode,
  setFuInputMode,
}: {
  beginnerMode: boolean;
  setBeginnerMode: Dispatch<SetStateAction<boolean>>;
  enabled: EnabledInputs;
  setEnabled: Dispatch<SetStateAction<EnabledInputs>>;
  fuInputMode: FuInputMode;
  setFuInputMode: (mode: FuInputMode) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="settings-button" type="button" aria-label="Open settings">
          <Settings size={20} strokeWidth={2.3} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="floating-popover settings-popover" align="end" sideOffset={10} collisionPadding={12}>
          <div className="settings-heading">
            <h2>Settings</h2>
            <Popover.Close className="popover-close inline-close" aria-label="Close settings">
              <X size={15} strokeWidth={2.5} />
            </Popover.Close>
          </div>

          <div className="settings-section">
            <h3>Display</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={beginnerMode}
                onChange={(event) => setBeginnerMode(event.target.checked)}
              />
              <span>Beginner tile labels</span>
            </label>
          </div>

          <div className="settings-section">
            <h3>Answer fields</h3>
            <div className="settings-toggle-grid">
              {(["han", "fu", "points", "limitTier"] as const).map((key) => (
                <label className="toggle" key={key}>
                  <input
                    type="checkbox"
                    checked={enabled[key]}
                    onChange={(event) => setEnabled((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span>{key === "points" ? "score" : key === "limitTier" ? "limit tier" : key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h3>Fu mode</h3>
            <div className="segmented compact-segmented" role="group" aria-label="Fu input mode">
              <button className={fuInputMode === "total" ? "active" : ""} onClick={() => setFuInputMode("total")} type="button">
                Total
              </button>
              <button className={fuInputMode === "split" ? "active" : ""} onClick={() => setFuInputMode("split")} type="button">
                Split
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BinaryField({
  label,
  checked,
  disabled,
  status,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  status: FieldStatus;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`field binary-field ${status}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function HandDisplay({ problem, beginnerMode }: { problem: Problem; beginnerMode: boolean }) {
  const hand = problem.hand;
  const concealedKanMelds = hand.melds.filter((meld) => meld.type === "kan" && !meld.open);
  const calledMelds = hand.melds.filter((meld) => meld.open);

  return (
    <section className="panel hand-panel" aria-labelledby="hand-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Practice hand</p>
          <h2 id="hand-title">Score the hand</h2>
        </div>
      </div>

      <div className="tile-section">
        <h3>Concealed tiles</h3>
        <div className="tiles">
          {hand.concealedTiles.map((tile, index) => (
            <Tile key={`${tile}-${index}`} tile={tile} beginnerMode={beginnerMode} />
          ))}
        </div>
        {concealedKanMelds.length > 0 ? (
          <div className="meld-list concealed-kan-list">
            {concealedKanMelds.map((meld, meldIndex) => (
              <div className="tiles meld concealed-kan" key={`concealed-kan-${meldIndex}`}>
                {meld.tiles.map((tile, tileIndex) => (
                  <Tile key={`${tile}-${tileIndex}`} tile={tile} beginnerMode={beginnerMode} faceDown={tileIndex === 0 || tileIndex === 3} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {calledMelds.length > 0 ? (
        <div className="tile-section">
          <h3>Called melds</h3>
          <div className="meld-list">
            {calledMelds.map((meld, meldIndex) => {
              const calledTileIndex = meld.calledTile
                ? meld.tiles.findIndex((tile) => tile === meld.calledTile)
                : -1;

              return (
                <div className="tiles meld" key={`${meld.type}-${meldIndex}`}>
                  {meld.tiles.map((tile, tileIndex) => (
                    <Tile
                      key={`${tile}-${tileIndex}`}
                      tile={tile}
                      beginnerMode={beginnerMode}
                      rotated={tileIndex === calledTileIndex}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="hand-details">
        <div>
          <span className="detail-label">Win</span>
          <div className="win-value">
            <Tile tile={hand.winningTile} beginnerMode={beginnerMode} rotated={hand.winMethod === "ron"} />
            <strong>{hand.winMethod}</strong>
          </div>
        </div>
        <div>
          <span className="detail-label">
            Dora indicators
            <FloatingInfo label="Show dora indicator order">
              <div>
                <p>Dragon dora order</p>
                <TileOrder tiles={["P", "F", "C", "P"]} beginnerMode={beginnerMode} />
              </div>
              <div>
                <p>Wind dora order</p>
                <TileOrder tiles={["E", "S", "W", "N", "E"]} beginnerMode={beginnerMode} />
              </div>
            </FloatingInfo>
          </span>
          <div className="tiles compact">
            {hand.doraIndicators.map((tile, index) => (
              <Tile key={`${tile}-${index}`} tile={tile} beginnerMode={beginnerMode} muted />
            ))}
          </div>
        </div>
        {hand.uraDoraIndicators && hand.uraDoraIndicators.length > 0 ? (
          <div>
            <span className="detail-label">Ura dora indicators</span>
            <div className="tiles compact">
              {hand.uraDoraIndicators.map((tile, index) => (
                <Tile key={`${tile}-${index}`} tile={tile} beginnerMode={beginnerMode} muted />
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <span className="detail-label">Seat wind</span>
          <div className="wind-value">
            <Tile tile={windTiles[hand.seatWind]} beginnerMode={beginnerMode} />
          </div>
        </div>
        <div>
          <span className="detail-label">Round wind</span>
          <div className="wind-value">
            <Tile tile={windTiles[hand.roundWind]} beginnerMode={beginnerMode} />
          </div>
        </div>
        <div>
          <span className="detail-label">Riichi</span>
          <strong>{hand.riichi ? "yes" : "no"}</strong>
        </div>
      </div>
    </section>
  );
}

function AnswerPanel({
  inputs,
  setInputs,
  enabled,
  fuInputMode,
  validation,
  problem,
  submitted,
  onSubmit,
  onNextProblem,
}: {
  inputs: AnswerInputs;
  setInputs: Dispatch<SetStateAction<AnswerInputs>>;
  enabled: EnabledInputs;
  fuInputMode: FuInputMode;
  validation: ValidationResult | null;
  problem: Problem;
  submitted: boolean;
  onSubmit: () => void;
  onNextProblem: () => void;
}) {
  const status = validation?.statuses;
  const updateInput = <K extends keyof AnswerInputs>(key: K, value: AnswerInputs[K]) => setInputs((current) => ({ ...current, [key]: value }));

  return (
    <section className="panel" aria-labelledby="answer-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Your answer</p>
          <h2 id="answer-title">Score this hand</h2>
        </div>
        <button className="primary-action next-action" type="button" onClick={onNextProblem}>
          Next hand
        </button>
      </div>

      <div className="answer-group">
        <h3>Han</h3>
        <div className="answer-grid">
          <FieldShell label="Han" status={status?.han ?? "idle"}>
            <NumberInput value={inputs.han} disabled={!enabled.han} onChange={(value) => updateInput("han", value)} />
          </FieldShell>
        </div>
      </div>

      <div className="answer-group">
        <h3>Fu</h3>

        <div className="answer-grid">
          {fuInputMode === "total" ? (
            <FieldShell
              label="Fu"
              status={status?.fu ?? "idle"}
              action={
                <FloatingInfo label="Show fu total help">
                  <p>Total fu is 20 base plus additional fu, rounded up.</p>
                </FloatingInfo>
              }
            >
              <NumberInput value={inputs.fu} disabled={!enabled.fu} onChange={(value) => updateInput("fu", value)} />
            </FieldShell>
          ) : (
            <>
              <FieldShell label="Group fu" status={status?.groupFu ?? "idle"}>
                <NumberInput value={inputs.groupFu} disabled={!enabled.fu} onChange={(value) => updateInput("groupFu", value)} />
              </FieldShell>
              <FieldShell label="Wait/pair fu" status={status?.waitFu ?? "idle"}>
                <NumberInput value={inputs.waitFu} disabled={!enabled.fu} onChange={(value) => updateInput("waitFu", value)} />
              </FieldShell>
              <FieldShell label="Win method fu" status={status?.handFu ?? "idle"}>
                <NumberInput value={inputs.handFu} disabled={!enabled.fu} onChange={(value) => updateInput("handFu", value)} />
              </FieldShell>
              <FieldShell
                label="Total fu"
                status={status?.totalFu ?? "idle"}
                action={
                  <FloatingInfo label="Show total fu help">
                    <p>Total fu is 20 base plus additional fu, rounded up.</p>
                    <p>Chiitoitsu is special: in split-fu mode, only total fu is checked.</p>
                  </FloatingInfo>
                }
              >
                <NumberInput value={inputs.totalFu} disabled={!enabled.fu} onChange={(value) => updateInput("totalFu", value)} />
              </FieldShell>
            </>
          )}
        </div>
      </div>

      <div className="answer-group">
        <h3>
          Score
          <FloatingInfo label="Show point values" wide align="center" side="top" stayOpenOnInteract>
            <PointsReference />
          </FloatingInfo>
        </h3>
        <div className="answer-grid">
          <BinaryField
            label="Dealer"
            checked={inputs.dealer}
            disabled={!enabled.points}
            status={status?.dealer ?? "idle"}
            onChange={(checked) => updateInput("dealer", checked)}
          />

          <BinaryField
            label="Tsumo"
            checked={inputs.tsumo}
            disabled={!enabled.points}
            status={status?.tsumo ?? "idle"}
            onChange={(checked) => updateInput("tsumo", checked)}
          />

          {inputs.tsumo ? (
            <>
              <FieldShell label={inputs.dealer ? "Points from all" : "Non-dealer pays"} status={status?.tsumoChildPoints ?? "idle"}>
                <input
                  value={inputs.tsumoChildPoints}
                  disabled={!enabled.points}
                  onChange={(event) => updateInput("tsumoChildPoints", event.target.value)}
                />
              </FieldShell>
              {!inputs.dealer ? (
                <FieldShell label="Dealer pays" status={status?.tsumoDealerPoints ?? "idle"}>
                  <input
                    value={inputs.tsumoDealerPoints}
                    disabled={!enabled.points}
                    onChange={(event) => updateInput("tsumoDealerPoints", event.target.value)}
                  />
                </FieldShell>
              ) : null}
            </>
          ) : (
            <FieldShell label="Points" status={status?.points ?? "idle"}>
              <input value={inputs.points} disabled={!enabled.points} onChange={(event) => updateInput("points", event.target.value)} />
            </FieldShell>
          )}

          {enabled.points && enabled.limitTier ? (
            <FieldShell label="Score tier" status={status?.limitTier ?? "idle"}>
              <select value={inputs.limitTier} onChange={(event) => updateInput("limitTier", event.target.value as LimitTier)}>
                {Object.entries(limitTierLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldShell>
          ) : null}
        </div>
      </div>

      <button className="primary-action" type="button" onClick={onSubmit} disabled={submitted}>
        {submitted ? "Answer submitted" : "Submit answer"}
      </button>

      {submitted && validation ? (
        <p className={`result ${validation.correct ? "success" : "error"}`}>
          {validation.correct ? "Correct." : "Incorrect: check the red fields."}
        </p>
      ) : null}
    </section>
  );
}

function Explanation({ problem, validation }: { problem: Problem; validation: ValidationResult | null }) {
  const answer = problem.answer;
  const totals = validation?.expectedFuTotals ?? getFuTotals(answer);
  const limitText = answer.limitTier === "none" ? "No limit tier" : limitTierLabels[answer.limitTier];
  const problemHash = problem.id.replace(/^tenhou-houou-/, "");

  return (
    <section className="panel explanation" aria-labelledby="explanation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Explanation</p>
          <h2 id="explanation-title">Correct answer</h2>
        </div>
        <strong className="answer-summary">
          {answer.han} han {answer.fu ? `${answer.fu} fu` : ""} · {limitText} · {answer.points}
        </strong>
      </div>

      <div className="breakdown-grid">
        <div>
          <h3>Han</h3>
          <ul className="breakdown-list">
            {answer.yaku.map((yaku) => (
              <li key={yaku.name}>
                <span>{yaku.han} han</span>
                <strong>{yaku.name}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Fu</h3>
          <ul className="breakdown-list">
            {(answer.fuBreakdown ?? []).map((fu) => (
              <li key={`${fu.name}-${fu.fu}`}>
                <span>{fu.fu} fu</span>
                <strong>{fu.name}</strong>
                <em>{fu.category}</em>
              </li>
            ))}
          </ul>
          <div className="fu-totals">
            <span>Group {totals.group}</span>
            <span>Wait/pair {totals["wait/pair"]}</span>
            <span>Win method {totals["win method"]}</span>
            <span>Before rounding {totals.preRound}</span>
            <strong>Total {totals.rounded}</strong>
          </div>
        </div>
      </div>

      {answer.limitTier !== "none" ? (
        <p className="limit-note">
          This hand uses the {limitTierLabels[answer.limitTier]} shortcut, so the final points come from the limit tier. Fu can still be useful for learning, but it does not change this score.
        </p>
      ) : null}

      <p className="problem-hash" aria-label={`Problem hash ${problemHash}`}>
        {problemHash}
      </p>
    </section>
  );
}

function ReportFooter({ problemId }: { problemId: string }) {
  return (
    <footer className="app-footer">
      <div>
        See an issue with this hand?{" "}
        <a href={getHandIssueUrl(problemId)} target="_blank" rel="noreferrer">
          Report it here.
        </a>
      </div>
      <div>
        See an issue with the tool?{" "}
        <a href={getToolIssueUrl()} target="_blank" rel="noreferrer">
          Report it here.
        </a>
      </div>
      <div>
        Tile art from{" "}
        <a href={TILE_SOURCE_URL} target="_blank" rel="noreferrer">
          FluffyStuff/riichi-mahjong-tiles
        </a>
      </div>
    </footer>
  );
}

function EndOfHandsNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="notice-backdrop" role="presentation">
      <section className="panel notice-dialog" role="dialog" aria-modal="true" aria-labelledby="end-of-hands-title">
        <p className="eyebrow">Table reset</p>
        <h2 id="end-of-hands-title">You reached the end of the current hands</h2>
        <p>The trainer reshuffled the set, so hands you have already seen will appear again. More hands will be generated in the future once we are confident in the generation process.</p>
        <button className="primary-action" type="button" onClick={onDismiss}>
          Continue
        </button>
      </section>
    </div>
  );
}

export default function App() {
  const initialQueue = useMemo(() => shuffleProblemIds(), []);
  const [currentProblemId, setCurrentProblemId] = useState(initialQueue[0] ?? problems[0]?.id ?? "");
  const [handQueue, setHandQueue] = useState(initialQueue.slice(1));
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [fuInputMode, setFuInputMode] = useState<FuInputMode>("total");
  const [inputs, setInputs] = useState<AnswerInputs>(getEmptyInputs);
  const [enabled, setEnabled] = useState<EnabledInputs>({
    han: true,
    fu: true,
    points: true,
    limitTier: false,
    dealer: true,
    tsumo: true,
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sessionCounted, setSessionCounted] = useState(false);
  const [session, setSession] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [showEndOfHandsNotice, setShowEndOfHandsNotice] = useState(false);

  const problem = problems.find((candidate) => candidate.id === currentProblemId) ?? problems[0];

  const selectedValidation = useMemo(() => {
    if (!submitted) return validation;
    return validateAnswer(inputs, problem, enabled, fuInputMode);
  }, [enabled, fuInputMode, inputs, problem, submitted, validation]);

  function submitAnswer() {
    const result = validateAnswer(inputs, problem, enabled, fuInputMode);
    setValidation(result);
    setSubmitted(true);
    if (!sessionCounted) {
      setSession((current) => ({
        ...current,
        correct: current.correct + (result.correct ? 1 : 0),
        incorrect: current.incorrect + (result.correct ? 0 : 1),
      }));
      setSessionCounted(true);
    }
  }

  function nextProblem() {
    if (!submitted && !sessionCounted) {
      setSession((current) => ({
        ...current,
        skipped: current.skipped + 1,
      }));
    }

    const reachedEndOfHands = handQueue.length === 0;
    const nextQueue = reachedEndOfHands ? shuffleProblemIds(problem.id) : handQueue;
    const [nextProblemId, ...remainingQueue] = nextQueue;

    if (reachedEndOfHands) {
      setShowEndOfHandsNotice(true);
    }

    setCurrentProblemId(nextProblemId ?? problem.id);
    setHandQueue(remainingQueue);
    setInputs(getEmptyInputs());
    setValidation(null);
    setSubmitted(false);
    setSessionCounted(false);
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Riichi Mahjong</p>
          <h1>Scoring Trainer</h1>
        </div>
        <div className="top-actions">
          <div className="session-stats" aria-label="Session score">
            <span>Correct <strong>{session.correct}</strong></span>
            <span>Incorrect <strong>{session.incorrect}</strong></span>
            <span>Skipped <strong>{session.skipped}</strong></span>
            <button type="button" onClick={() => setSession({ correct: 0, incorrect: 0, skipped: 0 })}>Reset</button>
          </div>
          <SettingsMenu
            beginnerMode={beginnerMode}
            setBeginnerMode={setBeginnerMode}
            enabled={enabled}
            setEnabled={setEnabled}
            fuInputMode={fuInputMode}
            setFuInputMode={setFuInputMode}
          />
        </div>
      </header>

      <div className="main-grid">
        <HandDisplay problem={problem} beginnerMode={beginnerMode} />
        <AnswerPanel
          inputs={inputs}
          setInputs={setInputs}
          enabled={enabled}
          fuInputMode={fuInputMode}
          validation={selectedValidation}
          problem={problem}
          submitted={submitted}
          onSubmit={submitAnswer}
          onNextProblem={nextProblem}
        />
      </div>

      {submitted ? (
        <Explanation problem={problem} validation={selectedValidation} />
      ) : null}

      <ReportFooter problemId={problem.id} />

      {showEndOfHandsNotice ? (
        <EndOfHandsNotice onDismiss={() => setShowEndOfHandsNotice(false)} />
      ) : null}
    </main>
  );
}
