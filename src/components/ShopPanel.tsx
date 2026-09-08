import { useState } from 'react'
import { GENERATORS, MILESTONES, UPGRADES, WORKERS } from '../game/catalog'
import { generatorCost, upgradeCost, workerCost } from '../game/economy'
import { formatResin } from '../lib/format'
import type {
  GameState,
  GeneratorId,
  MilestoneId,
  UpgradeId,
  WorkerId,
} from '../types'

type Tab = 'workers' | 'grove' | 'upgrades' | 'goals'

interface Props {
  state: GameState
  onBuyGenerator: (id: GeneratorId) => void
  onBuyWorker: (id: WorkerId) => void
  onBuyUpgrade: (id: UpgradeId) => void
  onClaimMilestone: (id: MilestoneId) => void
}

export function ShopPanel({
  state,
  onBuyGenerator,
  onBuyWorker,
  onBuyUpgrade,
  onClaimMilestone,
}: Props) {
  const [tab, setTab] = useState<Tab>('workers')

  const claimable = MILESTONES.filter(
    (m) =>
      !state.claimedMilestones.includes(m.id) &&
      state.totalResin >= m.needTotal,
  ).length

  return (
    <aside className="shop">
      <div className="shop-tabs" role="tablist" aria-label="Shop sections">
        {(
          [
            ['workers', 'Workers'],
            ['grove', 'Grove'],
            ['upgrades', 'Upgrades'],
            ['goals', claimable > 0 ? `Goals (${claimable})` : 'Goals'],
          ] as const
        ).map(([id, label]) => (
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
            Little gatherers walk the grove and haul resin to the vat.
          </p>
          <ul className="shop-list">
            {WORKERS.map((w) => {
              const owned = state.workers[w.id]
              const cost = workerCost(w.id, owned)
              const canBuy = state.resin >= cost
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
                    <span className="shop-item-blurb">{w.blurb}</span>
                    <span className="shop-item-meta">
                      <span>+{w.baseRate}/s each</span>
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
          <p className="shop-lead">Buildings drip resin even when workers rest.</p>
          <ul className="shop-list">
            {GENERATORS.map((g) => {
              const owned = state.generators[g.id]
              const cost = generatorCost(g.id, owned)
              const canBuy = state.resin >= cost
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
                    <span className="shop-item-blurb">{g.blurb}</span>
                    <span className="shop-item-meta">
                      <span>+{g.baseRate}/s each</span>
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
          <p className="shop-lead">Stack upgrades to multiply taps, workers, and buildings.</p>
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

      {tab === 'goals' ? (
        <section>
          <h2>Grove goals</h2>
          <p className="shop-lead">Hit milestones for lump-sum resin rewards.</p>
          <ul className="shop-list">
            {MILESTONES.map((m) => {
              const claimed = state.claimedMilestones.includes(m.id)
              const ready = !claimed && state.totalResin >= m.needTotal
              const progress = Math.min(1, state.totalResin / m.needTotal)
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
                        {claimed ? 'Done' : ready ? 'Claim' : `${Math.floor(progress * 100)}%`}
                      </span>
                    </span>
                    <span className="shop-item-blurb">{m.blurb}</span>
                    <span className="goal-bar" aria-hidden>
                      <span style={{ width: `${progress * 100}%` }} />
                    </span>
                    <span className="shop-item-meta">
                      <span>{formatResin(m.needTotal)} total</span>
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
