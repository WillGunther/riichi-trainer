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

const GITHUB_ISSUES_URL = "https://github.com/WillGunther/richii-trainer/issues/new";
const TILE_SOURCE_URL = "https://github.com/FluffyStuff/riichi-mahjong-tiles";

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

function FloatingInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="inline-info-toggle" type="button" aria-label={label}>
          <Info size={13} strokeWidth={2.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="floating-popover info-popover" sideOffset={8} collisionPadding={12}>
          <Popover.Close className="popover-close" aria-label="Close">
            <X size={15} strokeWidth={2.5} />
          </Popover.Close>
          <div className="popover-copy">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
              {(["han", "fu", "points"] as const).map((key) => (
                <label className="toggle" key={key}>
                  <input
                    type="checkbox"
                    checked={enabled[key]}
                    onChange={(event) => setEnabled((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span>{key === "points" ? "score" : key}</span>
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
      </div>

      {hand.melds.length > 0 ? (
        <div className="tile-section">
          <h3>Called melds</h3>
          <div className="meld-list">
            {hand.melds.map((meld, meldIndex) => {
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
            <Tile tile={hand.winningTile} beginnerMode={beginnerMode} rotated />
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
        {submitted ? (
          <button className="primary-action next-action" type="button" onClick={onNextProblem}>
            Next hand
          </button>
        ) : null}
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
              <FieldShell label="Wait fu" status={status?.waitFu ?? "idle"}>
                <NumberInput value={inputs.waitFu} disabled={!enabled.fu} onChange={(value) => updateInput("waitFu", value)} />
              </FieldShell>
              <FieldShell label="Hand fu" status={status?.handFu ?? "idle"}>
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
        <h3>Score</h3>
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
              <FieldShell label={inputs.dealer ? "Non-dealers pay" : "Non-dealer pays"} status={status?.tsumoChildPoints ?? "idle"}>
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

          <FieldShell label="Score tier" status={status?.limitTier ?? "idle"}>
            <select
              value={inputs.limitTier}
              disabled={!enabled.points}
              onChange={(event) => updateInput("limitTier", event.target.value as LimitTier)}
            >
              {Object.entries(limitTierLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FieldShell>
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
            <span>Wait {totals.wait}</span>
            <span>Hand {totals.hand}</span>
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

export default function App() {
  const initialQueue = useMemo(() => shuffleProblemIds(), []);
  const [currentProblemId, setCurrentProblemId] = useState(initialQueue[0] ?? problems[0]?.id ?? "");
  const [handQueue, setHandQueue] = useState(initialQueue.slice(1));
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [fuInputMode, setFuInputMode] = useState<FuInputMode>("total");
  const [inputs, setInputs] = useState<AnswerInputs>(getEmptyInputs);
  const [enabled, setEnabled] = useState<EnabledInputs>({
    han: true,
    fu: true,
    points: true,
    limitTier: true,
    dealer: true,
    tsumo: true,
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sessionCounted, setSessionCounted] = useState(false);
  const [session, setSession] = useState({ correct: 0, incorrect: 0 });

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
        correct: current.correct + (result.correct ? 1 : 0),
        incorrect: current.incorrect + (result.correct ? 0 : 1),
      }));
      setSessionCounted(true);
    }
  }

  function nextProblem() {
    const nextQueue = handQueue.length > 0 ? handQueue : shuffleProblemIds(problem.id);
    const [nextProblemId, ...remainingQueue] = nextQueue;

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
            <button type="button" onClick={() => setSession({ correct: 0, incorrect: 0 })}>Reset</button>
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
    </main>
  );
}
