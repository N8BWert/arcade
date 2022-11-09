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

	const updatedGameQueue = await program.account.gameQueue.fetch(gameQueueAccount.publicKey);
	const updatedLastPlayer = await program.account.player.fetch(lastPlayer.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount, updatedLastPlayer, updatedGameQueue };
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

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedLastPlayerOne = await program.account.player.fetch(queueOneLastPlayer.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedLastPlayerTwo = await program.account.gameQueue.fetch(queueTwoLastPlayer.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount, updatedGameQueueOne, updatedLastPlayerOne, updatedGameQueueTwo, updatedLastPlayerTwo }
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

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedLastPlayerOne = await program.account.player.fetch(queueOneLastPlayer.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedLastPlayerTwo = await program.account.gameQueue.fetch(queueTwoLastPlayer.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const updatedLastPlayerThree = await program.account.gameQueue.fetch(queueThreeLastPlayer.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount, updatedGameQueueOne, updatedLastPlayerOne, updatedGameQueueTwo, updatedLastPlayerTwo, updatedGameQueueThree, updatedLastPlayerThree }
}

async function joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, queueOneLastPlayer, queueTwoLastPlayer, queueThreeLastPlayer, queueFourLastPlayer) {
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.joinThreePlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			q1LastPlayer: queueOneLastPlayer.publicKey,
			q2LastPlayer: queueTwoLastPlayer.publicKey,
			q3LastPlayer: queueThreeLastPlayer.publicKey,
			q4LastPlayer: queueFourLastPlayer.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount],
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedLastPlayerOne = await program.account.player.fetch(queueOneLastPlayer.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedLastPlayerTwo = await program.account.gameQueue.fetch(queueTwoLastPlayer.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const updatedLastPlayerThree = await program.account.gameQueue.fetch(queueThreeLastPlayer.publicKey);
	const updatedGameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);
	const updatedLastPlayerFour = await program.account.gameQueue.fetch(queueFourLastPlayer.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);

	return { player, playerAccount, updatedGameQueueOne, updatedLastPlayerOne, updatedGameQueueTwo, updatedLastPlayerTwo, updatedGameQueueThree, updatedLastPlayerThree, updatedGameQueueFour, updatedLastPlayerFour }
}

module.exports = {
	joinOnePlayerQueue,
	joinTwoPlayerQueue,
	joinThreePlayerQueue,
	joinFourPlayerQueue,
};