const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function joinOnePlayerQueue(program, provider, gameAccount, gameQueueAccount, lastPlayer) {
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.joinOnePlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			lastPlayer: lastPlayer.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount],
	});

	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount };
}

async function joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, queueOneLastPlayer, queueTwoLastPlayer) {
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.joinTwoPlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			q1LastPlayer: queueOneLastPlayer.publicKey,
			q2LastPlayer: queueTwoLastPlayer.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount],
	});

	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount };
}

async function joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, queueOneLastPlayer, queueTwoLastPlayer, queueThreeLastPlayer) {
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.joinThreePlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			q1LastPlayer: queueOneLastPlayer.publicKey,
			q2LastPlayer: queueTwoLastPlayer.publicKey,
			q3LastPlayer: queueThreeLastPlayer.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount],
	});

	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount };
}

async function joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, queueOneLastPlayer, queueTwoLastPlayer, queueThreeLastPlayer, queueFourLastPlayer) {
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.joinFourPlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			q1LastPlayer: queueOneLastPlayer.publicKey,
			q2LastPlayer: queueTwoLastPlayer.publicKey,
			q3LastPlayer: queueThreeLastPlayer.publicKey,
			q4LastPlayer: queueFourLastPlayer.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount],
	});

	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount };
}

module.exports = {
	joinOnePlayerQueue,
	joinTwoPlayerQueue,
	joinThreePlayerQueue,
	joinFourPlayerQueue,
};