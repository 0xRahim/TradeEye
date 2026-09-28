import TerminalLoader from "@/components/trade/TerminalLoader";

export const metadata = {
  title: "Tradeye Terminal",
  description: "Live chart, drawings, and bar-replay backtesting.",
};

export default function TradePage() {
  return <TerminalLoader />;
}
