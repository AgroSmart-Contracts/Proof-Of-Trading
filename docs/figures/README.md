# Figures

Mermaid sources (`*.mmd`) and the SVGs exported from them. The pilot figures describe the pool design for SCF #46 ([pool contract v1](../pool-contract-v1.md)); the integrations are planned and not yet built.

| Figure | Source | SVG |
|---|---|---|
| System overview (pilot pool) | [system.mmd](system.mmd) | [system.svg](system.svg) |
| Pilot structure | [pilot-structure.mmd](pilot-structure.mmd) | [pilot-structure.svg](pilot-structure.svg) |
| Money flow for one receivable | [money-flow.mmd](money-flow.mmd) | [money-flow.svg](money-flow.svg) |
| Payment waterfall on a USD 100,000 invoice | [waterfall.mmd](waterfall.mmd) | [waterfall.svg](waterfall.svg) |
| Receivable lifecycle, with exceptions | [receivable-lifecycle.mmd](receivable-lifecycle.mmd) | [receivable-lifecycle.svg](receivable-lifecycle.svg) |
| TruMarket before and after | [integration-before-after.mmd](integration-before-after.mmd) | [integration-before-after.svg](integration-before-after.svg) |
| Build plan by tranche | [build-plan.mmd](build-plan.mmd) | [build-plan.svg](build-plan.svg) |
| v0.2 prototype: per-shipment offering lifecycle | [offering-lifecycle.mmd](offering-lifecycle.mmd) | [offering-lifecycle.svg](offering-lifecycle.svg) |

To regenerate after editing a source:

```sh
npx -y @mermaid-js/mermaid-cli@12.2.0 -i docs/figures/system.mmd -o docs/figures/system.svg -b white
```
