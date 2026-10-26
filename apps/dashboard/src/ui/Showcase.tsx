import { useState } from "react";
import {
  Badge,
  Button,
  ButtonSizes,
  ButtonVariants,
  Card,
  CardPadding,
  CardVariants,
  Input,
  Loading,
  MetricCard,
  Panel,
  ProgressBar,
  SectionLabel,
  Select,
} from ".";

/**
 * Every TruMarket component on one page (#/ui), like trumarket/web's
 * /design-system-showcase. Use it to check the look after changing a token.
 */
export function Showcase() {
  const [amount, setAmount] = useState("");
  const invalid = amount !== "" && !/^\d+(\.\d+)?$/.test(amount);
  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>TruMarket components</h1>
        <p className="muted">Same tokens and components as the TruMarket app (src/theme, src/ui).</p>
      </div>

      <Panel>
        <div className="stack">
          <SectionLabel>Buttons</SectionLabel>
          <div className="row">
            {Object.values(ButtonVariants).map((v) => (
              <Button key={v} variant={v}>{v}</Button>
            ))}
          </div>
          <div className="row">
            {Object.values(ButtonSizes).map((s) => (
              <Button key={s} size={s} variant={ButtonVariants.SECONDARY}>Size {s}</Button>
            ))}
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="stack">
          <SectionLabel>Badges and progress</SectionLabel>
          <div className="row">
            <Badge tone="primary">Customs-attested</Badge>
            <Badge tone="accent">Coming soon</Badge>
            <Badge tone="danger">Refunded</Badge>
            <Badge tone="info">Open</Badge>
            <Badge tone="primary" outline>Outline</Badge>
          </div>
          <ProgressBar value={62} label="Subscribed" />
          <div className="row"><Loading variant="inline" /><span className="small muted">Inline loading</span></div>
        </div>
      </Panel>

      <div className="grid g3">
        {Object.values(CardVariants).map((v) => (
          <Card key={v} variant={v} header={<b>{v}</b>} footer={<span className="small">Footer</span>}>
            Card body with the default padding.
          </Card>
        ))}
        <Card hover padding={CardPadding.LG}>Hover me (hover + large padding)</Card>
      </div>

      <div className="grid g3">
        <MetricCard value="12.0%" label="Fixed APY" />
        <MetricCard value="$100k" label="Raise" />
        <MetricCard value="120 d" label="Term" />
      </div>

      <Panel>
        <div className="stack" style={{ maxWidth: 420 }}>
          <SectionLabel>Form controls</SectionLabel>
          <Input
            label="Amount (USDC)"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={invalid ? "Enter a number" : undefined}
          />
          <Select label="Investor" defaultValue="a">
            <option value="a">Investor A</option>
            <option value="b">Investor B</option>
          </Select>
        </div>
      </Panel>

      <Panel muted>
        <p className="muted small">Muted panel, for empty states.</p>
      </Panel>
    </div>
  );
}
