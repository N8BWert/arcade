const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function initOnePlayerQueue(program, provider, gameAccount) {
	const playerAccount = anchor.web3.Keypair.generate();
	const gameQueueAccount = anchor.web3.Keypair.generate();

	await program.rpc.initOnePlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount, gameQueueAccount],
	});

	const gameQueue = await program.account.gameQueue.fetch(gameQueueAccount.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);
	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { player, playerAccount, gameQueue, gameQueueAccount, updatedGame };
}

async function initTwoPlayerQueue(program, provider, gameAccount) {
	const playerAccount = anchor.web3.Keypair.generate();
	const gameQueueAccountOne = anchor.web3.Keypair.generate();
	const gameQueueAccountTwo = anchor.web3.Keypair.generate();

	await program.rpc.initTwoPlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount, gameQueueAccountOne, gameQueueAccountTwo],
	});

	const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);
	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, updatedGame };
}

async function initThreePlayerQueue(program, provider, gameAccount) {
	const playerAccount = anchor.web3.Keypair.generate();
	const gameQueueAccountOne = anchor.web3.Keypair.generate();
	const gameQueueAccountTwo = anchor.web3.Keypair.generate();
	const gameQueueAccountThree = anchor.web3.Keypair.generate();

	await program.rpc.initThreePlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree],
	});

	const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const gameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);
	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, gameQueueThree, gameQueueAccountThree, updatedGame};
}

async function initFourPlayerQueue(program, provider, gameAccount) {
	const playerAccount = anchor.web3.Keypair.generate();
	const gameQueueAccountOne = anchor.web3.Keypair.generate();
	const gameQueueAccountTwo = anchor.web3.Keypair.generate();
	const gameQueueAccountThree = anchor.web3.Keypair.generate();
	const gameQueueAccountFour = anchor.web3.Keypair.generate();

	await program.rpc.initFourPlayerGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour],
	});

	const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const gameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const gameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);
	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, gameQueueThree, gameQueueAccountThree, gameQueueFour, gameQueueAccountFour, updatedGame };
}

module.exports = {
	initOnePlayerQueue,
	initTwoPlayerQueue,
	initThreePlayerQueue,
	initFourPlayerQueue,
};