import { useState } from 'react'
import {
  GENERATORS,
  MILESTONES,
  PRESTIGE,
  UPGRADES,
  WORKERS,
  ZONES,
} from '../game/catalog'
import {
  canRebirth,
  generatorCost,
  milestoneReady,
  prestigeCost,
  sparksFromRun,
  upgradeCost,
  workerCost,
  zoneUnlocked,
} from '../game/economy'
import { formatResin } from '../lib/format'
import type {
  GameState,
  GeneratorId,
  MilestoneId,
  PrestigeId,
  UpgradeId,
  WorkerId,
  ZoneId,
} from '../types'

type Tab = 'workers' | 'grove' | 'upgrades' | 'areas' | 'rebirth' | 'goals'

interface Props {
  state: GameState
  onBuyGenerator: (id: GeneratorId) => void
  onBuyWorker: (id: WorkerId) => void
  onBuyUpgrade: (id: UpgradeId) => void
  onBuyPrestige: (id: PrestigeId) => void
  onUnlockZone: (id: ZoneId) => void
  onClaimMilestone: (id: MilestoneId) => void
  onRebirth: () => void
}

export function ShopPanel({
  state,
  onBuyGenerator,
  onBuyWorker,
  onBuyUpgrade,
  onBuyPrestige,
  onUnlockZone,
  onClaimMilestone,
  onRebirth,
}: Props) {
  const [tab, setTab] = useState<Tab>('workers')
  const claimable = MILESTONES.filter((m) => milestoneReady(state, m.id)).length
  const nextSparks = sparksFromRun(state.totalResin)
  const rebirthReady = canRebirth(state)

  const tabs: [Tab, string][] = [
    ['workers', 'Workers'],
    ['grove', 'Grove'],
    ['upgrades', 'Upgrades'],
    ['areas', 'Areas'],
    ['rebirth', rebirthReady ? `Rebirth (${nextSparks})` : 'Rebirth'],
    ['goals', claimable > 0 ? `Goals (${claimable})` : 'Goals'],
  ]

  return (
    <aside className="shop">
      <div className="shop-tabs shop-tabs-wrap" role="tablist" aria-label="Shop sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`shop-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'workers' ? (
        <section>
          <h2>Hire workers</h2>
          <p className="shop-lead">
            Gatherers walk unlocked areas and haul resin to the vat.
          </p>
          <ul className="shop-list">
            {WORKERS.map((w) => {
              const owned = state.workers[w.id]
              const cost = workerCost(w.id, owned)
              const open = zoneUnlocked(state, w.zone)
              const canBuy = open && state.resin >= cost
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    className="shop-item"
                    disabled={!canBuy}
                    onClick={() => onBuyWorker(w.id)}
                  >
                    <span className="shop-item-top">
                      <span className="shop-item-name">
                        <span
                          className="swatch"
                          style={{ background: w.hue, borderColor: w.accent }}
                        />
                        {w.name}
                      </span>
                      <span className="shop-item-owned">×{owned}</span>
                    </span>
                    <span className="shop-item-blurb">
                      {open ? w.blurb : `Locked — unlock ${w.zone} first.`}
                    </span>
                    <span className="shop-item-meta">
                      <span>+{w.baseRate}/s · {w.zone}</span>
                      <span className="cost">{formatResin(cost)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {tab === 'grove' ? (
        <section>
          <h2>Grow the grove</h2>
          <p className="shop-lead">Buildings unlock with new areas.</p>
          <ul className="shop-list">
            {GENERATORS.map((g) => {
              const owned = state.generators[g.id]
              const cost = generatorCost(g.id, owned)
              const open = zoneUnlocked(state, g.zone)
              const canBuy = open && state.resin >= cost
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className="shop-item"
                    disabled={!canBuy}
                    onClick={() => onBuyGenerator(g.id)}
                  >
                    <span className="shop-item-top">
                      <span className="shop-item-name">{g.name}</span>
                      <span className="shop-item-owned">×{owned}</span>
                    </span>
                    <span className="shop-item-blurb">
                      {open ? g.blurb : `Locked — unlock ${g.zone} first.`}
                    </span>
                    <span className="shop-item-meta">
                      <span>+{g.baseRate}/s · {g.zone}</span>
                      <span className="cost">{formatResin(cost)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {tab === 'upgrades' ? (
        <section>
          <h2>Deepen the roots</h2>
          <p className="shop-lead">Run upgrades reset on rebirth.</p>
          <ul className="shop-list">
            {UPGRADES.map((u) => {
              const owned = state.upgrades[u.id]
              const cost = upgradeCost(u.id, owned)
              const canBuy = state.resin >= cost
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    className="shop-item"
                    disabled={!canBuy}
                    onClick={() => onBuyUpgrade(u.id)}
                  >
                    <span className="shop-item-top">
                      <span className="shop-item-name">{u.name}</span>
                      <span className="shop-item-owned">×{owned}</span>
                    </span>
                    <span className="shop-item-blurb">{u.blurb}</span>
                    <span className="shop-item-meta">
                      <span>
                        {u.effectLabel} · Lv {owned}
                      </span>
                      <span className="cost">{formatResin(cost)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {tab === 'areas' ? (
        <section>
          <h2>Expand the map</h2>
          <p className="shop-lead">
            Unlock new biomes for a bigger grove, more workers, and buildings.
          </p>
          <ul className="shop-list">
            {ZONES.map((z) => {
              const owned = state.unlockedZones.includes(z.id)
              const canBuy =
                !owned &&
                state.resin >= z.resinCost &&
                state.sparks >= z.sparkCost
              return (
                <li key={z.id}>
                  <button
                    type="button"
                    className={`shop-item${owned ? ' is-owned' : ''}`}
                    disabled={owned || !canBuy}
                    onClick={() => onUnlockZone(z.id)}
                  >
                    <span className="shop-item-top">
                      <span className="shop-item-name">{z.name}</span>
                      <span className="shop-item-owned">
                        {owned ? 'Open' : 'Unlock'}
                      </span>
                    </span>
                    <span className="shop-item-blurb">{z.blurb}</span>
                    <span className="shop-item-meta">
                      <span>
                        {z.resinCost > 0
                          ? `${formatResin(z.resinCost)} resin`
                          : 'Starter'}
                        {z.sparkCost > 0 ? ` · ${z.sparkCost} sparks` : ''}
                      </span>
                      <span className="cost">
                        {owned ? '—' : z.resinCost > 0 ? formatResin(z.resinCost) : 'Free'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {tab === 'rebirth' ? (
        <section>
          <h2>Rebirth</h2>
          <p className="shop-lead">
            Reset the run for Amber Sparks. Sparks, permanent upgrades, and
            unlocked areas stay.
          </p>
          <div className="rebirth-card">
            <p>
              This run: <strong>{formatResin(state.totalResin)}</strong> resin
            </p>
            <p>
              Sparks on rebirth:{' '}
              <strong className="cost">+{nextSparks}</strong>
            </p>
            <p>
              You own <strong>{state.sparks}</strong> sparks ·{' '}
              <strong>{state.rebirths}</strong> rebirths
            </p>
            <button
              type="button"
              className="rebirth-btn"
              disabled={!rebirthReady}
              onClick={onRebirth}
            >
              {rebirthReady
                ? `Rebirth for +${nextSparks} sparks`
                : `Need ${formatResin(1_000_000)} resin this run`}
            </button>
          </div>

          <h2 className="subhead">Permanent upgrades</h2>
          <p className="shop-lead">Spend Amber Sparks. These survive rebirth.</p>
          <ul className="shop-list">
            {PRESTIGE.map((p) => {
              const owned = state.prestige[p.id]
              const maxed = owned >= p.maxLevel
              const cost = prestigeCost(p.id, owned)
              const canBuy = !maxed && state.sparks >= cost
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="shop-item"
                    disabled={!canBuy}
                    onClick={() => onBuyPrestige(p.id)}
                  >
                    <span className="shop-item-top">
                      <span className="shop-item-name">{p.name}</span>
                      <span className="shop-item-owned">
                        {owned}/{p.maxLevel}
                      </span>
                    </span>
                    <span className="shop-item-blurb">{p.blurb}</span>
                    <span className="shop-item-meta">
                      <span>{p.effectLabel}</span>
                      <span className="cost">
                        {maxed ? 'MAX' : `${cost} sparks`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {tab === 'goals' ? (
        <section>
          <h2>Grove goals</h2>
          <p className="shop-lead">Hit milestones for lump-sum resin rewards.</p>
          <ul className="shop-list">
            {MILESTONES.map((m) => {
              const claimed = state.claimedMilestones.includes(m.id)
              const ready = milestoneReady(state, m.id)
              const progress =
                m.needTotal > 0
                  ? Math.min(1, state.totalResin / m.needTotal)
                  : ready || claimed
                    ? 1
                    : 0
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`shop-item${ready ? ' is-ready' : ''}`}
                    disabled={!ready}
                    onClick={() => onClaimMilestone(m.id)}
                  >
                    <span className="shop-item-top">
                      <span className="shop-item-name">{m.name}</span>
                      <span className="shop-item-owned">
                        {claimed
                          ? 'Done'
                          : ready
                            ? 'Claim'
                            : `${Math.floor(progress * 100)}%`}
                      </span>
                    </span>
                    <span className="shop-item-blurb">{m.blurb}</span>
                    <span className="goal-bar" aria-hidden>
                      <span style={{ width: `${progress * 100}%` }} />
                    </span>
                    <span className="shop-item-meta">
                      <span>
                        {m.needRebirths
                          ? `${m.needRebirths}+ rebirths`
                          : m.needSparks
                            ? `${m.needSparks} sparks`
                            : `${formatResin(m.needTotal)} resin`}
                      </span>
                      <span className="cost">+{formatResin(m.reward)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}
