import { ethers } from "ethers";

async function main() {
  const p = new ethers.JsonRpcProvider('https://testrpc.xlayer.tech');
  const abi = ['function agentCount() view returns (uint256)'];
  const c = new ethers.Contract('0x4CE053a14947434ec4F4B8aAa7d8ed1D8080a8d8', abi, p);
  const count = await c.agentCount();
  console.log('Count:', count.toString());
}

main().catch(console.error);
