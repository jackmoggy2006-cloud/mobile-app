import { GENERATORS, UPGRADES } from '../game/catalog'
import { generatorCost, upgradeCost } from '../game/economy'
import { formatResin } from '../lib/format'
import type { GameState, GeneratorId, UpgradeId } from '../types'

interface Props {
  state: GameState
  onBuyGenerator: (id: GeneratorId) => void
  onBuyUpgrade: (id: UpgradeId) => void
}

export function ShopPanel({ state, onBuyGenerator, onBuyUpgrade }: Props) {
  return (
    <aside className="shop">
      <section>
        <h2>Grow the grove</h2>
        <p className="shop-lead">Helpers gather resin while you rest.</p>
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

      <section>
        <h2>Deepen the roots</h2>
        <p className="shop-lead">Upgrades multiply what the grove already does.</p>
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
                    <span>Lv {owned}</span>
                    <span className="cost">{formatResin(cost)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
