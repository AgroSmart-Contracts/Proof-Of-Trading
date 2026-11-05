# Figures

Mermaid sources (`*.mmd`) and the SVGs exported from them.

| Figure | Source | SVG |
|---|---|---|
| System overview | [system.mmd](system.mmd) | [system.svg](system.svg) |
| Offering lifecycle (state machine) | [offering-lifecycle.mmd](offering-lifecycle.mmd) | [offering-lifecycle.svg](offering-lifecycle.svg) |
| Money flow for one offering | [money-flow.mmd](money-flow.mmd) | [money-flow.svg](money-flow.svg) |
| TruMarket before and after the Stellar integration | [integration-before-after.mmd](integration-before-after.mmd) | [integration-before-after.svg](integration-before-after.svg) |

The on/off-ramps in the money-flow figure (CCTP, Bridge, Koywe) and the "after" side of the integration figure are planned, not built.

To regenerate after editing a source:

```sh
npx -y @mermaid-js/mermaid-cli@12.2.0 -i docs/figures/system.mmd -o docs/figures/system.svg -b white
```
