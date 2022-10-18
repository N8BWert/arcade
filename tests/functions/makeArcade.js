const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function makeArcade(program, provider) {
	const arcadeAccount = anchor.web3.Keypair.generate();
	const genesisGameAccount = anchor.web3.Keypair.generate();

	await program.rpc.initializeArcade({
		accounts: {
			arcadeAccount: arcadeAccount.publicKey,
			genesisGameAccount: genesisGameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [arcadeAccount, genesisGameAccount],
	});

	const arcade = await program.account.arcadeState.fetch(arcadeAccount.publicKey);

	return { arcade, arcadeAccount, genesisGameAccount };
}

module.exports = {
	makeArcade,
};