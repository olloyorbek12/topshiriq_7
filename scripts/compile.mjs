import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const contractPath = path.join(root, "contracts", "EduChainRegistry.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "EduChainRegistry.sol": {
      content: source,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors || [];
const fatalErrors = errors.filter((entry) => entry.severity === "error");

for (const entry of errors) {
  const prefix = entry.severity === "error" ? "ERROR" : "WARN";
  console.log(`[${prefix}] ${entry.formattedMessage}`);
}

if (fatalErrors.length > 0) {
  process.exit(1);
}

const compiled = output.contracts["EduChainRegistry.sol"].EduChainRegistry;
const artifact = {
  contractName: "EduChainRegistry",
  abi: compiled.abi,
  bytecode: `0x${compiled.evm.bytecode.object}`,
  deployedBytecode: `0x${compiled.evm.deployedBytecode.object}`,
  compiler: solc.version(),
};

const artifactsDir = path.join(root, "artifacts");
const publicDir = path.join(root, "public");
fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(
  path.join(artifactsDir, "EduChainRegistry.json"),
  `${JSON.stringify(artifact, null, 2)}\n`
);
fs.writeFileSync(
  path.join(publicDir, "EduChainRegistry.json"),
  `${JSON.stringify({ contractName: artifact.contractName, abi: artifact.abi }, null, 2)}\n`
);

console.log(`Compiled EduChainRegistry with ${artifact.abi.length} ABI entries.`);
