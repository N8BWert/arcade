const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function makeGame(program, provider, arcadeAccount, mostRecentGameAccount) {
	const gameAccount = anchor.web3.Keypair.generate();
	const title = "game title";
	const webGLHash = "this is the webgl hash";
	const gameArtHash = "this is the game art hash";
	const gameWallet = anchor.web3.Keypair.generate();

	await program.rpc.createGame(title, webGLHash, gameArtHash, gameWallet.publicKey, {
		accounts: {
			arcadeAccount: arcadeAccount.publicKey,
			owner: provider.wallet.publicKey,
			gameAccount: gameAccount.publicKey,
			systemProgram: SystemProgram.programId,
			mostRecentGameAccount: mostRecentGameAccount.publicKey,
		},
		signers: [gameAccount],
	});

	const game = await program.account.game.fetch(gameAccount.publicKey);
	return { game, gameAccount, title, webGLHash, gameArtHash, gameWallet };
}

module.exports = {
	makeGame,
};