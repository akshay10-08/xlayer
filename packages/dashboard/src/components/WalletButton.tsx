import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import { XLAYER_CHAIN_ID } from "../lib/wagmi";

interface WalletButtonProps {
  variant?: "topbar" | "inline";
}

export default function WalletButton({ variant = "topbar" }: WalletButtonProps) {
  const { chain, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isOnXLayer = chain?.id === XLAYER_CHAIN_ID;

  if (variant === "inline") {
    return (
      <div className="wallet-inline">
        <ConnectButton
          label="🦊 Connect X Layer Wallet"
          accountStatus="address"
          chainStatus="none"
          showBalance={false}
        />
      </div>
    );
  }

  return (
    <div className="wallet-area">
      {isConnected && !isOnXLayer && (
        <button
          className="wrong-network-btn"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: XLAYER_CHAIN_ID })}
        >
          {isSwitching ? "Switching…" : `⚠ Switch to X Layer`}
        </button>
      )}
      <ConnectButton
        label="Connect Wallet"
        accountStatus="address"
        chainStatus="icon"
        showBalance={false}
      />
    </div>
  );
}
