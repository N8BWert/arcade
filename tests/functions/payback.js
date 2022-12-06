const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function paybackFunds(program, provider, gameAccount, arcadeAccount) {
	const potAccountOne = anchor.web3.Keypair.generate();
	const potAccountTwo = anchor.web3.Keypair.generate();
	const potAccountThree = anchor.web3.Keypair.generate();

	await program.rpc.paybackFunds({
		accounts: {
			playerOnePot: potAccountOne.publicKey,
			playerTwoPot: potAccountTwo.publicKey,
			playerThreePot: potAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			arcadeAccount: arcadeAccount.publicKey,
			owner: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [potAccountOne, potAccountTwo, potAccountThree],
	});

	return { playerOnePotAccount: potAccountOne, playerTwoPotAccount: potAccountTwo, playerThreePotAccount: potAccountThree };
}

async function cashOutPot(program, winningWallet, potAccount, previousPotAccount) {
	await program.rpc.cashOutPot({
		accounts: {
			gamePotAccount: potAccount.publicKey,
			previousPotAccount: previousPotAccount.publicKey,
			winner: winningWallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [winningWallet],
	});
}

async function cashOutMostRecentPot(program, winningWallet, arcadeAccount, potAccount) {
	await program.rpc.cashOutMostRecentPot({
		accounts: {
			gamePotAccount: potAccount.publicKey,
			arcadeState: arcadeAccount.publicKey,
			winner: winningWallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [winningWallet],
	});
}

async function refillGameFunds(program, provider, gameAccount, lamports) {
	await program.rpc.refillGameFunds(lamports, {
		accounts: {
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});
}

module.exports = {
	paybackFunds,
	cashOutPot,
	cashOutMostRecentPot,
	refillGameFunds,
};