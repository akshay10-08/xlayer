import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import { XLAYER_CHAIN_ID } from "../lib/wagmi";

export default function WalletButton() {
  const { chain, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isOnXLayer = chain?.id === XLAYER_CHAIN_ID;

  return (
    <div className="wallet-area">
      {/* Wrong network banner — shown when connected but not on X Layer */}
      {isConnected && !isOnXLayer && (
        <button
          className="wrong-network-btn"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: XLAYER_CHAIN_ID })}
        >
          {isSwitching ? "Switching…" : `⚠ Switch to X Layer`}
        </button>
      )}

      {/* RainbowKit's ConnectButton handles all states: disconnected, connecting, connected */}
      <ConnectButton
        label="Connect Wallet"
        accountStatus="address"
        chainStatus="icon"
        showBalance={false}
      />
    </div>
  );
}
