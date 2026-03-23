export interface GoPlusTokenSecurity {
  contractAddress: string;
  chainId: number;
  chainName: string;
  isOpenSource: boolean | null;
  isProxy: boolean | null;
  isMintable: boolean | null;
  canTakeBackOwnership: boolean | null;
  ownerChangeBalance: boolean | null;
  isHoneypot: boolean | null;
  hasExternalCall: boolean | null;
  transferPausable: boolean | null;
  cannotSellAll: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  holderCount: number | null;
  totalSupply: string | null;
  securityScore: number;
  riskLevel: "safe" | "warning" | "danger";
  flags: string[];
}
